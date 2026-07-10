import AttentionImage from "./AttentionImage";

type Props = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
};

export default function AttentionDisplay({
  title,
  description,
  url,
  imageUrl,
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
        <span className="eyebrow">Current attention</span>
        <h2>{title || "The next winner controls this space"}</h2>
        <p>
          {description ||
            "Bid in USDC for the next 15-minute block and put your link, launch, or message in front of everyone watching."}
        </p>
      </div>

      {url && (
        <a className="primary-link" href={url} target="_blank" rel="noreferrer">
          Visit link
        </a>
      )}
    </section>
  );
}
