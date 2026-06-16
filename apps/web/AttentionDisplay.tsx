type Props = {
  title: string;
  description: string;
  url: string;
};

export default function AttentionDisplay({
  title,
  description,
  url,
}: Props) {
  return (
    <div
      style={{
        border: "3px solid #00ff99",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "24px",
      }}
    >
      <h2>Current Attention Block</h2>

      <h3>{title || "No Attention Block Yet"}</h3>

      <p>{description}</p>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#00ff99",
            fontWeight: "bold",
          }}
        >
          Visit Link →
        </a>
      )}
    </div>
  );
}
