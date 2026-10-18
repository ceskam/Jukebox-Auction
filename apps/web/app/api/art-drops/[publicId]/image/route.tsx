import { ImageResponse } from "next/og";

import { getPublicArtDropById } from "../../../../../lib/art-drops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await context.params;
  const drop = await getPublicArtDropById(publicId).catch(() => undefined);
  if (!drop) return new Response("Art Drop not found.", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "white",
          background:
            "radial-gradient(circle at 20% 18%, #59104f 0%, transparent 35%), radial-gradient(circle at 82% 22%, #073653 0%, transparent 38%), linear-gradient(145deg, #05030b 0%, #140925 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 900,
              color: "#05030b",
              background: "linear-gradient(135deg, #1bd6ff, #ff2ed5 52%, #ffd43b)",
              boxShadow: "0 0 36px rgba(255,46,213,.5)",
            }}
          >
            A
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 900 }}>
            <span style={{ color: "#ffd43b" }}>Ad</span>BidCoin
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#ffd43b", fontSize: 30, fontWeight: 900 }}>
            FIRST VALID CLAIM WINS
          </div>
          <div style={{ fontSize: 86, lineHeight: 1, fontWeight: 900 }}>
            {drop.rewardUsdc.toFixed(2)} USDC ART DROP
          </div>
          <div style={{ color: "#b9b4cf", fontSize: 30 }}>
            Connect your wallet at adbidcoin.com/claim and enter the code below.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "3px solid rgba(255,212,59,.8)",
            borderRadius: 24,
            padding: "28px 34px",
            background: "rgba(4,3,13,.82)",
            boxShadow: "0 0 44px rgba(255,212,59,.22)",
          }}
        >
          <span style={{ color: "#b9b4cf", fontSize: 25, fontWeight: 800 }}>
            ONE-TIME CODE
          </span>
          <span style={{ color: "#ffd43b", fontSize: 58, fontWeight: 900, letterSpacing: 8 }}>
            {drop.claimCode}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    }
  );
}
