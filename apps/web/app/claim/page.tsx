import Brand from "../../Brand";
import ClaimDrop from "../../ClaimDrop";
import SiteFooter from "../../SiteFooter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Claim an Art Drop",
  description:
    "Claim a limited AdBidCoin Art Drop using a one-time code and an authenticated Solana wallet.",
  alternates: { canonical: "/claim" },
  robots: { index: false, follow: false },
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const codeParam = params.code;
  const initialCode = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";

  return (
    <main className="page-shell claim-page">
      <nav className="top-nav">
        <Brand />
        <div />
        <a className="ghost-button" href="/#art-drops">
          View live drop
        </a>
      </nav>

      <ClaimDrop
        initialCode={initialCode}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
      />
      <SiteFooter />
    </main>
  );
}
