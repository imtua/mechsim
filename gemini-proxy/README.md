# Mechsim Gemini proxy

This Cloudflare Worker forwards browser requests to the Gemini API using the
short-lived Google OAuth access token supplied by the signed-in user. It does
not store user tokens or a shared Gemini API key, and applies a server-side
limit of five chat requests per client IP per minute.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable the **Generative Language API**.
3. Configure the Google Auth platform OAuth consent screen and add test users
   while the app is in testing.
4. Create an OAuth client with application type **Web application**. Add the
   deployed site origin (`https://imtuu.me` or `https://imtua.github.io`) and
   local origins such as `http://localhost:8000` to its authorized JavaScript
   origins.
5. Add these scopes to the consent configuration:
   `https://www.googleapis.com/auth/cloud-platform` and
   `https://www.googleapis.com/auth/generative-language.retriever`.

For the Mechsim GitHub Pages deployment, use these OAuth consent-screen links
(replace the base URL if you use a custom domain):

- Homepage: `https://imtuu.me/mechsim/`
- Privacy policy: `https://imtuu.me/mechsim/privacy.html`
- Terms of service: `https://imtuu.me/mechsim/terms.html`

While the OAuth app is in testing, only its configured test users can connect.
Google may require OAuth verification before allowing unrestricted external
users to grant these scopes.

Put the OAuth client ID in the public root `gemini-chatbot-config.js` file:

```js
window.GEMINI_CHAT_CONFIG = {
    proxyUrl: 'https://mechsim-gemini-proxy.<your-subdomain>.workers.dev/chat',
    clientId: '<your-web-client-id>.apps.googleusercontent.com',
};
```

The client ID is public and belongs in the frontend. Never put a client secret
or access token in the repository.

## Deploy

From this directory, set the Google Cloud project ID in `wrangler.jsonc`, then
run:

```bash
npx wrangler login
npx wrangler deploy
```

The Worker URL will be similar to:

```text
https://mechsim-gemini-proxy.<your-subdomain>.workers.dev
```

Set its `/chat` URL in the root configuration file before deploying the Pages
frontend.

Google AI Pro and Ultra subscriptions provide additional quota in Google AI
Studio, but do not automatically make a third-party Gemini API integration
use that AI Studio quota. API requests use the configured Google Cloud project
and its Gemini API billing/quota rules.
