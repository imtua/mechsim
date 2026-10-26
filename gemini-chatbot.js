// Gemini-backed, mechanism-scoped AI assistant.
// Google access tokens are kept in memory and are sent only to the protected
// proxy for the current browser session.

(function() {
    'use strict';

    const MAX_HISTORY = 8;
    const MAX_MESSAGE_LENGTH = 2000;
    const GOOGLE_IDENTITY_TIMEOUT = 10000;
    const AUTHORIZATION_FLAG = 'mechsim-gemini-authorized';
    const config = window.GEMINI_CHAT_CONFIG || {};

    class GeminiChatbot {
        constructor(mechanismName) {
            this.mechanismName = mechanismName;
            this.proxyUrl = String(config.proxyUrl || '').replace(/\/$/, '');
            this.clientId = String(config.clientId || '').trim();
            this.scope = config.scope || [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/generative-language.retriever',
            ].join(' ');
            this.conversationHistory = [];
            this.accessToken = null;
            this.tokenClient = null;
            this.isRestoring = false;
            this.rememberedAuthorization = this.readAuthorizationFlag();
            this.isTyping = false;
            this.contextPromise = this.loadMechanismContext();
            this.init();
        }

        init() {
            this.createUI();
            this.setupEventListeners();
            this.showWelcomeMessage();
            this.restoreGoogleConnection();
        }

        createUI() {
            const toggle = document.createElement('button');
            toggle.id = 'gemini-chat-toggle';
            toggle.setAttribute('aria-label', `Ask Gemini about ${this.mechanismName}`);
            toggle.innerHTML = '<span style="font-size: 1.2em;">💬</span>';
            document.body.appendChild(toggle);

            const win = document.createElement('div');
            win.id = 'gemini-chat-window';
            win.innerHTML = `
                <div id="gemini-chat-header">
                    <span id="gemini-chat-title">Mechsim Gemini</span>
                    <span id="gemini-chat-mechanism-name"></span>
                    <button id="gemini-chat-close" aria-label="Close chat">×</button>
                </div>
                <div id="gemini-chat-auth">
                    <span id="gemini-chat-auth-status" role="status">Google not connected</span>
                    <button id="gemini-chat-connect" type="button">Connect Google</button>
                </div>
                <div id="gemini-chat-status" role="status"></div>
                <div id="gemini-chat-messages"></div>
                <div id="gemini-chat-input-area">
                    <input type="text" id="gemini-chat-input" autocomplete="off">
                    <button id="gemini-chat-send" type="button">Send</button>
                </div>
            `;
            document.body.appendChild(win);

            this.toggle = toggle;
            this.window = win;
            this.authStatus = win.querySelector('#gemini-chat-auth-status');
            this.connectBtn = win.querySelector('#gemini-chat-connect');
            this.messagesContainer = win.querySelector('#gemini-chat-messages');
            this.status = win.querySelector('#gemini-chat-status');
            this.input = win.querySelector('#gemini-chat-input');
            this.sendBtn = win.querySelector('#gemini-chat-send');
            this.closeBtn = win.querySelector('#gemini-chat-close');
            win.querySelector('#gemini-chat-mechanism-name').textContent = this.mechanismName;
            this.input.placeholder = `Ask about ${this.mechanismName}...`;
            this.connectBtn.disabled = !this.clientId;
            this.updateChatEnabledState();
        }

        setupEventListeners() {
            this.toggle.addEventListener('click', () => this.toggleWindow());
            this.closeBtn.addEventListener('click', () => this.closeWindow());
            this.connectBtn.addEventListener('click', () => this.toggleGoogleConnection());
            this.sendBtn.addEventListener('click', () => this.handleSend());
            this.input.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') this.handleSend();
            });
            this.window.addEventListener('mousedown', (event) => event.stopPropagation());
        }

        toggleWindow() {
            this.window.classList.toggle('open');
            if (this.window.classList.contains('open')) {
                if (this.accessToken) this.input.focus();
                else this.connectBtn.focus();
            }
        }

        closeWindow() {
            this.window.classList.remove('open');
        }

        addMessage(text, type, meta = '') {
            const message = document.createElement('div');
            message.className = `gemini-message ${type}`;
            message.textContent = text;
            if (meta) {
                const detail = document.createElement('small');
                detail.textContent = meta;
                message.appendChild(detail);
            }
            this.messagesContainer.appendChild(message);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            return message;
        }

        showWelcomeMessage() {
            this.addMessage(
                `Connect Google to ask Gemini about ${this.mechanismName} and related physics.`,
                'welcome'
            );
            if (!this.proxyUrl || !this.clientId) {
                this.setStatus('Chat setup is incomplete: configure the Gemini client and proxy URL.', 'error');
                this.authStatus.textContent = 'Setup required';
            } else {
                this.setStatus('Connect Google to start using Gemini.');
            }
        }

        setStatus(text, type = '') {
            this.status.textContent = text;
            this.status.className = type;
        }

        setAuthStatus(text, type = '') {
            this.authStatus.textContent = text;
            this.authStatus.className = type;
        }

        readAuthorizationFlag() {
            try {
                return window.localStorage.getItem(AUTHORIZATION_FLAG) === 'true';
            } catch (error) {
                return false;
            }
        }

        writeAuthorizationFlag(value) {
            this.rememberedAuthorization = value;
            try {
                if (value) window.localStorage.setItem(AUTHORIZATION_FLAG, 'true');
                else window.localStorage.removeItem(AUTHORIZATION_FLAG);
            } catch (error) {
                // Private browsing or storage restrictions should not block chat.
            }
        }

        updateChatEnabledState() {
            const enabled = Boolean(this.accessToken && this.proxyUrl);
            this.input.disabled = !enabled;
            this.sendBtn.disabled = !enabled || this.isTyping;
        }

        showTyping() {
            if (this.isTyping) return;
            this.isTyping = true;
            const typing = document.createElement('div');
            typing.className = 'gemini-message gemini gemini-typing';
            typing.id = 'gemini-typing';
            typing.textContent = 'Gemini is thinking…';
            this.messagesContainer.appendChild(typing);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            this.updateChatEnabledState();
        }

        removeTyping() {
            this.isTyping = false;
            const typing = this.messagesContainer.querySelector('#gemini-typing');
            if (typing) typing.remove();
            this.updateChatEnabledState();
        }

        async waitForGoogleIdentityServices() {
            const startedAt = Date.now();
            return new Promise((resolve, reject) => {
                const check = () => {
                    if (window.google?.accounts?.oauth2) {
                        resolve(window.google.accounts.oauth2);
                        return;
                    }
                    if (Date.now() - startedAt >= GOOGLE_IDENTITY_TIMEOUT) {
                        reject(new Error('Google sign-in could not be loaded. Check your network connection.'));
                        return;
                    }
                    window.setTimeout(check, 50);
                };
                check();
            });
        }

        createTokenClient(oauth2) {
            return oauth2.initTokenClient({
                client_id: this.clientId,
                scope: this.scope,
                callback: (response) => this.handleTokenResponse(response),
                error_callback: (error) => this.handleTokenError(error),
            });
        }

        async restoreGoogleConnection() {
            if (!this.rememberedAuthorization || !this.clientId || !this.proxyUrl) return;

            this.isRestoring = true;
            this.connectBtn.disabled = true;
            this.setAuthStatus('Restoring Google connection…', 'loading');
            try {
                const oauth2 = await this.waitForGoogleIdentityServices();
                this.tokenClient = this.createTokenClient(oauth2);
                // The grant is remembered by Google; only request a new short-lived token.
                this.tokenClient.requestAccessToken({ prompt: '' });
            } catch (error) {
                this.isRestoring = false;
                this.connectBtn.disabled = false;
                this.setAuthStatus('Google not connected');
                this.setStatus('Connect Google to restore access.');
            }
        }

        async toggleGoogleConnection() {
            if (this.accessToken) {
                this.disconnectGoogle();
                return;
            }
            if (this.isRestoring) return;

            if (!this.clientId) {
                this.setStatus('Set the Google OAuth client ID in gemini-chatbot-config.js first.', 'error');
                return;
            }
            if (!this.proxyUrl) {
                this.setStatus('Set the Gemini proxy URL in gemini-chatbot-config.js first.', 'error');
                return;
            }

            this.connectBtn.disabled = true;
            this.setAuthStatus('Waiting for Google…', 'loading');
            try {
                const oauth2 = await this.waitForGoogleIdentityServices();
                this.tokenClient = this.createTokenClient(oauth2);
                // Google shows consent only when this account has not granted the scope yet.
                this.tokenClient.requestAccessToken({ prompt: '' });
            } catch (error) {
                this.connectBtn.disabled = false;
                this.setAuthStatus('Google not connected', 'error');
                this.setStatus(error.message, 'error');
            }
        }

        handleTokenResponse(response) {
            this.isRestoring = false;
            this.connectBtn.disabled = false;
            if (!response || response.error || !response.access_token) {
                this.handleTokenError(response || {});
                return;
            }

            this.accessToken = response.access_token;
            this.writeAuthorizationFlag(true);
            this.setAuthStatus('Google connected', 'ready');
            this.connectBtn.textContent = 'Disconnect Google';
            this.setStatus('Gemini is ready.', 'ready');
            this.updateChatEnabledState();
            this.input.focus();
        }

        handleTokenError(error) {
            const restoring = this.isRestoring;
            this.isRestoring = false;
            this.connectBtn.disabled = false;
            this.setAuthStatus('Google not connected', 'error');
            if (restoring) {
                this.setAuthStatus('Google not connected');
                this.setStatus('Connect Google to restore access.');
                return;
            }
            if (this.rememberedAuthorization && error?.error === 'interaction_required') {
                this.writeAuthorizationFlag(false);
                this.setStatus('Google access needs to be granted again. Click Connect Google.', 'error');
                return;
            }
            if (error?.error !== 'popup_closed') {
                this.setStatus(error?.error_description || 'Google authorization was not completed.', 'error');
            }
        }

        disconnectGoogle() {
            const token = this.accessToken;
            this.accessToken = null;
            this.tokenClient = null;
            this.isRestoring = false;
            this.writeAuthorizationFlag(false);
            this.connectBtn.textContent = 'Connect Google';
            this.setAuthStatus('Google not connected');
            this.setStatus('Connect Google to start using Gemini.');
            this.updateChatEnabledState();

            if (token && window.google?.accounts?.oauth2) {
                window.google.accounts.oauth2.revoke(token, () => {});
            }
        }

        async handleSend() {
            const text = this.input.value.trim();
            if (!text || this.isTyping) return;

            if (!this.accessToken) {
                this.addMessage('Connect your Google account before asking Gemini a question.', 'error');
                return;
            }
            if (!this.proxyUrl) {
                this.addMessage('The Gemini proxy is not configured.', 'error');
                return;
            }
            if (text.length > MAX_MESSAGE_LENGTH) {
                this.addMessage(`Please keep questions under ${MAX_MESSAGE_LENGTH} characters.`, 'error');
                return;
            }

            this.input.value = '';
            this.addMessage(text, 'user');
            this.conversationHistory.push({ role: 'user', content: text });
            this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY);

            try {
                this.showTyping();
                this.setStatus('Contacting Gemini…', 'loading');
                const result = await this.callProxy();
                this.removeTyping();
                this.addMessage(result, 'gemini');
                this.conversationHistory.push({ role: 'assistant', content: result });
                this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY);
                this.setStatus('Ready.', 'ready');
            } catch (error) {
                this.removeTyping();
                this.addMessage(error.message, 'error');
                this.setStatus('Request failed.', 'error');
                if (error.authorizationExpired) this.disconnectGoogle();
                console.error('Gemini chatbot error:', error);
            }
        }

        async loadMechanismContext() {
            try {
                const response = await fetch('description.md');
                return response.ok ? await response.text() : '';
            } catch (error) {
                console.warn('Could not load mechanism description:', error);
                return '';
            }
        }

        async callProxy() {
            const description = await this.contextPromise;
            let response;
            try {
                response = await fetch(this.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                    body: JSON.stringify({
                        mechanism: this.mechanismName,
                        description,
                        messages: this.conversationHistory,
                    }),
                });
            } catch (error) {
                throw new Error('Could not reach the Gemini proxy. Check its URL and CORS settings.');
            }

            let data = {};
            try {
                data = await response.json();
            } catch (error) {
                data = {};
            }

            if (!response.ok) {
                const authorizationExpired = response.status === 401;
                const requestError = new Error(
                    data.error || (authorizationExpired
                        ? 'Google authorization expired. Connect Google again.'
                        : `Gemini proxy request failed (${response.status}).`)
                );
                requestError.authorizationExpired = authorizationExpired;
                throw requestError;
            }

            if (!data.text) throw new Error('Gemini returned an empty response.');
            return data.text;
        }
    }

    function initGeminiChatbot() {
        const simulation = typeof mechasimulator !== 'undefined'
            ? mechasimulator
            : window.mechasimulator;
        const mechanismName = (simulation && simulation.title) || 'Mechanism';
        const chatbot = new GeminiChatbot(mechanismName);
        window.geminiChatbot = chatbot;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGeminiChatbot);
    } else {
        initGeminiChatbot();
    }
})();
