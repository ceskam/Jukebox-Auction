const X_URL = "https://x.com/attentionbid";

export default function CompanyCard() {
  return (
    <section
      className="company-card"
      id="company"
      aria-labelledby="company-title"
    >
      <div>
        <span className="eyebrow">Now incorporated</span>
        <h2 id="company-title">Built by Attention Bid, Inc.</h2>
        <p>
          Attention Bid, Inc. is a Delaware C corporation building an open,
          observable marketplace for time-bound digital attention.
        </p>
      </div>
      <div className="company-actions">
        <a className="primary-link" href="/about">
          About the company
        </a>
        <a className="ghost-button" href={X_URL} target="_blank" rel="noreferrer">
          Partnership inquiries <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="company-disclaimer">
        This website does not offer company shares, tokens, or other securities.
      </p>
    </section>
  );
}
