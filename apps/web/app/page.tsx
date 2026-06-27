import BidButton from "../BidButton";
import WalletConnect from "../WalletConnect";
import CountdownTimer from "../CountdownTimer";
import AttentionOwner from "../AttentionOwner";
import AttentionEditor from "../AttentionEditor";
import AttentionDisplay from "../AttentionDisplay";
import {
  getBidHistory,
  getCurrentAuction,
  getNextAuction,
} from "../lib/auction";
import { getAttentionContent } from "../lib/attention";

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function HomePage() {
  const currentAuction = getCurrentAuction();
  const nextAuction = getNextAuction();
  const currentAttention = getAttentionContent(currentAuction.id);
  const liveBids = getBidHistory(nextAuction.id, 6);

  return (
    <main className="page-shell">
      <nav className="top-nav">
        <a className="brand" href="/">
          <span>Attention</span> Bid
        </a>
        <div className="nav-links" aria-label="Primary navigation">
          <a href="#auction">Auction</a>
          <a href="#leaderboard">Leaderboard</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <WalletConnect />
      </nav>

      <section className="hero-section">
        <span className="eyebrow">The world&apos;s first attention auction</span>
        <h1>Attention is valuable. Bid for it.</h1>
        <p>
          Every 15 minutes, the highest verified USDC bidder wins control of
          the public homepage attention block.
        </p>
      </section>

      <section className="auction-grid" id="auction">
        <div className="main-column">
          <AttentionDisplay
            title={currentAttention?.title ?? ""}
            description={currentAttention?.description ?? ""}
            url={currentAttention?.url ?? ""}
          />

          <CountdownTimer endsAt={nextAuction.endsAt} />

          <div className="stats-grid" id="leaderboard">
            <div>
              <span className="eyebrow">Current block</span>
              <strong>{currentAuction.id}</strong>
            </div>
            <div>
              <span className="eyebrow">Next block</span>
              <strong>{nextAuction.id}</strong>
            </div>
            <div>
              <span className="eyebrow">Current bid</span>
              <strong>{nextAuction.highestBid.toFixed(2)} USDC</strong>
            </div>
          </div>

          <BidButton currentHighBid={nextAuction.highestBid} />

          <AttentionEditor
            auctionId={currentAuction.id}
            winner={currentAuction.winner}
            initialTitle={currentAttention?.title}
            initialDescription={currentAttention?.description}
            initialUrl={currentAttention?.url}
          />
        </div>

        <aside className="side-column">
          <AttentionOwner
            winner={nextAuction.winner}
            highestBid={nextAuction.highestBid}
            auctionId={nextAuction.id}
          />

          <section className="bid-history-card">
            <div className="section-heading">
              <span className="eyebrow">Live bids</span>
              <strong>{liveBids.length}</strong>
            </div>

            {liveBids.length > 0 ? (
              <ol className="bid-list">
                {liveBids.map((bid) => (
                  <li key={bid.id}>
                    <span>{shortWallet(bid.wallet)}</span>
                    <strong>{bid.amountUsdc.toFixed(2)} USDC</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="hint">No bids yet. Be first into the next block.</p>
            )}
          </section>

          <section className="how-card" id="how-it-works">
            <span className="eyebrow">How it works</span>
            <ol>
              <li>Connect Phantom.</li>
              <li>Bid USDC for the next 15-minute block.</li>
              <li>Highest verified bid wins when the timer ends.</li>
              <li>The winning wallet controls the homepage content.</li>
            </ol>
          </section>
        </aside>
      </section>
    </main>
  );
}
