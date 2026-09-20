# Attention Bid Web App

The web app is the public interface for Attention Bid.

Users connect Phantom, bid USDC for the next 30-minute attention block, and the winning wallet controls the public homepage content for the block it won. The server snapshots the bidder wallet's QUIET balance and applies proportional bid power from 1x to 10x. Winner content is auto-approved so auctions can run continuously, while admins can still hide or reject content when needed. Bids are final and are not refunded.

## Persistence

The app uses Supabase Postgres for:

- `auctions`
- `bids`
- `attention_content`
- `attention_events`

Run `../../database/schema.sql` and `../../database/storage.sql` in Supabase before starting the app against a real project.

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SITE_URL=https://attentionbid.com
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
QUIET_MINT_ADDRESS=JCfSVdmBNKwMnMUMccfNbQQVVJKYsQNbXCqhdRuZpump
ADMIN_TOKEN=...
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only.

`NEXT_PUBLIC_SITE_URL` is the canonical public origin used by search metadata,
social previews, `robots.txt`, and the XML sitemap. Change it only after the
custom domain is connected and serving the production deployment.

`ADMIN_TOKEN` protects the `/admin` moderation screen. Use a long private value
in production, then paste that value into the admin page when reviewing content.

`SOLANA_RPC_URL`, `USDC_MINT_ADDRESS`, and `TREASURY_WALLET_ADDRESS` are used by
the server to verify USDC transfer signatures before saving bids. The
`NEXT_PUBLIC_` versions are used by the browser to build the Phantom payment
transaction. All Solana values must point to the same network.

## Current Flow

1. The homepage shows the current attention block.
2. Bids are placed in USDC for the next 30-minute block.
3. The server verifies the connected wallet's current QUIET balance and saves a
   bid-power snapshot. Tokens remain in the holder's wallet; they are not locked.
4. The highest effective bid wins when the current block closes.
5. Bids are winner-takes-all. Losing bids are not refunded.
6. When that auction becomes current, the winning wallet can publish the title, description, uploaded image or image URL, and link.
7. New content is auto-approved so blocks can run without manual review every 30 minutes; admins can still hide or reject content in `/admin`. Editing blocked content does not automatically unhide it.
8. The next auction continues automatically.

The snapshot design is non-custodial but does not lock QUIET. A true deposited
vault would require a separately deployed and audited Solana program.

## Disclosed house-sponsored bid bot

After `database/house-bot.sql` is applied, an optional Vercel cron can place one
operator-funded 0.25 USDC house bid when an auction has remained empty for ten
minutes. The bot rotates sponsored posts for Quiet Coin, LivePayout, and the
configured Cash App destination. House bids are clearly labeled, excluded from
organic bid-volume metrics, and never raise the opening price for a user. Any
verified user bid takes priority over a house bid, including another 0.25 USDC
bid.

Keep `HOUSE_BOT_ENABLED=false` until a dedicated low-balance wallet, a daily
limit, and a strong `CRON_SECRET` are configured in Vercel. Store the keypair
only as the server-side `HOUSE_BOT_SECRET_KEY_BASE64`; never commit or expose it
to the browser. Set `HOUSE_BOT_ENABLED=false` and redeploy for an immediate kill
switch. A 24 USDC rolling daily limit covers at most 96 completely empty rounds;
set a lower limit for a smaller beta budget.

## Homepage Metrics

The homepage shows running totals for page views, verified USDC bid volume, and
attention link clicks. Run the latest `../../database/schema.sql` in Supabase so
the `attention_events` table exists before deploying this version.

## Company, white paper, and search discovery

The public company profile lives at `/about`, and the searchable white-paper
overview lives at `/white-paper`. Version 6.1 of the PDF is served from
`/attention-bid-white-paper-v6-1.pdf`. The app also publishes organization and
website structured data, social preview metadata, `robots.txt`, and
`sitemap.xml`.

After a custom domain is connected in Vercel:

1. Set `NEXT_PUBLIC_SITE_URL` to the final `https://` domain for Production.
2. Redeploy so canonical links, previews, the sitemap, and robots file update.
3. Add the domain to Google Search Console and submit `/sitemap.xml`.
4. Keep one canonical domain and redirect the `www` or apex alternative to it.

## Next Work

- Add Supabase Realtime for live bid history and current high bid updates.
- Add a stronger payment receipt/admin audit view.
- Add privacy-conscious production analytics and track auction-to-wallet and
  wallet-to-bid conversion.
