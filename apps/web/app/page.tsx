import BidButton from "../BidButton";
import WalletConnect from "../WalletConnect";
import CountdownTimer from "../CountdownTimer";
import AttentionOwner from "../AttentionOwner";
import AttentionEditor from "../AttentionEditor";
import AttentionDisplay from "../AttentionDisplay";
import TrackPageView from "../TrackPageView";
import {
  getBidHistory,
  getCurrentAuction,
  getNextAuction,
} from "../lib/auction";
import {
  getAttentionContent,
  getAttentionContentForAuction,
} from "../lib/attention";
 content-submission-safety

import { getPlatformMetrics } from "../lib/metrics";
 main
import { getSolscanTransactionUrl } from "../lib/solscan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default async function HomePage() {
  const currentAuction = await getCurrentAuction();
  const nextAuction = await getNextAuction();
  const currentAttention = await getAttentionContent(currentAuction.id);
  const editorAttention = await getAttentionContentForAuction(currentAuction.id);
  const liveBids = await getBidHistory(nextAuction.id, 6);
  const platformMetrics = await getPlatformMetrics();

  return (
    <main className="page-shell">
      <TrackPageView auctionId={currentAuction.id} />

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
          Every 15 minutes, the highest verified USDC bidder wins the public
          homepage attention block. Bids are final.
        </p>
      </section>

      <section className="auction-grid" id="auction">
        <div className="main-column">
          <AttentionDisplay
            auctionId={currentAuction.id}
            title={currentAttention?.title ?? ""}
            description={currentAttention?.description ?? ""}
            url={currentAttention?.url ?? ""}
            imageUrl={currentAttention?.imageUrl ?? ""}
          />

          <CountdownTimer endsAt={currentAuction.endsAt} />

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

          <section className="platform-stats" aria-label="Attention Bid totals">
            <div>
              <span className="eyebrow">Total views</span>
              <strong>{platformMetrics.totalViews.toLocaleString()}</strong>
            </div>
            <div>
              <span className="eyebrow">Total USDC bid</span>
              <strong>
                {platformMetrics.totalBidUsdc.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                USDC
              </strong>
            </div>
            <div>
              <span className="eyebrow">Link clicks</span>
              <strong>{platformMetrics.totalLinkClicks.toLocaleString()}</strong>
            </div>
          </section>

          <BidButton currentHighBid={nextAuction.highestBid} />

          <AttentionEditor
            auctionId={currentAuction.id}
            winner={currentAuction.winner}
            initialTitle={editorAttention?.title}
            initialDescription={editorAttention?.description}
            initialUrl={editorAttention?.url}
            initialImageUrl={editorAttention?.imageUrl}
            initialModerationStatus={editorAttention?.moderationStatus}
            initialModerationNote={editorAttention?.moderationNote}
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
                    <div>
                      <span>{shortWallet(bid.wallet)}</span>
                      {bid.paymentSignature && (
                        <a
                          href={getSolscanTransactionUrl(bid.paymentSignature)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Receipt
                        </a>
                      )}
                    </div>
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
              <li>Bids are final. Losing bids are not refunded.</li>
              <li>Approved winner content appears on the homepage.</li>
            </ol>
          </section>
        </aside>
      </section>
    </main>
  );
}
