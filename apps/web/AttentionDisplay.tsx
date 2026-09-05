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
      </div>

      {isHouseSponsored && (
        <p className="house-disclosure">
          Operator-funded house bid · Excluded from organic bid totals
        </p>
      )}

      {url &&
        (isHouseSponsored ? (
          <a
            className="primary-link"
            href={url}
            target="_blank"
            rel="sponsored noreferrer"
          >
            Visit sponsor
          </a>
        ) : (
          <TrackedAttentionLink auctionId={auctionId} url={url} />
        ))}
    </section>
  );
}
