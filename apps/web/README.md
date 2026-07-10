# Attention Bid Web App

The web app is the public interface for Attention Bid.

Users connect Phantom, bid USDC for the next 15-minute attention block, and the winning wallet controls the public homepage content for the block it won. Winner content is auto-approved so auctions can run continuously, while admins can still hide or reject content when needed. Bids are final and are not refunded.

## Persistence

The app uses Supabase Postgres for:

- `auctions`
- `bids`
- `attention_content`

Run `../../database/schema.sql` and `../../database/storage.sql` in Supabase before starting the app against a real project.

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ATTENTION_IMAGE_BUCKET=attention-images
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
4. Bids are winner-takes-all. Losing bids are not refunded.
5. When that auction becomes current, the winning wallet can publish the title, description, uploaded image or image URL, and link.
6. Submitted content is auto-approved so blocks can run without manual review every 15 minutes; admins can still hide or reject content in `/admin`.
7. The next auction continues automatically.

## Next Work

- Add Supabase Realtime for live bid history and current high bid updates.
- Add a stronger payment receipt/admin audit view.
- Add custom domain and production analytics.
