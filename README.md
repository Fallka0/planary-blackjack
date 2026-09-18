# Planary Blackjack

Multiplayer blackjack for Planary Casino, live at [21.planary.ch](https://21.planary.ch). Up to five players per table, public quick-seat tables and private tables by code, table chat. Play money only.

- `src/`: Next.js app (lobby and table UI), deployed on Vercel
- `party/`: Cloudflare Worker with two Durable Objects via partyserver. `table.ts` runs each table (shoe, dealer, turns, payouts); `lobby.ts` tracks public tables
- `shared/`: card rules and the client/server protocol

## Local development

```bash
npm install
npm run party   # table server (wrangler dev) on localhost:1999
npm run dev     # Next.js on localhost:3001
```

Copy `.env.example` to `.env.local`. Sign-in goes through planary-auth: the app keeps the token it hands back and verifies it via `auth.planary.ch/api/auth/me` (no Supabase keys needed). Players who don't sign in play as guests.

## Deploy

- Tables: `npm run party:deploy` (Cloudflare)
- Web: push to `main`; Vercel builds it. Set `NEXT_PUBLIC_PARTYKIT_HOST` to the worker host (`planary-blackjack.<account>.workers.dev`).

Chips are kept in the browser (5'000 to start) until the Planary wallet exists.
