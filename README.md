# Flagdeck

Multi-brand feature flag and brand configuration management app (React + Vite + TypeScript) with a **Cloudflare Workers + D1** backend and **Google-only** sign-in.

## Auth

- Sign-in is **Google OAuth only**
- Email must be `@ontrackretail.co.uk`
- Email must already be **invited** in Users (Owners invite colleagues)

## Run locally

1. Create a Google Cloud OAuth **Web** client
2. Add authorized redirect URI: `http://localhost:5173/api/auth/callback`
3. Copy secrets:

```bash
cp .dev.vars.example .dev.vars
# fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
# set BOOTSTRAP_OWNER_EMAIL to your real @ontrackretail.co.uk address
```

4. Install, migrate, run:

```bash
npm install
npm run db:migrate:local
npm run dev
```

If you previously seeded with `@example.com` users, reset local D1 so seed emails become `@ontrackretail.co.uk`:

```bash
rm -rf .wrangler/state
npm run db:migrate:local
```

Invite your real `@ontrackretail.co.uk` address as Owner (or update the seed Owner email), then sign in with Google.

## Brand runtime API

Public endpoints (no Google login). Response shape matches `APiexample.json`:
`{ config, features, warnings }`.

```bash
# List brands + environments
GET /api/v1/brands

# Per brand × environment
GET /api/v1/stage/southeastern
GET /api/v1/production/great-northern
```

Brand slugs: `southeastern`, `transpennine`, `southern`, `gatwick`, `great-northern`, `thameslink`, `ticketyboo`.

Live example: https://flagdeck.niblr.workers.dev/api/v1/stage/southeastern

In Google Cloud OAuth client, also add:

- Authorised JavaScript origin: `https://flagdeck.niblr.workers.dev`
- Authorised redirect URI: `https://flagdeck.niblr.workers.dev/api/auth/callback`

## Deploy to Cloudflare

```bash
npm run db:migrate:remote
npm run deploy
```

Update Worker secrets if needed:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put BOOTSTRAP_OWNER_EMAIL
```

## Roles

| Role | Create flags | Edit Stage | Edit Production | Manage users | Delete flags | Revert |
|------|--------------|------------|-----------------|--------------|--------------|--------|
| Developer | ✓ | ✓ | | | | |
| Admin | ✓ | ✓ | ✓ | | | |
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
