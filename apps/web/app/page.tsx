import BidButton from "../BidButton";
import WalletConnect from "../WalletConnect";
import CountdownTimer from "../CountdownTimer";
import AttentionOwner from "../AttentionOwner";
import AttentionEditor from "../AttentionEditor";
import AttentionDisplay from "../AttentionDisplay";
import { getCurrentAuction, getNextAuction } from "../lib/auction";

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
  const currentAuction = getCurrentAuction();
  const nextAuction = getNextAuction();

  const attention = await getAttention(currentAuction.id);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Global Attention Auction</h1>

   <CountdownTimer endsAt={currentAuction.endsAt} />

      <AttentionDisplay
        title={attention?.title ?? ""}
        description={attention?.description ?? ""}
        url={attention?.url ?? ""}
      />

      <h2>Next Attention Auction</h2>

      <AttentionOwner
        winner={nextAuction.winner}
        highestBid={nextAuction.highestBid}
        auctionId={nextAuction.id}
      />

      <WalletConnect />

      <p>Next Auction: {nextAuction.id}</p>

      <p>Highest Bid: {nextAuction.highestBid} USDC</p>

      <p>Leading Bidder: {nextAuction.winner ?? "None"}</p>

      <BidButton />

      <AttentionEditor
        auctionId={nextAuction.id}
        wallet={nextAuction.winner ?? "demo-wallet"}
        winner={nextAuction.winner}
      />
    </main>
  );
}
