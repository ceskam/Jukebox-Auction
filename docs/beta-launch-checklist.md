# Live Beta Launch Checklist

Complete these steps before sharing the public URL broadly.

## Supabase

- Confirm the project is active and on the intended paid plan.
- Open the SQL editor and run `database/beta-security.sql` once.
- Confirm the `attention-images` bucket is public but has no anonymous upload policy.
- Keep the service-role key only in Vercel. Never place it in a `NEXT_PUBLIC_` variable.

## Vercel

- Set `WALLET_AUTH_SECRET` to a unique random value of at least 32 characters.
- Confirm `ADMIN_TOKEN` is a different random value of at least 32 characters.
- Set both `MAX_BETA_BID_USDC` and `NEXT_PUBLIC_MAX_BETA_BID_USDC` to `100`.
- Confirm `ENABLE_DEMO_PAYMENTS` is `false`.
- Confirm the server-side Solana RPC URL uses a private production provider.
- Keep the Supabase service-role key and treasury configuration scoped to Production.
- Redeploy after changing environment variables.

## Smoke Test

- Open the production URL in a private browser window.
- Connect Phantom and approve the message signature.
- Place the smallest permitted real USDC bid.
- Confirm the transaction receipt opens on Solscan and the bid appears once.
- Refresh and verify the bid is still present.
- When the block becomes current, submit harmless test content.
- Confirm the content is auto-approved and visible without opening `/admin`.
- Open `/admin`, hide it, and confirm it disappears.
- Edit and resubmit the hidden content; confirm it stays hidden until an admin approves it.
- Check Vercel logs for 500 errors and Supabase logs for rejected requests.

## Operating Rules

- Keep the beta invite-only while monitoring the first real transactions.
- Keep the admin review page open around block changes.
- Pause promotion immediately if payment verification, wallet authentication, or moderation fails.
- Publish terms, privacy information, an abuse contact, and clear all-pay/no-refund disclosures before a broad public launch.
