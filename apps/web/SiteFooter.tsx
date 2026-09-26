import Brand from "./Brand";

const X_URL = "https://x.com/attentionbid";
const TELEGRAM_URL = "https://t.me/+dVMl7qg8gJJlY2E0";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Brand className="footer-brand" />
        <p>
          AdBidCoin is operated by Attention Bid, Inc., a Delaware C
          corporation. Live beta on Solana using USDC.
        </p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/about">Company</a>
        <a href="/white-paper">White paper</a>
        <a href={X_URL} target="_blank" rel="noreferrer">
          X
        </a>
        <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
          Telegram
        </a>
      </nav>
      <p className="footer-legal">
        © 2026 Attention Bid, Inc. Bids are final. Nothing on this site is an
        offer to sell securities or tokens.
      </p>
    </footer>
  );
}
