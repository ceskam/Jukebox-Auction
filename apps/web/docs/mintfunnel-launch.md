# Mintfunnel bidder acquisition test

Approved budget: $150 total, $15/day. Do not treat a daily cap alone as a
lifetime cap: set a $150 campaign total and a ten-day end date when available.
Start with engagement/CPC until real conversion delivery is verified.

## Install

1. Copy the adbidcoin.com install token from Mintfunnel Analytics into the
   production deployment variable `NEXT_PUBLIC_MINTFUNNEL_TOKEN`. The token is
   public in the installed browser snippet, but is intentionally not committed.
2. Deploy this branch through the usual review process. Without that variable,
   tracking remains disabled. No database migration is needed.
3. Visit the production homepage and verify that Mintfunnel shows Active and
   receives the UTM-tagged visit. The SDK is limited to the homepage; it is not
   mounted on admin or reward-claim pages. A loaded SDK can remain active during
   client navigation, so this is not a hard isolation boundary.
4. Confirm the custom event named `verified_user_bid` appears, and mark it as a
   key event in Mintfunnel. It is emitted after a newly saved, real Solana user
   payment; the amount is the actual USDC paid, not the QUIET effective bid.
   Failed, demo, house-bot and replayed receipt paths do not emit this event.
5. The custom event sends only its name and `value_usd`; no explicit wallet
   identification hook is installed. The third-party SDK still collects its
   standard traffic/session data and may perform its own wallet detection.
   Review the site's privacy disclosures before enabling production tracking.
6. This event counts bids, not first-time wallets. Do not label it new-bidder
   acquisition. Reconcile first/repeat bidder counts with the bid database.

## Limits

Browser-side reporting is best-effort: ad blockers, SDK load failures, page
closure or a lost API response can undercount conversions. Receipt replays are
intentionally not counted, so payment recovery cannot inflate conversions.
Mintfunnel conversion totals are marketing signals, not the accounting ledger.
No payment should be made solely to test this installation.

## Campaign

Headline: Promote Your Project in AdBidCoin’s 30-Minute Auction

Destination:
https://adbidcoin.com/?utm_source=mintfunnel&utm_medium=native_cpc&utm_campaign=bidder_test_01&utm_content=project_promotion#auction

Creative: adbidcoin-mintfunnel-ad-v2-logo.png (provided separately).
Start max CPC: $0.25, subject to the current account floor.
Review placements and verified bids before raising bids or reallocating funds.
Mintfunnel AI integration is not connected; no unattended optimization is active.
