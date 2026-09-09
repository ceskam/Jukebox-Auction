import AttentionImage from "./AttentionImage";
import TrackedAttentionLink from "./TrackedAttentionLink";

type Props = {
  auctionId: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  isHouseSponsored?: boolean;
};

function getHouseCallToAction(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname === "t.me") return "Join Quiet Coin on Telegram";
    if (hostname === "livepayout.org" || hostname === "www.livepayout.org") {
      return "Explore LivePayout";
    }
    if (hostname === "cash.app") return "Visit the Cash App referral";
  } catch {
    // House URLs are validated before they are stored; retain a safe fallback.
  }

  return "Visit sponsor";
}

export default function AttentionDisplay({
  auctionId,
  title,
  description,
  url,
  imageUrl,
  isHouseSponsored = false,
}: Props) {
  return (
    <section className={`attention-card${isHouseSponsored ? " house-attention" : ""}`}>
      {imageUrl && (
        <AttentionImage
          className="attention-image"
          src={imageUrl}
          alt={title ? `${title} preview` : "Attention block preview"}
        />
      )}

      <div className="attention-copy">
        <span className="eyebrow">
          {isHouseSponsored ? "Current attention · House sponsored" : "Current attention"}
        </span>
        <h2>{title || "The next winner controls this space"}</h2>
        <p>
          {description ||
            "Bid in USDC for the next 15-minute block and put your link, launch, or message in front of everyone watching."}
        </p>

        {isHouseSponsored && (
          <p className="house-disclosure">
            Operator-funded house bid · Excluded from organic bid totals
          </p>
        )}

        {isHouseSponsored && url && (
          <a
            className="primary-link"
            href={url}
            target="_blank"
            rel="sponsored noreferrer"
          >
            {getHouseCallToAction(url)} <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>

      {url && !isHouseSponsored && (
        <TrackedAttentionLink auctionId={auctionId} url={url} />
      )}
    </section>
  );
}
