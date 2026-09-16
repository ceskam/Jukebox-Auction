import type { Metadata } from "next";
import SiteFooter from "../../SiteFooter";

export const metadata: Metadata = {
  title: "White Paper",
  description:
    "Read the Attention Bid white paper: market thesis, 15-minute auction design, Solana and USDC infrastructure, company roadmap, funding approach, and risks.",
  alternates: { canonical: "/white-paper" },
};

const WHITE_PAPER_URL = "/attention-bid-white-paper-v6.pdf";

const FAQ_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Attention Bid?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Attention Bid is a live marketplace where verified USDC bidders compete to control the next 15-minute homepage attention block.",
      },
    },
    {
      "@type": "Question",
      name: "Who operates Attention Bid?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Attention Bid is operated by Attention Bid, Inc., a Delaware C corporation.",
      },
    },
    {
      "@type": "Question",
      name: "Does Attention Bid currently offer a token or company shares?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The website does not currently offer company shares, tokens, or other securities.",
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
        <a className="brand" href="/">
          <span>Attention</span> Bid
        </a>
        <div>
          <a href="/">Live auction</a>
          <a href="/about">Company</a>
        </div>
      </nav>

      <header className="content-hero document-hero">
        <span className="eyebrow">White paper · Version 6.0</span>
        <h1>The market for the next 15 minutes of attention.</h1>
        <p>
          The updated paper covers the live auction design, Attention Bid,
          Inc., the growth thesis, funding pathways, tokenization constraints,
          infrastructure, roadmap, and major risks.
        </p>
        <div className="document-actions">
          <a
            className="primary-link"
            href={WHITE_PAPER_URL}
            target="_blank"
            rel="noreferrer"
          >
            Read version 6.0 <span aria-hidden="true">↗</span>
          </a>
          <a
            className="ghost-button"
            href={WHITE_PAPER_URL}
            download="Attention-Bid-White-Paper-v6.pdf"
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
          <p>How Solana and native USDC support verifiable settlement.</p>
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
