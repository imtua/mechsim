// Groq-backed, mechanism-scoped AI assistant.
// The Groq API key stays in the server-side proxy; it is never sent to this page.

(function() {
    'use strict';

    const MAX_HISTORY = 8;
    const MAX_MESSAGE_LENGTH = 2000;

    class GroqChatbot {
        constructor(mechanismName) {
            this.mechanismName = mechanismName;
            this.proxyUrl = (window.GROQ_PROXY_URL || '').replace(/\/$/, '');
            this.conversationHistory = [];
            this.isTyping = false;
            this.contextPromise = this.loadMechanismContext();
            this.init();
        }

        init() {
            this.createUI();
            this.setupEventListeners();
            this.showWelcomeMessage();
        }

        createUI() {
            const toggle = document.createElement('button');
            toggle.id = 'groq-chat-toggle';
            toggle.setAttribute('aria-label', `Ask AI about ${this.mechanismName}`);
            toggle.innerHTML = '<span style="font-size: 1.2em;">💬</span>';
            document.body.appendChild(toggle);

            const win = document.createElement('div');
            win.id = 'groq-chat-window';
            win.innerHTML = `
                <div id="groq-chat-header">
                    <span id="groq-chat-title">Mechsim AI</span>
                    <span id="groq-chat-mechanism-name"></span>
                    <button id="groq-chat-close" aria-label="Close chat">×</button>
                </div>
                <div id="groq-chat-status" role="status"></div>
                <div id="groq-chat-messages"></div>
                <div id="groq-chat-input-area">
                    <input type="text" id="groq-chat-input" autocomplete="off">
                    <button id="groq-chat-send">Send</button>
                </div>
            `;
            document.body.appendChild(win);

            this.toggle = toggle;
            this.window = win;
            this.messagesContainer = win.querySelector('#groq-chat-messages');
            this.status = win.querySelector('#groq-chat-status');
            this.input = win.querySelector('#groq-chat-input');
            this.sendBtn = win.querySelector('#groq-chat-send');
            this.closeBtn = win.querySelector('#groq-chat-close');
            win.querySelector('#groq-chat-mechanism-name').textContent = this.mechanismName;
            this.input.placeholder = `Ask about ${this.mechanismName}...`;
        }

        setupEventListeners() {
            this.toggle.addEventListener('click', () => this.toggleWindow());
            this.closeBtn.addEventListener('click', () => this.closeWindow());
            this.sendBtn.addEventListener('click', () => this.handleSend());
            this.input.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') this.handleSend();
            });
            this.window.addEventListener('mousedown', (event) => event.stopPropagation());
        }

        toggleWindow() {
            this.window.classList.toggle('open');
            if (this.window.classList.contains('open')) this.input.focus();
        }

        closeWindow() {
            this.window.classList.remove('open');
        }

        addMessage(text, type, meta = '') {
            const message = document.createElement('div');
            message.className = `groq-message ${type}`;
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
            this.addMessage(`Ask about ${this.mechanismName} and related physics.`, 'welcome');
            this.setStatus(this.proxyUrl
                ? 'Powered by Groq through a protected proxy.'
                : 'Chat setup is incomplete: configure the Groq proxy URL.');
        }

        setStatus(text, type = '') {
            this.status.textContent = text;
            this.status.className = type;
        }

        showTyping() {
            if (this.isTyping) return;
            this.isTyping = true;
            const typing = document.createElement('div');
            typing.className = 'groq-message groq groq-typing';
            typing.id = 'groq-typing';
            typing.textContent = 'AI is thinking…';
            this.messagesContainer.appendChild(typing);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }

        removeTyping() {
            this.isTyping = false;
            const typing = this.messagesContainer.querySelector('#groq-typing');
            if (typing) typing.remove();
        }

        async handleSend() {
            const text = this.input.value.trim();
            if (!text || this.isTyping) return;

            if (!this.proxyUrl) {
                this.addMessage(
                    'The Groq proxy is not configured. Set GROQ_PROXY_URL in groq-chatbot-config.js.',
                    'error'
                );
                return;
            }

            if (text.length > MAX_MESSAGE_LENGTH) {
                this.addMessage(`Please keep questions under ${MAX_MESSAGE_LENGTH} characters.`, 'error');
                return;
            }

            this.input.value = '';
            this.sendBtn.disabled = true;
            this.addMessage(text, 'user');
            this.conversationHistory.push({ role: 'user', content: text });
            this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY);

            try {
                this.showTyping();
                this.setStatus('Contacting Groq…', 'loading');
                const result = await this.callProxy();
                this.removeTyping();
                this.addMessage(result, 'groq');
                this.conversationHistory.push({ role: 'assistant', content: result });
                this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY);
                this.setStatus('Ready.', 'ready');
            } catch (error) {
                this.removeTyping();
                this.addMessage(error.message, 'error');
                this.setStatus('Request failed.', 'error');
                console.error('Groq chatbot error:', error);
            } finally {
                this.sendBtn.disabled = false;
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mechanism: this.mechanismName,
                        description,
                        messages: this.conversationHistory
                    })
                });
            } catch (error) {
                throw new Error('Could not reach the Groq proxy. Check its URL and CORS settings.');
            }

            let data = {};
            try {
                data = await response.json();
            } catch (error) {
                data = {};
            }

            if (!response.ok) {
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    throw new Error(data.error || `Rate limit reached. Try again in ${retryAfter || 'a minute'}.`);
                }
                throw new Error(data.error || `Proxy request failed (${response.status}).`);
            }

            if (!data.text) throw new Error('The Groq proxy returned an empty response.');
            return data.text;
        }
    }

    function initGroqChatbot() {
        const simulation = typeof mechasimulator !== 'undefined'
            ? mechasimulator
            : window.mechasimulator;
        const mechanismName = (simulation && simulation.title) || 'Mechanism';
        const chatbot = new GroqChatbot(mechanismName);
        window.groqChatbot = chatbot;
        window.gemmaChatbot = chatbot;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGroqChatbot);
    } else {
        initGroqChatbot();
    }
})();
