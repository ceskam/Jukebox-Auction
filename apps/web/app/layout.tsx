import "./globals.css";
import "./upload.css";

export const metadata = {
  title: "Attention Bid",
  description: "Continuous 15-minute USDC auctions for public homepage attention.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
