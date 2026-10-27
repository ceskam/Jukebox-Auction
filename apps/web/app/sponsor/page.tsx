import Brand from "../../Brand";
import SiteFooter from "../../SiteFooter";
import SponsorPackages from "../../SponsorPackages";

export const metadata = {
  title: "Automatic Sponsored Slots",
  description: "Purchase a reviewed AdBidCoin automatic homepage sponsor package.",
};

export default function SponsorPage() {
  return (
    <main className="page-shell sponsor-page">
      <nav className="top-nav"><Brand /><a className="ghost-button" href="/">Back to auction</a></nav>
      <header className="sponsor-hero">
        <span className="eyebrow">Reserved house-slot inventory</span>
        <h1>Stay in the rotation for a year.</h1>
        <p>
          Buy a reviewed automatic sponsor package with USDC. Your campaign fills available house-sponsored
          attention blocks without replacing a paid auction winner.
        </p>
      </header>
      <SponsorPackages />
      <SiteFooter />
    </main>
  );
}
