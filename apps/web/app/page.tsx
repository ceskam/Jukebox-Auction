import BidButton from "../BidButton";
import WalletConnect from "../WalletConnect";
import CountdownTimer from "../CountdownTimer";
import AttentionOwner from "../AttentionOwner";
import AttentionEditor from "../AttentionEditor";
import AttentionDisplay from "../AttentionDisplay";
import TrackPageView from "../TrackPageView";
import AutoRefresh from "../AutoRefresh";
import CommunityCard from "../CommunityCard";
import {
  getBidHistory,
  getCurrentAuction,
  getNextAuction,
} from "../lib/auction";
import {
  getAttentionContent,
  getAttentionContentForAuction,
} from "../lib/attention";
import { getPlatformMetrics, type PlatformMetrics } from "../lib/metrics";
import {
  getWalletFromSessionToken,
  WALLET_SESSION_COOKIE,
} from "../lib/security";
import { getSolscanTransactionUrl } from "../lib/solscan";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadOptional<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T
) {
  try {
    return await loader();
  } catch (error) {
    console.warn(`Could not load ${label}: ${getErrorMessage(error)}`);
    return fallback;
  }
}

const EMPTY_PLATFORM_METRICS: PlatformMetrics = {
  totalViews: 0,
  totalBidUsdc: 0,
  totalLinkClicks: 0,
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const authenticatedWallet = getWalletFromSessionToken(
    cookieStore.get(WALLET_SESSION_COOKIE)?.value
  );
  const currentAuction = await getCurrentAuction();
  const nextAuction = await getNextAuction();
  const currentAttention = await loadOptional<
    Awaited<ReturnType<typeof getAttentionContent>>
  >(
    "current attention content",
    () => getAttentionContent(currentAuction.id),
    undefined
  );
  const displayedAttention =
    currentAttention?.wallet === currentAuction.winner
      ? currentAttention
      : undefined;
  const isShowingHouseSponsored = Boolean(
    displayedAttention && currentAuction.isHouseBid
  );
  const loadedEditorAttention =
    authenticatedWallet && authenticatedWallet === currentAuction.winner
      ? await loadOptional<
          Awaited<ReturnType<typeof getAttentionContentForAuction>>
        >(
          "winner attention editor content",
          () => getAttentionContentForAuction(currentAuction.id),
          undefined
        )
      : undefined;
  const editorAttention =
    loadedEditorAttention?.wallet === authenticatedWallet
      ? loadedEditorAttention
      : undefined;
  const liveBids = await loadOptional<Awaited<ReturnType<typeof getBidHistory>>>(
    "live bids",
    () => getBidHistory(nextAuction.id, 6),
    []
  );
  const platformMetrics = await loadOptional(
    "platform metrics",
    getPlatformMetrics,
    EMPTY_PLATFORM_METRICS
  );

  return (
    <main className="page-shell">
      <AutoRefresh />
      <TrackPageView auctionId={currentAuction.id} />

      <nav className="top-nav">
        <a className="brand" href="/">
          <span>Attention</span> Bid
        </a>
        <div className="nav-links" aria-label="Primary navigation">
          <a href="#auction">Auction</a>
          <a href="#leaderboard">Leaderboard</a>
          <a href="#how-it-works">How it works</a>
          <a href="#community">Community</a>
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
            title={displayedAttention?.title ?? ""}
            description={displayedAttention?.description ?? ""}
            url={displayedAttention?.url ?? ""}
            imageUrl={displayedAttention?.imageUrl ?? ""}
            isHouseSponsored={isShowingHouseSponsored}
          />

          <CountdownTimer
            endsAt={currentAuction.endsAt}
            houseBidActive={nextAuction.isHouseBid}
          />

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
              <span className="eyebrow">
                {nextAuction.isHouseBid ? "House bid" : "Current bid"}
              </span>
              <strong>
                {(nextAuction.isHouseBid
                  ? nextAuction.houseBidAmount
                  : nextAuction.highestBid
                ).toFixed(2)} USDC
              </strong>
            </div>
          </div>

          <section className="platform-stats" aria-label="Attention Bid totals">
            <div>
              <span className="eyebrow">Total views</span>
              <strong>{platformMetrics.totalViews.toLocaleString()}</strong>
            </div>
            <div>
              <span className="eyebrow">User USDC bid</span>
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

          <BidButton
            currentHighBid={nextAuction.highestBid}
            auctionId={nextAuction.id}
          />

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
            isHouseBid={nextAuction.isHouseBid}
            houseBidAmount={nextAuction.houseBidAmount}
            housePaymentSignature={nextAuction.housePaymentSignature}
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
                      <span>
                        {bid.bidSource === "house"
                          ? "AttentionBid House"
                          : shortWallet(bid.wallet)}
                      </span>
                      {bid.bidSource === "house" && (
                        <small className="house-bid-label">Operator funded</small>
                      )}
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
              <p className="hint">
                {nextAuction.isHouseBid
                  ? "A disclosed house bid is active. A user can replace it at the normal 0.25 USDC opening price."
                  : "No bids yet. Be first into the next block."}
              </p>
            )}
          </section>

          <CommunityCard />

          <section className="how-card" id="how-it-works">
            <span className="eyebrow">How it works</span>
            <ol>
              <li>Connect Phantom.</li>
              <li>Bid USDC for the next 15-minute block.</li>
              <li>Highest verified bid wins when the timer ends.</li>
              <li>Bids are final. Losing bids are not refunded.</li>
              <li>Approved winner content appears on the homepage.</li>
              <li>
                Empty rounds may receive one clearly labeled, operator-funded
                0.25 USDC house bid after five minutes.
              </li>
            </ol>
          </section>
        </aside>
      </section>
    </main>
  );
}
