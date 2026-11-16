# Platform credits and attention reports launch runbook

## 1. Apply the database migration

Run `database/credits-reports-and-art-drop-limits.sql` in the production
Supabase SQL editor. Confirm the credit account, purchase, transaction,
reservation, Stripe event, and attention report tables exist. The migration is
server-only and grants no direct browser table access.

## 2. Enable email sign-in

In Supabase Authentication, enable email magic-link authentication and add
`https://adbidcoin.com` to the allowed redirect URLs. Test sign-in and sign-out
before testing payments.

## 3. Stripe approval gate

Do not enable live purchases until Stripe confirms in writing that Attention
Bid's exact auction and seller-maintained credit model is supported. Stripe's
current restricted-business list calls out bidding-fee auctions, stored-value
credits, and sales of online traffic/engagement. Preserve the approval in the
company compliance records.

For test mode, configure:

```text
STRIPE_CREDITS_ENABLED=true
STRIPE_APPROVAL_CONFIRMED=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CREDIT_PURCHASE_FEE_PERCENT=0
```

Create a Stripe webhook endpoint for
`https://adbidcoin.com/api/stripe/webhook` and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Only after written approval and successful test-mode verification may the
secret be replaced by an `sk_live_...` key and
`STRIPE_APPROVAL_CONFIRMED=true`. Checkout credits are issued only by verified,
signed webhooks. Redirects never change balances.

## 4. X report publishing

Create or use the approved X developer app for the official AdBidCoin account.
It needs user-context write access and media upload access. Configure:

```text
X_REPORTS_ENABLED=false
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
```

Keep `X_REPORTS_ENABLED=false` while testing report generation and downloads.
After a test post from the official account succeeds, set it to `true` and
redeploy. A unique database row prevents duplicate reports. Explicit X failures
are retried by cron; ambiguous post outcomes remain locked in `publishing` for
manual reconciliation to avoid duplicates.

## 5. Verification checklist

1. Art Drops pay exactly 2 USDC.
2. The 36th same-day claim is rejected after 35 paid/reserved rewards.
3. The same wallet, engagement session, or claimant risk fingerprint cannot win
   again for rolling 24 hours.
4. Five active minutes are required and no link click is required.
5. Stripe test Checkout shows amount, fee, and credits before payment.
6. Redirecting without a verified webhook does not issue credits.
7. Replaying a webhook does not duplicate credits.
8. Credit bids debit the internal ledger once and rank at face value beside
   wallet bids.
9. Failed/expired payments and refunds update purchase and ledger records.
10. Each ended block creates one report with the correct repeat/new-win label,
    metrics, download, and share links.
11. X failures retry without duplicate posts; ambiguous outcomes stay locked.
