import { HOUSE_NAME } from "./lib/house";
import { getSolscanTransactionUrl } from "./lib/solscan";

interface Props {
  winner: string | null;
  highestBid: number;
  highestEffectiveBid?: number;
  bidMultiplier?: number;
  quietBalance?: number;
  auctionId: string;
  isHouseBid?: boolean;
  houseBidAmount?: number;
  housePaymentSignature?: string | null;
}

function shortWallet(wallet: string | null) {
  if (!wallet) return "No leading bidder yet";
  return `${wallet.slice(0, 4)}...${wallet.slice(-5)}`;
}

export default function AttentionOwner({
  winner,
  highestBid,
  highestEffectiveBid = 0,
  bidMultiplier = 1,
  quietBalance = 0,
  auctionId,
  isHouseBid = false,
  houseBidAmount = 0,
  housePaymentSignature = null,
}: Props) {
  return (
    <section className={`leader-card${isHouseBid ? " house-leader" : ""}`}>
      <span className="eyebrow">Next block leader</span>
      <h2>{isHouseBid ? HOUSE_NAME : shortWallet(winner)}</h2>
      <dl>
        <div>
          <dt>{isHouseBid ? "House bid" : "Current bid"}</dt>
          <dd>
            {isHouseBid
              ? `${houseBidAmount.toFixed(2)} USDC`
              : `${highestBid.toFixed(2)} USDC`}
          </dd>
        </div>
        {!isHouseBid && winner && (
          <div>
            <dt>QUIET bid power</dt>
            <dd>{bidMultiplier.toFixed(3).replace(/\.?0+$/, "")}x</dd>
          </div>
        )}
        {!isHouseBid && winner && (
          <div>
            <dt>Effective bid</dt>
            <dd>{highestEffectiveBid.toFixed(2)} USDC</dd>
          </div>
        )}
        <div>
          <dt>Auction ID</dt>
          <dd>{auctionId}</dd>
        </div>
      </dl>
      {!isHouseBid && winner && (
        <p className="bid-power-disclosure">
          Snapshot: {quietBalance.toLocaleString(undefined, {
            maximumFractionDigits: 3,
          })} QUIET
        </p>
      )}
      {isHouseBid && (
        <>
          <p className="house-disclosure">
            Operator funded · A user can replace it with a 0.25 USDC bid
          </p>
          {housePaymentSignature && (
            <a
              className="house-receipt"
              href={getSolscanTransactionUrl(housePaymentSignature)}
              target="_blank"
              rel="noreferrer"
            >
              View house transaction
            </a>
          )}
        </>
      )}
    </section>
  );
}
