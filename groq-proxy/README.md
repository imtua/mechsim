# Mechsim Groq proxy

This Cloudflare Worker keeps the Groq API key off GitHub Pages and applies a
server-side limit of five chat requests per client IP per minute.

## Deploy

Install or run Wrangler from this directory:

```bash
npx wrangler login
npx wrangler secret put GROQ_API_KEY
npx wrangler deploy
```

The secret is entered interactively and is not written to the repository. The
Worker URL will be similar to:

```text
https://mechsim-groq-proxy.<your-subdomain>.workers.dev
```

Put its `/chat` URL in the root `groq-chatbot-config.js` file:

```js
window.GROQ_PROXY_URL = 'https://mechsim-groq-proxy.<your-subdomain>.workers.dev/chat';
```

Then commit and push the Pages frontend. The Groq API key remains in Cloudflare.

The rate limiter uses Cloudflare's native rate-limit binding. It is an
approximate per-location limit, suitable for controlling public demo usage; it
is not an authentication system or a billing guarantee.
