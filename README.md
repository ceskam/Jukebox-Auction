# Attention Bid

Attention Bid is a continuous 15-minute attention auction powered by USDC on Solana.

The highest verified USDC bidder wins the next attention block. When that block becomes live, the winning wallet can control the headline, description, and link shown on the public homepage.

## MVP Goal

Ship a functional public auction loop:

- Continuous 15-minute auction windows
- Bids target the next attention block
- The current block displays the previous winner's content
- Bids are denominated in USDC
- Phantom creates real Solana USDC transfers before bids are saved
- The backend verifies the Solana transaction signature, USDC mint, amount, sender, and treasury recipient
- Only the winning wallet can edit content for the block it won
- Bid history, current high bid, countdown, and wallet state are visible on the homepage

## Current Implementation

The app in `apps/web` uses:

- Next.js App Router
- Supabase Postgres for auctions, bids, and attention content
- Phantom browser wallet detection
- Real Solana USDC transfer creation and transaction verification

The bid flow asks Phantom to send USDC to the configured treasury wallet. The
server verifies the confirmed transaction before recording a bid in Supabase.
Demo payments can still be enabled for local testing with `ENABLE_DEMO_PAYMENTS=true`.

## Auction Flow

1. A visitor opens the public homepage.
2. The page shows the current attention block, the next auction countdown, the next block's high bid, and recent bids.
3. A user connects Phantom.
4. The user bids USDC for the next 15-minute attention block.
5. Phantom signs and sends a USDC transfer to the treasury wallet.
6. The backend verifies the Solana transaction before saving the bid.
7. The highest verified bid wins when the countdown ends.
8. When that block becomes current, the winning wallet can publish or update the homepage attention content.
9. The next auction continues automatically.

## Next Production Steps

- Add stronger payment receipt and admin audit views
- Add realtime updates for bid history and current high bid
- Add moderation/admin controls for published attention content
- Deploy the web app to Vercel
- Add production environment variables and observability

## Development

```txt
apps/
  web/              Attention Bid web app
```

From `apps/web`:

```bash
npm install
npm run dev
```

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `database/schema.sql`.
3. Copy `apps/web/.env.example` to `apps/web/.env.local`.
4. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SOLANA_RPC_URL=...
SOLANA_RPC_URL=...
NEXT_PUBLIC_USDC_MINT_ADDRESS=...
USDC_MINT_ADDRESS=...
NEXT_PUBLIC_TREASURY_WALLET_ADDRESS=...
TREASURY_WALLET_ADDRESS=...
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in browser code.

Use matching Solana RPC, USDC mint, and treasury wallet values for the same
network. The default mainnet USDC mint is
`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.

The current app uses server-side Supabase helpers for reads and writes so the UI behavior stays the same while persistence moves from local files to Postgres.
