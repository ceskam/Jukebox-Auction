import "./globals.css";
import "./upload.css";
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://attention-bid2-ten.vercel.app";
const SITE_DESCRIPTION =
  "Bid USDC on Solana for the next 30 minutes of homepage attention. QUIET holders receive up to 10x bid power.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Attention Bid",
  title: {
    default: "Attention Bid | The 30-Minute Attention Auction",
    template: "%s | Attention Bid",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Attention Bid",
    "attention auction",
    "Solana auction",
    "USDC auction",
    "homepage advertising",
    "crypto advertising",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Attention Bid",
    title: "Attention Bid | Win the Next 30 Minutes",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Attention Bid - bid for the next 30 minutes of attention",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@attentionbid",
    creator: "@attentionbid",
    title: "Attention Bid | Win the Next 30 Minutes",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const WEBSITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Attention Bid",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  sameAs: ["https://x.com/attentionbid"],
};

const ORGANIZATION_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Attention Bid, Inc.",
  legalName: "Attention Bid, Inc.",
  url: SITE_URL,
  foundingDate: "2026",
  foundingLocation: {
    "@type": "Place",
    name: "Delaware, United States",
  },
  sameAs: [
    "https://x.com/attentionbid",
    "https://t.me/+dVMl7qg8gJJlY2E0",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(WEBSITE_STRUCTURED_DATA).replace(
              /</g,
              "\\u003c"
            ),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_STRUCTURED_DATA).replace(
              /</g,
              "\\u003c"
            ),
          }}
        />
        {children}
      </body>
    </html>
  );
}
