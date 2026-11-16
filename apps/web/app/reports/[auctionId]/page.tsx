import Brand from "../../../Brand";
import SiteFooter from "../../../SiteFooter";
import { getAttentionBlockReport } from "../../../lib/reports";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;
  const report = await getAttentionBlockReport(auctionId);
  if (!report) return <main className="page-shell"><Brand /><h1>Report not found</h1><a className="primary-link" href="/#auction">Bid in the current auction</a></main>;
  return <main className="page-shell report-page">
    <Brand />
    <span className="eyebrow">Verified attention-block performance</span>
    <h1>Block #{report.blockSequence} report</h1>
    <p>{report.isRepeat ? "Repeat appearance of the previous winning post." : "New auction-winning post."}</p>
    <img className="report-preview" src={`/api/reports/${encodeURIComponent(auctionId)}/image`} alt={`Performance report for ${auctionId}`} />
    <div className="report-actions">
      <a className="primary-link" href={`/api/reports/${encodeURIComponent(auctionId)}/image?download=1`} download={`${auctionId}-report.png`}>Download report</a>
      <a className="primary-link" href={`https://x.com/intent/post?text=${encodeURIComponent(`AdBidCoin attention block #${report.blockSequence} report`)}&url=${encodeURIComponent(`https://adbidcoin.com/reports/${auctionId}`)}`} target="_blank" rel="noreferrer">Share on X</a>
      <a className="primary-link" href="/#auction">Bid in the Current Auction</a>
    </div>
    <p className="hint">Metrics use verified first-party platform events. Unavailable values are labeled in the report.</p>
    <SiteFooter />
  </main>;
}
