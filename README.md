# Planary Blackjack

Multiplayer blackjack for Planary Casino, live at [21.planary.ch](https://21.planary.ch). Up to five players per table, public quick-seat tables and private tables by code, table chat. Play money only.

- `src/`: Next.js app (lobby and table UI), deployed on Vercel
- `party/`: Cloudflare Worker with two Durable Objects via partyserver. `table.ts` runs each table (shoe, dealer, turns, payouts); `lobby.ts` tracks public tables
- `shared/`: card rules and the client/server protocol

## House rules

Standard real-casino rules, nothing tilted:

- 6 decks, shuffled with a cryptographic Fisher–Yates (rejection sampling, no modulo bias). Reshuffle when a quarter of the shoe is left.
- Blackjack pays 3:2, wins pay 1:1, ties push.
- Dealer stands on all 17s and peeks for blackjack under an ace or a ten.
- Insurance (half the bet, pays 2:1) when the dealer shows an ace; with a blackjack that is even money.
- Double on any first two cards, also after a split.
- Split pairs up to 4 hands. Split aces get one card each and can't be re-split. 21 after a split is not a blackjack.
- No surrender.

House edge with perfect basic strategy is about 0.4% (a 20-million-hand simulation of these rules gave 0.44% ± 0.05%).

## Local development

```bash
npm install
npm run party   # table server (wrangler dev) on localhost:1999
npm run dev     # Next.js on localhost:3001
```

Copy `.env.example` to `.env.local`. Sign-in goes through planary-auth: the app keeps the token it hands back and verifies it via `auth.planary.ch/api/auth/me` (no Supabase keys needed). Only signed-in players can sit; others can watch.

## Deploy

- Tables: `npm run party:deploy` (Cloudflare)
- Web: push to `main`; Vercel builds it. Set `NEXT_PUBLIC_PARTYKIT_HOST` to the worker host (`planary-blackjack.<account>.workers.dev`).

Chips live in the Planary casino wallet (`planary-casino-api`); the table debits bets and credits payouts through a service binding.
