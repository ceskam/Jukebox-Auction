import AttentionImage from "./AttentionImage";
import TrackedAttentionLink from "./TrackedAttentionLink";

export default function SponsorSpotlight({
  auctionId, title, description, url, imageUrl,
}: { auctionId: string; title: string; description: string; url: string; imageUrl: string }) {
  return (
    <section className="sponsor-spotlight" id="sponsored">
      {imageUrl && <AttentionImage className="sponsor-spotlight-image" src={imageUrl} alt={`${title} sponsor graphic`} />}
      <div>
        <span className="eyebrow">Latest house-sponsored post</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="sponsor-spotlight-actions">
          <TrackedAttentionLink auctionId={auctionId} url={url} label="Visit sponsor" sponsored />
          <a className="ghost-button" href="/sponsor">Buy an auto slot</a>
        </div>
      </div>
    </section>
  );
}
