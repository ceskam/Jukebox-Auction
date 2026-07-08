# Attention Bid Web App

The web app is the public interface for Attention Bid.

Users connect Phantom, bid USDC for the next 15-minute attention block, and the winning wallet controls the public homepage content for the block it won.

## Persistence

The app uses Supabase Postgres for:

- `auctions`
- `bids`
- `attention_content`

Run `../../database/schema.sql` in Supabase before starting the app against a real project.

## Environment

Copy `.env.example` to `.env.local` and fill in:

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
ADMIN_TOKEN=...
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only.

`ADMIN_TOKEN` protects the `/admin` moderation screen. Use a long private value
in production, then paste that value into the admin page when reviewing content.

`SOLANA_RPC_URL`, `USDC_MINT_ADDRESS`, and `TREASURY_WALLET_ADDRESS` are used by
the server to verify USDC transfer signatures before saving bids. The
`NEXT_PUBLIC_` versions are used by the browser to build the Phantom payment
transaction. All Solana values must point to the same network.

## Current Flow

1. The homepage shows the current attention block.
2. Bids are placed in USDC for the next 15-minute block.
3. The highest verified bid wins when the current block closes.
4. When that auction becomes current, the winning wallet can edit the title, description, image URL, and link.
5. The next auction continues automatically.

## Next Work

- Add Supabase Realtime for live bid history and current high bid updates.
- Add a stronger payment receipt/admin audit view.
- Add image upload storage instead of relying only on pasted image URLs.
