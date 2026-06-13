interface Props {
  winner: string | null;
  highestBid: number;
  auctionId: string;
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
      }}
    >
      <h2>Current Attention Owner</h2>

      <p>
        <strong>Wallet:</strong>{" "}
        {winner ? winner : "No winner yet"}
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
