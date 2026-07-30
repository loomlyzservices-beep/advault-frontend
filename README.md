# Advault Frontend

Plain HTML, CSS, and vanilla JS (ES modules) — no Vue, no build step. Talks to
the `advault-backend` API for everything: accounts, ads, tiers, withdrawals,
and the admin panel.

## Before you deploy: point it at your backend

Open `index.html` and edit this line near the top of `<head>`:

```html
<script>window.ADVAULT_API_BASE = window.ADVAULT_API_BASE || 'http://localhost:3000';</script>
```

Change `http://localhost:3000` to your deployed backend's Railway URL, e.g.:

```html
<script>window.ADVAULT_API_BASE = 'https://advault-backend-production.up.railway.app';</script>
```

## Deploying to Railway

1. Push this folder to its own GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway runs `npm install && npm start`, which serves the static files with a tiny Express server on the assigned `PORT`.
4. Make sure the backend's CORS is open (it is, by default — `cors()` with no restrictions) so the deployed frontend can call it cross-origin.

## Local development

```
npm install
npm start
```

Runs on `http://localhost:4173`. Make sure the backend is also running (see `advault-backend/README.md`) on `http://localhost:3000`, which is the default `ADVAULT_API_BASE`.

## File structure

- `index.html` — all markup: nav, hero, dashboard, ads, tiers, winners, withdraw, and every modal (login/signup, purchase, admin login, confirm, admin panel).
- `styles.css` — full design system: colors, the logo/hero shape, tier badges, avatars, admin panel styling.
- `js/config.js` — backend URL.
- `js/api.js` — thin fetch wrapper around every backend route.
- `js/store.js` — shared app state + auth/ad/tier helper functions.
- `js/avatar.js` — deterministic initials + gradient avatars from a username.
- `js/embed.js` — detects YouTube/Vimeo/video/image URLs for the ad player.
- `js/paystack.js` — Paystack Inline checkout integration.
- `js/app.js` — wires up every section and modal, renders the whole page.
- `js/admin.js` — the full admin panel (users, ads, transactions, analytics, withdrawals, tiers/settings, full reset).

No native `alert()`/`confirm()` are used anywhere — there's a custom toast and a custom confirm modal (`js/app.js`), since native dialogs get blocked in sandboxed/embedded contexts.
