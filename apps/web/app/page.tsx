import BidButton from "../BidButton";
import WalletConnect from "../WalletConnect";
import CountdownTimer from "../CountdownTimer";
import AttentionOwner from "../AttentionOwner";
import AttentionEditor from "../AttentionEditor";
import AttentionDisplay from "../AttentionDisplay";
import TrackPageView from "../TrackPageView";
import AutoRefresh from "../AutoRefresh";
import CommunityCard from "../CommunityCard";
import ShareAuction from "../ShareAuction";
import CompanyCard from "../CompanyCard";
import SiteFooter from "../SiteFooter";
import Brand from "../Brand";
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
        <Brand />
        <div className="nav-links" aria-label="Primary navigation">
          <a href="#auction">Auction</a>
          <a href="#leaderboard">Leaderboard</a>
          <a href="#how-it-works">How it works</a>
          <a href="#community">Community</a>
          <a href="#share">Share</a>
          <a href="/about">Company</a>
          <a href="/white-paper">White paper</a>
        </div>
        <WalletConnect />
      </nav>

      <section className="hero-section">
        <img
          className="hero-logo"
          src="/adbidcoin-logo.png"
          alt="AdBidCoin logo"
          width="420"
          height="420"
        />
        <div className="hero-copy">
          <span className="eyebrow">The 30-minute attention market</span>
          <h1>Own the next block.</h1>
          <p>
            Every 30 minutes, the highest effective bidder wins the public
            homepage attention block. QUIET holders receive up to 10x bid power.
            Bids are final.
          </p>
        </div>
      </section>

      <CompanyCard />

      <ShareAuction auctionId={currentAuction.id} />

      <section
        className="white-paper-banner"
        id="white-paper"
        aria-labelledby="white-paper-title"
      >
        <div className="white-paper-copy">
          <span className="eyebrow">White paper · Version 6.1</span>
          <h2 id="white-paper-title">
            The market for the next 30 minutes of attention.
          </h2>
          <p>
            Read the market thesis, perpetual-auction design, infrastructure,
            company structure, funding pathways, tokenization boundaries,
            roadmap, and key risks behind AdBidCoin.
          </p>
          <span className="white-paper-meta">Discussion draft · 7-page PDF</span>
        </div>
        <div className="white-paper-actions">
          <a
            className="primary-link"
            href="/white-paper"
          >
            White paper overview
          </a>
          <a
            className="ghost-button"
            href="/attention-bid-white-paper-v6-1.pdf"
            download="Attention-Bid-White-Paper-v6-1.pdf"
          >
            Download PDF
          </a>
        </div>
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
            startsAt={currentAuction.startsAt}
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
              {!nextAuction.isHouseBid && nextAuction.highestBid > 0 && (
                <small>
                  {nextAuction.highestEffectiveBid.toFixed(2)} effective at{" "}
                  {nextAuction.leadingBidMultiplier
                    .toFixed(3)
                    .replace(/\.?0+$/, "")}x
                </small>
              )}
            </div>
          </div>

          <section className="platform-stats" aria-label="AdBidCoin totals">
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
            currentHighestEffectiveBid={nextAuction.highestEffectiveBid}
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
            highestEffectiveBid={nextAuction.highestEffectiveBid}
            bidMultiplier={nextAuction.leadingBidMultiplier}
            quietBalance={nextAuction.leadingQuietBalance}
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
                          ? "AdBidCoin House"
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
                    <strong>
                      {bid.amountUsdc.toFixed(2)} USDC
                      {bid.bidSource === "user" && (
                        <small className="effective-bid-label">
                          {bid.bidMultiplier.toFixed(3).replace(/\.?0+$/, "")}x
                          = {bid.effectiveBidUsdc.toFixed(2)} effective
                        </small>
                      )}
                    </strong>
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
              <li>Bid USDC for the next 30-minute block.</li>
              <li>
                Your connected wallet&apos;s verified QUIET balance adds
                proportional bid power, up to 10x.
              </li>
              <li>Highest effective bid wins when the timer ends.</li>
              <li>Bids are final. Losing bids are not refunded.</li>
              <li>Approved winner content appears on the homepage.</li>
              <li>
                Empty rounds may receive one clearly labeled, operator-funded
                0.25 USDC house bid after ten minutes.
              </li>
            </ol>
          </section>
        </aside>
      </section>

      <SiteFooter />
    </main>
  );
}
