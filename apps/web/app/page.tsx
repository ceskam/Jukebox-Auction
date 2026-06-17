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

async function getAttention(auctionId: string) {
  const res = await fetch(
    `http://localhost:3000/api/attention?auctionId=${auctionId}`,
    {
      cache: "no-store",
    }
  );

  return res.json();
}

export default async function HomePage() {
  const auction = await getAuction();
  const attention = await getAttention(auction.id);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Global Attention Auction</h1>

      <CountdownTimer endsAt={auction.endsAt} />

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
