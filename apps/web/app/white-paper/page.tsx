import type { Metadata } from "next";
import SiteFooter from "../../SiteFooter";
import Brand from "../../Brand";

export const metadata: Metadata = {
  title: "White Paper",
  description:
    "Read the AdBidCoin white paper: 30-minute auction design, QUIET bid power, Solana and USDC infrastructure, company roadmap, funding approach, and risks.",
  alternates: { canonical: "/white-paper" },
};

const WHITE_PAPER_URL = "/attention-bid-white-paper-v6-1.pdf";

const FAQ_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is AdBidCoin?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AdBidCoin is a live marketplace where USDC bidders compete to control the next 30-minute homepage attention block, with verified QUIET balances providing proportional bid power.",
      },
    },
    {
      "@type": "Question",
      name: "Who operates AdBidCoin?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AdBidCoin is operated by Attention Bid, Inc., a Delaware C corporation.",
      },
    },
    {
      "@type": "Question",
      name: "Does QUIET bid power represent Attention Bid shares?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. QUIET bid power is a product utility based on a wallet-balance snapshot. It does not represent Attention Bid equity, revenue rights, dividends, or governance.",
      },
    },
  ],
};

export default function WhitePaperPage() {
  return (
    <main className="page-shell content-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_STRUCTURED_DATA).replace(/</g, "\\u003c"),
        }}
      />

      <nav className="content-nav" aria-label="White paper page navigation">
        <Brand />
        <div>
          <a href="/">Live auction</a>
          <a href="/about">Company</a>
        </div>
      </nav>

      <header className="content-hero document-hero">
        <span className="eyebrow">White paper · Version 6.1</span>
        <h1>The market for the next 30 minutes of attention.</h1>
        <p>
          The updated paper covers AdBidCoin&apos;s live auction design, its
          operator Attention Bid, Inc., the growth thesis, funding pathways,
          tokenization constraints, infrastructure, roadmap, and major risks.
        </p>
        <div className="document-actions">
          <a
            className="primary-link"
            href={WHITE_PAPER_URL}
            target="_blank"
            rel="noreferrer"
          >
            Read version 6.1 <span aria-hidden="true">↗</span>
          </a>
          <a
            className="ghost-button"
            href={WHITE_PAPER_URL}
            download="AdBidCoin-White-Paper-v6-1.pdf"
          >
            Download PDF
          </a>
        </div>
      </header>

      <section className="paper-summary" aria-label="White paper contents">
        <article>
          <span>01</span>
          <h2>Market design</h2>
          <p>Why scarce, renewable attention can support visible price discovery.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Live infrastructure</h2>
          <p>How Solana, USDC, and non-custodial QUIET snapshots support settlement and bid power.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Company and funding</h2>
          <p>How the Delaware corporation can pursue grants and compliant financing.</p>
        </article>
        <article>
          <span>04</span>
          <h2>Tokenization boundaries</h2>
          <p>Why tokenized shares remain securities and require a dedicated legal path.</p>
        </article>
      </section>

      <section className="content-cta paper-disclaimer">
        <div>
          <span className="eyebrow">Discussion draft</span>
          <h2>Read the claims and the risks.</h2>
          <p>
            The white paper is informational. It is not legal, tax, or
            investment advice and is not an offer to buy or sell a security,
            token, or other financial instrument.
          </p>
        </div>
        <a className="primary-link" href="/">
          Open the live auction
        </a>
      </section>

      <SiteFooter />
    </main>
  );
}
