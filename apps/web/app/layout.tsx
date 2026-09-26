import "./globals.css";
import "./upload.css";
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://adbidcoin.com";
const SITE_DESCRIPTION =
  "AdBidCoin is the live 30-minute attention auction. Bid USDC on Solana, with up to 10x bid power for verified QUIET holders.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "AdBidCoin",
  title: {
    default: "AdBidCoin | The 30-Minute Attention Auction",
    template: "%s | AdBidCoin",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "AdBidCoin",
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
    siteName: "AdBidCoin",
    title: "AdBidCoin | Win the Next 30 Minutes",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "AdBidCoin - bid for the next 30 minutes of attention",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@attentionbid",
    creator: "@attentionbid",
    title: "AdBidCoin | Win the Next 30 Minutes",
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
  name: "AdBidCoin",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: `${SITE_URL}/adbidcoin-logo.png`,
  sameAs: ["https://x.com/attentionbid"],
};

const ORGANIZATION_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Attention Bid, Inc.",
  legalName: "Attention Bid, Inc.",
  alternateName: "AdBidCoin",
  url: SITE_URL,
  logo: `${SITE_URL}/adbidcoin-logo.png`,
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
