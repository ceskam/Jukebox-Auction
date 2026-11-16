import AttentionImage from "./AttentionImage";
import TrackedAttentionLink from "./TrackedAttentionLink";

type Props = {
  auctionId: string;
  blockAuctionId: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  isReposted?: boolean;
};

export default function AttentionDisplay({
  auctionId,
  blockAuctionId,
  title,
  description,
  url,
  imageUrl,
  isReposted = false,
}: Props) {
  return (
    <section className="attention-card">
      {imageUrl && (
        <AttentionImage
          className="attention-image"
          src={imageUrl}
          alt={title ? `${title} preview` : "Attention block preview"}
        />
      )}

      <div className="attention-copy">
        <span className="eyebrow">
          {isReposted
            ? "Latest winning auction post · Still live"
            : "Current winning auction post"}
        </span>
        <h2>{title || "The next winner controls this space"}</h2>
        <p>
          {description ||
            "Bid in USDC for the next 30-minute block and put your link, launch, or message in front of everyone watching."}
        </p>

        {url && (
          <TrackedAttentionLink
            auctionId={blockAuctionId}
            featuredContentAuctionId={auctionId}
            url={url}
          />
        )}
      </div>
    </section>
  );
}
