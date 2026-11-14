import React from "react";
import { ImageResponse } from "next/og";
import { getAttentionBlockReport } from "../../../../../lib/reports";

export const runtime = "nodejs";

const element = React.createElement;

export async function GET(_request: Request, context: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await context.params;
  const report = await getAttentionBlockReport(auctionId);
  if (!report) return new Response("Report not found.", { status: 404 });
  const metric = (label: string, value: string) => element("div", { style: { display: "flex", flexDirection: "column", padding: "12px 15px", border: "2px solid #1bd6ff66", borderRadius: "16px", background: "#110b24" } }, element("span", { style: { color: "#b9b4cf", fontSize: 16, textTransform: "uppercase" } }, label), element("strong", { style: { color: "#23f06b", fontSize: 27 } }, value));
  const start = new Date(report.startsAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const end = new Date(report.endsAt).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
  return new ImageResponse(
    element("div", { style: { width: "1200px", height: "630px", display: "flex", flexDirection: "column", padding: "54px", color: "white", background: "linear-gradient(135deg,#13051d,#07172a 65%,#241006)", fontFamily: "Arial" } },
      element("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        element("div", { style: { display: "flex", flexDirection: "column" } }, element("span", { style: { color: "#ffd43b", fontSize: 24, fontWeight: 800 } }, "ADBIDCOIN PERFORMANCE REPORT"), element("strong", { style: { fontSize: 54 } }, `ATTENTION BLOCK #${report.blockSequence}`)),
        element("span", { style: { color: report.isRepeat ? "#ffd43b" : "#23f06b", fontSize: 22, border: "2px solid currentColor", borderRadius: "999px", padding: "10px 18px" } }, report.isRepeat ? "REPEAT APPEARANCE" : "NEW AUCTION WIN")
      ),
      element("div", { style: { display: "flex", gap: "26px", marginTop: "28px", flex: 1 } },
        report.imageUrl ? element("img", { src: report.imageUrl, style: { width: "320px", height: "300px", objectFit: "cover", borderRadius: "20px" } }) : element("div", { style: { width: "320px", height: "300px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "20px", background: "#100a22", color: "#b9b4cf" } }, "Image unavailable"),
        element("div", { style: { display: "flex", flex: 1, flexDirection: "column" } }, element("h1", { style: { margin: 0, fontSize: 42, lineHeight: 1.05 } }, report.title), element("p", { style: { color: "#b9b4cf", fontSize: 20 } }, `${start}–${end} PT · ${report.blockAuctionId}`), element("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "auto" } }, metric("Winning bid", report.winningBidUsdc === null ? "N/A" : `${report.winningBidUsdc.toFixed(2)} USDC`), metric("Impressions", String(report.impressions)), metric("Unique viewers", report.uniqueViewers === null ? "Unavailable" : String(report.uniqueViewers)), metric("Link clicks", String(report.linkClicks)), metric("CTR", report.clickThroughRate === null ? "Unavailable" : `${report.clickThroughRate.toFixed(1)}%`), metric("Cost / click", report.costPerClick === null ? "Unavailable" : `${report.costPerClick.toFixed(2)} USDC`)))
      ),
      element("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", fontSize: 24 } }, element("strong", { style: { color: "#ffd43b" } }, "Bid for the current 30-minute block"), element("strong", null, "adbidcoin.com/#auction"))
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=31536000, immutable", "Content-Disposition": `inline; filename="${auctionId}-report.png"` } }
  );
}
