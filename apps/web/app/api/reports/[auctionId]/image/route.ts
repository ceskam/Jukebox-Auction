import React from "react";
import { ImageResponse } from "next/og";
import { getAttentionBlockReport } from "../../../../../lib/reports";

export const runtime = "nodejs";

const element = React.createElement;
const MAX_REPORT_IMAGE_BYTES = 5 * 1024 * 1024;

function approvedImageHosts() {
  const hosts = new Set<string>(["adbidcoin.com", "www.adbidcoin.com"]);
  for (const value of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!value) continue;
    try {
      hosts.add(new URL(value).hostname.toLowerCase());
    } catch {
      // A missing optional host should not prevent the report from rendering.
    }
  }
  return hosts;
}

async function loadFeaturedImage(imageUrl: string) {
  if (!imageUrl) return "";
  try {
    const url = new URL(imageUrl, process.env.NEXT_PUBLIC_SITE_URL ?? "https://adbidcoin.com");
    if (url.protocol !== "https:" || !approvedImageHosts().has(url.hostname.toLowerCase())) return "";
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4_000),
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
    });
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !/^image\/(png|jpe?g|webp|gif)$/i.test(contentType)) return "";
    if (contentLength > MAX_REPORT_IMAGE_BYTES) return "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_REPORT_IMAGE_BYTES) return "";
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

function metric(label: string, value: string) {
  return element(
    "div",
    {
      style: {
        display: "flex",
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        padding: "12px 14px",
        border: "2px solid #1bd6ff66",
        borderRadius: "14px",
        background: "#110b24",
      },
    },
    element("span", { style: { color: "#b9b4cf", fontSize: 15, fontWeight: 700, textTransform: "uppercase" } }, label),
    element("strong", { style: { color: "#23f06b", fontSize: 27, marginTop: 4 } }, value)
  );
}

export async function GET(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await context.params;
  const report = await getAttentionBlockReport(auctionId);
  if (!report) return new Response("Report not found.", { status: 404 });

  const featuredImage = await loadFeaturedImage(report.imageUrl);
  const start = new Date(report.startsAt).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(report.endsAt).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });
  const firstMetrics = [
    metric("Winning bid", report.winningBidUsdc === null ? "N/A" : `${report.winningBidUsdc.toFixed(2)} USDC`),
    metric("Impressions", String(report.impressions)),
    metric("Unique viewers", report.uniqueViewers === null ? "Unavailable" : String(report.uniqueViewers)),
  ];
  const secondMetrics = [
    metric("Link clicks", String(report.linkClicks)),
    metric("CTR", report.clickThroughRate === null ? "Unavailable" : `${report.clickThroughRate.toFixed(1)}%`),
    metric("Cost / click", report.costPerClick === null ? "Unavailable" : `${report.costPerClick.toFixed(2)} USDC`),
  ];
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new ImageResponse(
    element(
      "div",
      {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          padding: "46px 50px",
          color: "white",
          background: "linear-gradient(135deg,#13051d,#07172a 65%,#241006)",
          fontFamily: "Arial",
        },
      },
      element(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        element(
          "div",
          { style: { display: "flex", flexDirection: "column" } },
          element("span", { style: { color: "#ffd43b", fontSize: 22, fontWeight: 800 } }, "ADBIDCOIN · VERIFIED PERFORMANCE"),
          element("strong", { style: { fontSize: 48, marginTop: 3 } }, `ATTENTION BLOCK #${report.blockSequence}`)
        ),
        element(
          "span",
          {
            style: {
              color: report.isRepeat ? "#ffd43b" : "#23f06b",
              fontSize: 20,
              fontWeight: 800,
              border: "2px solid currentColor",
              borderRadius: "999px",
              padding: "9px 16px",
            },
          },
          report.isRepeat ? "REPEAT APPEARANCE" : "NEW AUCTION WIN"
        )
      ),
      element(
        "div",
        { style: { display: "flex", gap: "24px", marginTop: "24px", flex: 1 } },
        featuredImage
          ? element("img", { src: featuredImage, style: { width: "310px", height: "292px", objectFit: "cover", borderRadius: "18px" } })
          : element(
              "div",
              {
                style: {
                  width: "310px",
                  height: "292px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #ff2ed566",
                  borderRadius: "18px",
                  background: "linear-gradient(145deg,#24103b,#07172a)",
                  color: "#b9b4cf",
                },
              },
              element("strong", { style: { color: "#ffd43b", fontSize: 44 } }, "AD"),
              element("span", { style: { fontSize: 18, marginTop: 10 } }, "Featured image unavailable")
            ),
        element(
          "div",
          { style: { display: "flex", flex: 1, minWidth: 0, flexDirection: "column" } },
          element("h1", { style: { margin: 0, fontSize: 38, lineHeight: 1.05 } }, report.title),
          element("p", { style: { color: "#b9b4cf", fontSize: 18, margin: "10px 0 12px" } }, `${start}–${end} PT · ${report.blockAuctionId}`),
          element("div", { style: { display: "flex", gap: "9px" } }, ...firstMetrics),
          element("div", { style: { display: "flex", gap: "9px", marginTop: "9px" } }, ...secondMetrics)
        )
      ),
      element(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", fontSize: 22 } },
        element("strong", { style: { color: "#ffd43b" } }, "Bid for the next 30-minute attention block"),
        element("strong", null, "adbidcoin.com/#auction")
      )
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${auctionId}-report.png"`,
      },
    }
  );
}
