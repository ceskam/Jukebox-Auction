import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "AdBidCoin - bid for the next 30 minutes of attention";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const logoData = await readFile(
    path.join(process.cwd(), "app", "apple-icon.png")
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 68px",
          color: "white",
          background:
            "linear-gradient(135deg, #08040f 0%, #260b31 48%, #032530 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -170,
            right: -110,
            width: 470,
            height: 470,
            borderRadius: 999,
            background: "rgba(27, 214, 255, 0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -240,
            left: 250,
            width: 590,
            height: 590,
            borderRadius: 999,
            background: "rgba(255, 46, 213, 0.2)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <img
              src={logoSrc}
              alt=""
              width="86"
              height="86"
              style={{ borderRadius: 20, boxShadow: "0 0 30px rgba(27, 214, 255, 0.35)" }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: -1,
                textTransform: "uppercase",
              }}
            >
              <span style={{ color: "white" }}>AD</span>
              <span style={{ color: "#ffd43b" }}>BIDCOIN</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              border: "2px solid rgba(27, 214, 255, 0.55)",
              borderRadius: 999,
              padding: "12px 20px",
              color: "#77eaff",
              background: "rgba(27, 214, 255, 0.1)",
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            LIVE BETA · SOLANA + USDC
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              maxWidth: 980,
              fontSize: 82,
              fontWeight: 900,
              lineHeight: 0.96,
              letterSpacing: -4,
              textTransform: "uppercase",
            }}
          >
            OWN THE NEXT BLOCK.
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 820,
              color: "#d2cde1",
              fontSize: 28,
              lineHeight: 1.35,
            }}
          >
            Every 30 minutes, the highest effective bidder wins. QUIET holders
            receive up to 10x bid power.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              borderRadius: 14,
              padding: "16px 24px",
              color: "#090511",
              background: "linear-gradient(90deg, #ff2ed5, #ff8a33, #ffd43b)",
              fontSize: 22,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Visit adbidcoin.com →
          </div>
          <div
            style={{
              display: "flex",
              color: "#23f06b",
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            Opening bid: 0.25 USDC
          </div>
        </div>
      </div>
    ),
    size
  );
}
