import BidButton from "../BidButton";

async function getAuction() {
  const res = await fetch("http://localhost:3000/api/auction", {
    cache: "no-store",
  });

  return res.json();
}

export default async function HomePage() {
  const auction = await getAuction();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Jukebox Auction</h1>

      <p>Current Auction: {auction.id}</p>

      <p>Highest Bid: {auction.highestBid} USDC</p>

      <p>Winner: {auction.winner ?? "None"}</p>

      <BidButton />
    </main>
  );
}
