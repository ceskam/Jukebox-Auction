# Bitmedia AdBidCoin pilot

Campaign: `6adbeda38c8ba13fe3de9110` (AdBidCoin Traffic Pilot 01)
Ad group: `6adbeda48c8ba13fe3de917b` (Builders CPC Desktop Pilot)
Conversion: `6adbedda8c8ba13fe3de9485`, custom event `verifiedbid`.

User authorized a $300 funded campaign and ongoing optimization. Start with
$100 in the campaign and hold $200 in the main balance. Do not enable automatic
refilling. The account minimum daily group limit is $50. Use even pacing,
$0.25 CPC initially, desktop OS, English, US/Canada/UK/Australia/New Zealand,
VPN and data-center traffic excluded, three-day rerun cooldown.

The first text creative explains USDC bidding for a 30-minute homepage block
and explicitly states that all bids are final and non-refundable. Logo variants
remain blocked by Chrome file-upload permission.

## Conversion setup

Set production `NEXT_PUBLIC_BITMEDIA_CONVERSION_ID` to the conversion ID above.
The public ID is not an account/API credential. The homepage loads Bitmedia's
provided event manager, which captures its click ID. After a newly saved real
user bid, the existing server-confirmed conversion response triggers the
provider's documented BMDataLayer event with actual USDC value. Failed, demo,
house and replayed payments do not produce this response. No explicit wallet,
payment signature, session cookie or private key is sent in the custom event.
Each provider is isolated so analytics failures do not affect payment success.

Verify SDK script presence after deployment and inspect the first real
conversion in Bitmedia. Never make a real bid just to test marketing tracking.
Reporting is browser-based and best-effort; it is not the accounting ledger.
These are verified bids, not necessarily first-time bidders. Do not attribute
aggregate homepage totals to paid campaigns.

## Management

Inspect moderation, spend, delivery, source IDs, country, creatives and verified
bids every four hours during the pilot, allowing Bitmedia's 15-minute reporting
lag. Keep the $300 aggregate ceiling; no new deposits, token trades or auctions.
At $50 spent with no verified bids, pause and diagnose, checking that tracking
works before rejecting traffic quality. Do not prune sources from CTR alone.
Consider excluding a source only with at least 40 clicks / $10 spend and no
verified bids, with appropriate account-level context. If no delivery after 24
hours of approval, inspect blockers and raise CPC in small increments, at most
$0.50, only within unchanged daily and funded limits. Do not guarantee delivery.
Release reserve in $50 tranches only after at least three verified conversions
and cost per verified bid no more than $10, and working attribution. This is a
pilot acquisition threshold, not a proven profitable CPA. Otherwise leave the
reserve untouched and report the evidence. Stop after budget exhaustion or
November 6, 2026 at 23:59 America/Los_Angeles, whichever comes first.
