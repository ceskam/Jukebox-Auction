import Brand from "../../Brand";
import SiteFooter from "../../SiteFooter";

export const metadata = {
  title: "Art Drop Rules",
  description: "Rules and safety disclosures for AdBidCoin Art Drops.",
  alternates: { canonical: "/art-drop-rules" },
};

export default function ArtDropRulesPage() {
  return (
    <main className="page-shell legal-page">
      <nav className="top-nav">
        <Brand />
        <div />
        <a className="ghost-button" href="/#art-drops">View Art Drops</a>
      </nav>

      <article className="legal-card">
        <span className="eyebrow">Beta program</span>
        <h1>AdBidCoin Art Drop Rules</h1>
        <p className="hint">Last updated October 27, 2026</p>

        <h2>How a drop works</h2>
        <p>
          When a drop is active, AdBidCoin displays a branded graphic containing a
          one-time code. The first eligible participant who connects and authenticates
          a supported Solana wallet, completes the human-verification step, enters the
          correct unexpired code, and receives an atomic reservation wins the stated
          USDC reward. Seeing or submitting a code does not guarantee payment.
        </p>

        <h2>Eligibility and limits</h2>
        <ul>
          <li>No purchase or bid is necessary to participate.</li>
          <li>Participants must remain active on AdBidCoin for at least five minutes before claiming.</li>
          <li>Participants must visit the latest house-sponsored post during the eligible session.</li>
          <li>Participants must be at least 18 and legally eligible in their location.</li>
          <li>One paid Art Drop per wallet during any rolling 30-day period.</li>
          <li>Automated claiming, multiple-wallet evasion, fraud, or interference is prohibited.</li>
          <li>AdBidCoin may pause, cancel, expire, or review a drop for security or legal reasons.</li>
        </ul>

        <h2>Wallet safety</h2>
        <p>
          AdBidCoin never asks for or publishes private keys, seed phrases, or recovery
          phrases. Wallet authentication uses a free signed message and does not authorize
          a transaction. Participants are responsible for using the official adbidcoin.com
          site and maintaining control of their receiving wallet.
        </p>

        <h2>Payment and availability</h2>
        <p>
          Rewards are operator-funded, subject to treasury availability, network operation,
          sanctions screening, and applicable law. A public Solana transaction signature is
          the payment receipt. Network delays or a payout-review state may delay completion.
          Taxes and reporting obligations are the recipient&apos;s responsibility.
        </p>

        <p className="legal-notice">
          These beta rules are operational disclosures, not legal advice. Attention Bid, Inc.
          should have qualified counsel review eligibility, geography, tax, privacy, and
          promotional-law requirements before broad public promotion.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
