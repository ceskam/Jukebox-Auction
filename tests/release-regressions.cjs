const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("winner-only settlement runs when the attention block starts", () => {
  const source = read("apps/web/lib/settlements.ts");
  assert.match(source, /\.lte\("starts_at", nowMs\)/);
  assert.doesNotMatch(source, /\.lte\("ends_at", nowMs\)/);
});

test("card bidding appears before unavailable wallet bidding", () => {
  const source = read("apps/web/app/page.tsx");
  assert.ok(source.indexOf("<CardBidAccount") < source.indexOf("<BidButton"));
  assert.match(source, /href="#card-bidding">Bid with Card/);
});

test("share graphics use ImageResponse-compatible flex layouts", () => {
  const source = read("apps/web/app/api/reports/[auctionId]/image/route.ts");
  assert.doesNotMatch(source, /display: "grid"/);
  assert.match(source, /ADBIDCOIN · VERIFIED PERFORMANCE/);
  assert.match(source, /metric\("Impressions"/);
  assert.match(source, /metric\("Link clicks"/);
});
