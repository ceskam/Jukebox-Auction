import BidButton from "../BidButton";
import WalletConnect from "../WalletConnect";
import CountdownTimer from "../CountdownTimer";
import AttentionOwner from "../AttentionOwner";
import AttentionEditor from "../AttentionEditor";
import AttentionDisplay from "../AttentionDisplay";

async function getAuction() {
  const res = await fetch("http://localhost:3000/api/auction", {
    cache: "no-store",
  });

  return res.json();
}

async function getAttention() {
  const res = await fetch("http://localhost:3000/api/attention", {
    cache: "no-store",
  });

  return res.json();
}

export default async function HomePage() {
  const auction = await getAuction();
  const attention = await getAttention();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Global Attention Auction</h1>

      <CountdownTimer />

      <AttentionDisplay
        title={attention?.title ?? ""}
        description={attention?.description ?? ""}
        url={attention?.url ?? ""}
      />

      <AttentionOwner
        winner={auction.winner}
        highestBid={auction.highestBid}
        auctionId={auction.id}
      />

      <WalletConnect />

      <p>Current Auction: {auction.id}</p>

      <p>Highest Bid: {auction.highestBid} USDC</p>

      <p>Winner: {auction.winner ?? "None"}</p>

      <BidButton />

      <AttentionEditor />
    </main>
  );
}
