# AdBidCoin Art Drops launch runbook

Art Drops are operator-funded, first-valid-claim USDC rewards. A public branded
image contains a one-time code. The actual treasury private key is never sent to
the browser, stored in Supabase, included in an image, or written to application
logs.

## Safety model

- The feature is disabled by `ART_DROPS_ENABLED=false` and paused in the database
  by default.
- A signed Phantom login proves control of the receiving wallet.
- Cloudflare Turnstile adds a human-verification step.
- `reserve_art_drop` uses a PostgreSQL row lock so only one wallet can reserve a code.
- One paid reward per wallet is allowed in a rolling 30-day period.
- A dedicated, low-balance hot wallet funds rewards and token-account creation
  fees. Do not reuse the auction treasury, company treasury, or house bot.
- Rolling 24-hour limits include scheduled, active, reserved, paid, and
  manual-review drops.
- A payout with uncertain state becomes `payout_review`; it is never retried automatically.

## 1. Apply the database migration

Open the production Supabase SQL editor and run `database/art-drops.sql`.
Confirm `art_drop_control`, `art_drops`, and `reserve_art_drop` exist. Leave the
initial `art_drop_control.paused` value set to `true` during setup.

## 2. Create the dedicated reward wallet

Generate the wallet on a trusted local computer. From `apps/web`, this command
prints its public address and a one-time base64 secret for Vercel:

```bash
node -e 'const {Keypair}=require("@solana/web3.js");const k=Keypair.generate();console.log("ADDRESS="+k.publicKey.toBase58());console.log("SECRET_BASE64="+Buffer.from(k.secretKey).toString("base64"))'
```

Immediately save `SECRET_BASE64` as the sensitive Vercel value
`ART_DROP_TREASURY_SECRET_KEY_BASE64`. Do not paste it into chat, GitHub,
Supabase, screenshots, or support tickets. Record the public `ADDRESS` in the
company wallet inventory and recovery procedure.

Send only the operating amount to this address: enough mainnet USDC for the
planned budget and a small amount of SOL for fees and recipient token-account
creation. Refill this one address as needed rather than keeping the full company
treasury online.

## 3. Configure Cloudflare Turnstile

Create a Turnstile widget restricted to `adbidcoin.com`, then copy:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — public site key;
- `TURNSTILE_SECRET_KEY` — sensitive server-only key.

Claims fail closed if either key is missing.

## 4. Add Vercel production variables

```text
ART_DROPS_ENABLED=false
ART_DROP_TREASURY_SECRET_KEY_BASE64=<base64 64-byte keypair>
ART_DROP_REWARD_USDC=10
ART_DROP_DAILY_LIMIT_USDC=50
ART_DROP_MIN_INTERVAL_HOURS=4
ART_DROP_MAX_INTERVAL_HOURS=12
ART_DROP_EXPIRY_MINUTES=60
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Turnstile site key>
TURNSTILE_SECRET_KEY=<Turnstile secret key>
```

The existing `SOLANA_RPC_URL`, `USDC_MINT_ADDRESS`, `CRON_SECRET`, Supabase
variables, and wallet-authentication secret are also required. All Solana values
must refer to the same network. Redeploy after changing variables.

## 5. Controlled production test

1. Keep `ART_DROPS_ENABLED=false` and the database control paused.
2. Open `/admin` and confirm Art Drops reports the signer as `Ready` and shows
   the expected shortened reward-wallet address.
3. Set `ART_DROPS_ENABLED=true` in Vercel and redeploy.
4. In `/admin`, click **Resume drops**.
5. Click **Publish drop now** with only the minimum test balance funded.
6. Open the homepage separately, confirm the branded image, and open `/claim`.
7. Authenticate a test wallet, complete Turnstile, enter the graphic code, and
   verify exactly one 10 USDC transfer.
8. Confirm a second wallet receives an already-claimed response and no transfer.
9. Confirm `/admin` shows `paid`, the recipient, and the Solscan receipt.
10. Pause Art Drops again until the company has approved the public rules.

## 6. Operations

- Use `/admin` to pause/resume, create an immediate drop, cancel an unclaimed
  drop, inspect failures, and open payment receipts.
- Vercel calls `/api/cron/art-drops` every 15 minutes. With no open drop, it
  schedules the next one randomly within the configured range.
- Active drops expire after `ART_DROP_EXPIRY_MINUTES`. The next cron marks them
  expired and schedules another.
- Never retry a `payout_review` row. When it has a signature, use **Verify
  on-chain** in `/admin`; the app marks it paid only after Solana reports a
  confirmed or finalized successful transaction. Rows without a signature remain
  audit records for manual review.
- Pause in `/admin` to stop immediately. For a second kill switch, set
  `ART_DROPS_ENABLED=false` and redeploy.

## 7. Before public promotion

Have qualified counsel review `/art-drop-rules` for promotion, sweepstakes,
geographic eligibility, sanctions, privacy, and tax requirements. The included
page is an operational starting point, not legal advice.
