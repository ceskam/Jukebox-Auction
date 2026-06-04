export default function HomePage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>🎵 Jukebox Auction</h1>

      <p>
        Bid USDC for control of the next 15-minute playlist block.
      </p>

      <button>
        Connect Wallet
      </button>

      <hr />

      <h2>Current Auction</h2>

      <p>Highest Bid: $0.00</p>

      <p>Time Remaining: 15:00</p>
    </main>
  );
}
