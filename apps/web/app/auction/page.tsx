import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auction",
  robots: { index: false, follow: false },
};

export default function AuctionPage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Auction</h1>

      <p>Highest Bid: $0.00</p>

      <input
        type="number"
        placeholder="Bid Amount"
      />

      <button>Place Bid</button>
    </main>
  );
}
