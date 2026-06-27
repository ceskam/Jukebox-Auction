interface Props {
  winner: string | null;
  highestBid: number;
  auctionId: string;
}

function shortWallet(wallet: string | null) {
  if (!wallet) return "No leading bidder yet";
  return `${wallet.slice(0, 4)}...${wallet.slice(-5)}`;
}

export default function AttentionOwner({
  winner,
  highestBid,
  auctionId,
}: Props) {
  return (
    <section className="leader-card">
      <span className="eyebrow">Next block leader</span>
      <h2>{shortWallet(winner)}</h2>
      <dl>
        <div>
          <dt>Current bid</dt>
          <dd>{highestBid.toFixed(2)} USDC</dd>
        </div>
        <div>
          <dt>Auction ID</dt>
          <dd>{auctionId}</dd>
        </div>
      </dl>
    </section>
  );
}
