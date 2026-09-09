import { ImageResponse } from "next/og";

export const alt = "Attention Bid — bid for the next 15 minutes of attention";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: -1,
              textTransform: "uppercase",
            }}
          >
            <span>ATTENTION&nbsp;</span>
            <span style={{ color: "#ffd43b" }}>BID</span>
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
            ATTENTION IS VALUABLE. BID FOR IT.
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
            Every 15 minutes, the highest verified bidder wins the live homepage
            feature block.
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
            Watch the live auction →
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
