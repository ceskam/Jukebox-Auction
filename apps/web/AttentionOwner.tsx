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
    <div
      style={{
        border: "2px solid #00ff99",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "20px",
        wordBreak: "break-word",
      }}
    >
      <h2>🏆 Leading Bidder</h2>

      <p>
        <strong>Wallet:</strong> {shortWallet(winner)}
      </p>

      <p>
        <strong>Winning Bid:</strong> {highestBid} USDC
      </p>

      <p>
        <strong>Attention Block:</strong> {auctionId}
      </p>
    </div>
  );
}
