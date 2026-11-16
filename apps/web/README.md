# AdBidCoin Web App

The web app is the public interface for AdBidCoin, operated by Attention Bid,
Inc.

Users bid for the next 30-minute attention block with a card authorization or a
Solana USDC program escrow. Only the winner pays; losing card holds are canceled
and losing wallet deposits are returned. Winner content is auto-approved so
auctions can run continuously, while admins can still hide or reject content.
Token-based bid power remains paused.

## Persistence

The app uses Supabase Postgres for:

- `auctions`
- `bids`
- `attention_content`
- `attention_events`

Run `../../database/schema.sql` and `../../database/storage.sql` in Supabase before starting the app against a real project.
Run `../../database/growth-scout.sql` when enabling Growth Scout and referrals
on an existing project.

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SITE_URL=https://adbidcoin.com
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
STRIPE_CARD_BIDS_ENABLED=false
STRIPE_APPROVAL_CONFIRMED=false
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
WALLET_ESCROW_ENABLED=false
SOLANA_ESCROW_PROGRAM_ID=...
SOLANA_ESCROW_AUTHORITY_SECRET_KEY_BASE64=...
ADMIN_TOKEN=...
GROWTH_SCOUT_ENABLED=false
BRAVE_SEARCH_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_GROWTH_CHAT_ID=...
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only.

`NEXT_PUBLIC_SITE_URL` is the canonical public origin used by search metadata,
social previews, `robots.txt`, and the XML sitemap. Change it only after the
custom domain is connected and serving the production deployment.

`ADMIN_TOKEN` protects the `/admin` moderation screen. Use a long private value
in production, then paste that value into the admin page when reviewing content.

## Growth Scout and referral rewards

The authenticated `/admin` page includes a review-first acquisition dashboard:

- a six-hour Vercel cron searches recent public web results for high-intent
  Solana and crypto-promotion discussions;
- candidates are scored and stored as drafts, but never posted automatically;
- an admin must review the source and its community rules before approving;
- the optional Telegram action publishes only to the configured owned channel;
- referral URLs use `/?ref=CODE` and attribute a promoter only when a referred
  wallet makes its first verified user bid at or above
  `REFERRAL_MIN_FIRST_BID_USDC` (1 USDC by default);
- USDC rewards remain in a manual ledger until an admin approves the conversion,
  pays from a dedicated wallet, and records the Solana payout signature.

Set `GROWTH_SCOUT_ENABLED=true` only after applying
`database/growth-scout.sql` and adding a server-only `BRAVE_SEARCH_API_KEY`.
`CRON_SECRET` protects the discovery endpoint. Keep Telegram credentials and
all wallet keys server-only. This feature does not automate unsolicited replies,
DMs, group joining, or third-party community posting. Self-referrals are ignored,
but the admin must still review likely multi-wallet abuse before paying.

## Art Drops

The homepage Art Drops section and `/claim` implement first-valid-claim USDC
rewards without exposing a funded private key. Claims require the existing signed
Phantom session, Cloudflare Turnstile, an unexpired code, a rolling 24-hour wallet/viewer cooldown,
and an atomic Supabase reservation. A dedicated server-side signer pays the winner
and records a public Solscan receipt. Admin controls live under `/admin`; the
randomized scheduler runs from `/api/cron/art-drops`.

Run `../../database/art-drops.sql` and follow
`../../docs/art-drops-runbook.md` before enabling the feature.

## Winner-only payments and performance reports

Email-authenticated card bidders authorize their maximum bid with Stripe manual
capture. The winning PaymentIntent is captured after close and losing holds are
canceled. Phantom bidders deposit their maximum bid in a per-bid Anchor escrow;
the program pays the winner's deposit to the treasury and returns losing
deposits. Both paths have independent production gates. Prepaid platform-credit
sales and bids are retired, while their historical ledger remains available for
reconciliation.

Every ended 30-minute block receives an idempotent performance snapshot with
first-party impressions, reliable session-based unique viewers when available,
clicks, CTR, and paid CPC when applicable. Reports render as branded PNGs, have
download/share pages, distinguish repeat appearances from new wins, and can be
posted to the official X account. Follow
`../../docs/credits-and-reports-launch-runbook.md` and run
`../../database/credits-reports-and-art-drop-limits.sql` and
`../../database/winner-only-auctions.sql` before deployment. Follow
`../../docs/winner-only-auction-runbook.md` before enabling either payment path.

`SOLANA_RPC_URL`, `USDC_MINT_ADDRESS`, `TREASURY_WALLET_ADDRESS`, and the escrow
program settings are used to initialize, verify, and settle program escrows. The
`NEXT_PUBLIC_` RPC and mint values are used by the browser to build the Phantom
deposit transaction. All Solana values must point to the same network.

## Current Flow

1. The homepage shows the current attention block.
2. Card bidders authorize a maximum amount; wallet bidders deposit USDC into a
   per-bid program escrow.
3. Card and wallet bids compete at the same face value without token multipliers.
4. The highest bid wins when the block closes.
5. The settlement worker captures or transfers only the winner's bid, cancels
   losing card holds, and refunds losing wallet escrows.
6. When that auction becomes current, the winning wallet can publish the title, description, uploaded image or image URL, and link.
7. New content is auto-approved so blocks can run without manual review every 30 minutes; admins can still hide or reject content in `/admin`. Editing blocked content does not automatically unhide it.
8. If a round has no new winner content, the latest approved winning post stays
   live automatically until a newer winning post is published.

Wallet escrow must remain disabled until its separately deployed Solana program
has passed independent review. Sanitized settlement status and on-chain refund
receipts are exposed at `/api/settlements/attention-N`.

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
