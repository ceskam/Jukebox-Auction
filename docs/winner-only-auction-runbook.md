# Winner-only auction launch runbook

This release replaces prepaid card credits and direct-to-treasury wallet bids.
Card bidders authorize a maximum amount and wallet bidders deposit USDC in a
per-bid Solana program escrow. Only the winning bid is collected.

## Safety gates

Do not enable either funding path merely because the application builds.

- Keep the master `WINNER_ONLY_AUCTIONS_ENABLED=false` gate off until the
  database migration is applied and at least one funding path is ready.

- Obtain written confirmation from Stripe that manual-capture card
  authorizations are approved for AdBidCoin's exact auction flow. Keep
  `STRIPE_CARD_BIDS_ENABLED=false` and `STRIPE_APPROVAL_CONFIRMED=false` until
  that confirmation is archived.
- Have the Solana program in `programs/adbidcoin_escrow` independently audited,
  deploy it with a dedicated authority, and verify the program and upgrade
  authority on Solana Explorer. Keep `WALLET_ESCROW_ENABLED=false` until then.
- The legacy prepaid-credit purchase and bid endpoints return HTTP 410. Reconcile
  any existing credit balances manually before launch.

## Database

Run migrations in this order:

1. `database/schema.sql`
2. `database/credits-reports-and-art-drop-limits.sql`
3. `database/winner-only-auctions.sql`

The last migration creates server-only authorization and escrow ledgers,
idempotent settlement state, atomic bid-recording functions, and a sanitized
public settlement-receipt view. Re-running it is safe.

## Stripe test mode

1. Add `STRIPE_SECRET_KEY=sk_test_...` and the webhook signing secret.
2. Set `WINNER_ONLY_AUCTIONS_ENABLED=true` and
   `STRIPE_CARD_BIDS_ENABLED=true`; test mode does not require the live
   approval flag.
3. Subscribe the webhook to `checkout.session.completed`,
   `checkout.session.expired`, `payment_intent.canceled`,
   `payment_intent.payment_failed`, and the existing refund events.
4. Confirm Checkout creates a PaymentIntent with `capture_method=manual` and
   status `requires_capture`.
5. Test three auctions: card winner, card loser, and no bids. Confirm the winner
   is captured once and every losing hold is canceled once.
6. Before live mode, set `STRIPE_APPROVAL_CONFIRMED=true` only after written
   approval and replace the test keys with live keys.

## Solana escrow

1. Install the Solana and Anchor 0.30.1 toolchains.
2. Run `anchor build`, create a dedicated program keypair, then run
   `anchor keys sync` so `Anchor.toml` and `declare_id!` match that keypair.
3. Test initialize, deposit, finalize, winner settlement, loser refund,
   duplicate settlement rejection, invalid destination rejection, and mixed
   card/wallet auctions on localnet and devnet.
4. Obtain an independent audit. Deploy to mainnet only after findings are fixed.
5. Fund the dedicated escrow authority with only enough SOL for account creation
   and settlement fees. Store its 64-byte keypair as base64 in the server-only
   `SOLANA_ESCROW_AUTHORITY_SECRET_KEY_BASE64` variable.
6. Set `SOLANA_ESCROW_PROGRAM_ID` to the verified deployed address and enable
   `WALLET_ESCROW_ENABLED=true`.

The program emits deposit, finalization, settlement, and refund events. Public
receipts are also available from `/api/settlements/attention-N`.

## Settlement worker

Vercel calls `/api/cron/settlements` every two minutes with `CRON_SECRET`.
Settlement uses Stripe idempotency keys and on-chain account state so retries do
not create duplicate capture or payout operations. Any partial failure is stored
as `needs_review`; do not manually capture or cancel a PaymentIntent until its
database and Stripe state have been compared.

## Release checks

- A late card webhook is rejected and its hold is canceled.
- A wallet deposit cannot be recorded for another wallet, auction, amount,
  nonce, program, or receipt.
- Winner ordering is identical across card and wallet bids.
- Card winner captures; card losers cancel.
- Wallet winner transfers to treasury; wallet losers return to their owners.
- Settlement and refund signatures appear in the public receipt endpoint.
- A signed-in winning card bidder can edit the attention block.
- Art Drops still enforce 2 USDC rewards, a 70 USDC UTC-day cap, rolling 24-hour
  eligibility, five minutes of active viewing, and no click requirement.

## Rollback

Disable new bidding with `STRIPE_CARD_BIDS_ENABLED=false` and
`WALLET_ESCROW_ENABLED=false`, but keep `WINNER_ONLY_AUCTIONS_ENABLED=true`
until every existing authorization and escrow is terminal. Then turn off the
master gate and redeploy. Do not delete ledger rows. Continue running the settlement worker until
all already-authorized bids and deposited escrows have reached a terminal state.
