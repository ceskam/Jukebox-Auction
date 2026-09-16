import type { Metadata } from "next";
import SiteFooter from "../../SiteFooter";

export const metadata: Metadata = {
  title: "Company",
  description:
    "Learn about Attention Bid, Inc., the Delaware corporation building the live 15-minute attention auction.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="page-shell content-page">
      <nav className="content-nav" aria-label="Company page navigation">
        <a className="brand" href="/">
          <span>Attention</span> Bid
        </a>
        <div>
          <a href="/">Live auction</a>
          <a href="/white-paper">White paper</a>
        </div>
      </nav>

      <header className="content-hero">
        <span className="eyebrow">Attention Bid, Inc.</span>
        <h1>The company building the attention market.</h1>
        <p>
          Attention Bid, Inc. is a Delaware C corporation developing a
          perpetual auction where the highest verified USDC bidder controls the
          next 15 minutes of the public homepage attention block.
        </p>
      </header>

      <section className="content-grid" aria-label="Company overview">
        <article>
          <span className="eyebrow">Mission</span>
          <h2>Make attention observable.</h2>
          <p>
            The product turns a clearly defined interval of digital attention
            into a transparent market event with visible bids, a countdown,
            an on-chain payment receipt, and a new winning message every block.
          </p>
        </article>
        <article>
          <span className="eyebrow">Status</span>
          <h2>Live beta.</h2>
          <p>
            The auction, USDC payment verification, winner publishing,
            moderation controls, and disclosed operator-funded house activity
            are running in production while the company measures retention,
            bidding activity, and audience growth.
          </p>
        </article>
        <article>
          <span className="eyebrow">Company</span>
          <h2>Incorporated in Delaware.</h2>
          <p>
            The corporation is the operating company for product development,
            platform operations, security, moderation, partnerships, and future
            financing activities.
          </p>
        </article>
        <article>
          <span className="eyebrow">Funding</span>
          <h2>Building before offering.</h2>
          <p>
            Attention Bid may pursue grants or private financing under formal
            documentation and applicable law. No investment, company share, or
            token is offered through this website.
          </p>
        </article>
      </section>

      <section className="content-cta">
        <div>
          <span className="eyebrow">Follow the build</span>
          <h2>Watch the market develop in public.</h2>
          <p>
            Join the community for product updates, auction activity, and future
            partnership announcements.
          </p>
        </div>
        <div>
          <a
            className="primary-link"
            href="https://x.com/attentionbid"
            target="_blank"
            rel="noreferrer"
          >
            Follow on X <span aria-hidden="true">↗</span>
          </a>
          <a
            className="ghost-button"
            href="https://t.me/+dVMl7qg8gJJlY2E0"
            target="_blank"
            rel="noreferrer"
          >
            Join Telegram <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
