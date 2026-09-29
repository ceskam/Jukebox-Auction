# Growth Scout launch runbook

Growth Scout is a review-first acquisition tool. It discovers public pages,
scores likely relevance, prepares a draft, and puts the result in `/admin`.
It never auto-replies, sends DMs, joins groups, or posts in third-party
communities. The only direct publishing action targets the Telegram chat owned
by the operator and still requires an admin click.

## 1. Database

Run `database/growth-scout.sql` once in the production Supabase SQL editor. The
migration creates:

- `growth_opportunities`
- `referral_codes`
- `referral_visits`
- `referral_conversions`

All four tables have RLS enabled and are available only to the server-side
Supabase service role. Referral visits store a daily rotating HMAC identifier,
not a raw IP address.

## 2. Search discovery

Create a Brave Search API key and add these Production environment variables in
Vercel:

```text
GROWTH_SCOUT_ENABLED=true
BRAVE_SEARCH_API_KEY=...
REFERRAL_MIN_FIRST_BID_USDC=1
```

`GROWTH_SCOUT_QUERIES` is optional. Separate custom searches with `||`. Keep the
queries focused on genuine user intent rather than broad crypto keywords.

The Vercel cron calls `/api/cron/growth-scout` every six hours. It uses the
existing `CRON_SECRET` bearer token and stores only high-scoring, unique HTTPS
results. Search credentials remain server-only.

## 3. Owned Telegram channel

Create a Telegram bot with `@BotFather`, add it to a group or channel controlled
by AdBidCoin, and grant the minimum permission needed to post. Add:

```text
TELEGRAM_BOT_TOKEN=...
TELEGRAM_GROWTH_CHAT_ID=@your_channel_or_numeric_chat_id
```

The “Post to owned Telegram” button is intentionally an admin-only action. Do
not configure a community that has not explicitly authorized the bot.

## 4. Referral rewards

Create codes from `/admin`. A paid referral needs a valid Solana promoter wallet.
The public URL is `https://adbidcoin.com/?ref=CODE`.

A conversion is added only when:

1. the code is active;
2. the browser retained the signed 30-day attribution cookie;
3. the referred wallet completes its first verified user bid;
4. that bid is at least `REFERRAL_MIN_FIRST_BID_USDC`; and
5. the referred wallet is not the promoter wallet.

Conversions begin as `pending`. Review the promoter, traffic, bid, wallet
history, and signs of multi-wallet abuse. Then approve or reject. Pay approved
rewards manually from a dedicated, low-balance operations wallet and record the
Solana transaction signature before marking them paid. Never store a payout
wallet private key in this feature.

Keep the minimum qualifying bid at or above the referral reward during the beta,
set a written weekly budget, and pause a code when traffic quality deteriorates.

## 5. Community safety

- Read each community's rules before using a prepared draft.
- Disclose that the link is sponsored and that promoters may receive USDC.
- Do not reward clicks, follows, reposts, fake accounts, or bid volume.
- Do not automate keyword replies, unsolicited mentions, DMs, or account
  creation.
- Treat the queue as research. A high relevance score is not permission to post.

Current platform references:

- [X automation rules](https://help.x.com/en/rules-and-policies/x-automation)
- [Reddit spam policy](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam)
- [Discord platform manipulation policy](https://discord.com/safety/platform-manipulation-policy-explainer)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Brave Search API authentication](https://api-dashboard.search.brave.com/documentation/guides/authentication)

## 6. Release checklist

1. Run the SQL migration.
2. Add the Production environment variables.
3. Redeploy the production app so the new cron is registered.
4. Log in to `/admin` and run the scout manually.
5. Review several results without publishing; adjust queries if quality is low.
6. Create one internal referral code with a 0 USDC reward and test attribution.
7. Create one paid code only after the conversion ledger is confirmed.
8. Test Telegram with the owned test channel before using the public channel.
9. Set a weekly reward budget and document who may approve payouts.
