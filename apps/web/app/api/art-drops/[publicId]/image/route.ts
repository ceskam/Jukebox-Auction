import { getPublicArtDropById } from "../../../../../lib/art-drops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await context.params;
  const drop = await getPublicArtDropById(publicId).catch(() => undefined);
  if (!drop) return new Response("Art Drop not found.", { status: 404 });

  const reward = escapeXml(drop.rewardUsdc.toFixed(2));
  const claimCode = escapeXml(drop.claimCode);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title description">
      <title id="title">AdBidCoin ${reward} USDC Art Drop</title>
      <desc id="description">First valid claim wins. Use code ${claimCode} at adbidcoin.com/claim.</desc>
      <defs>
        <radialGradient id="purpleGlow" cx="20%" cy="18%" r="52%">
          <stop offset="0%" stop-color="#59104f" />
          <stop offset="100%" stop-color="#59104f" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="blueGlow" cx="82%" cy="22%" r="55%">
          <stop offset="0%" stop-color="#073653" />
          <stop offset="100%" stop-color="#073653" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#05030b" />
          <stop offset="100%" stop-color="#140925" />
        </linearGradient>
        <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1bd6ff" />
          <stop offset="52%" stop-color="#ff2ed5" />
          <stop offset="100%" stop-color="#ffd43b" />
        </linearGradient>
        <filter id="brandGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="14" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="codeGlow" x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width="1200" height="630" fill="url(#background)" />
      <rect width="1200" height="630" fill="url(#purpleGlow)" />
      <rect width="1200" height="630" fill="url(#blueGlow)" />
      <rect x="2" y="2" width="1196" height="626" rx="28" fill="none" stroke="#ff2ed5" stroke-opacity=".42" stroke-width="4" />

      <g transform="translate(64 52)">
        <rect width="72" height="72" rx="22" fill="url(#brand)" filter="url(#brandGlow)" />
        <text x="36" y="52" text-anchor="middle" fill="#05030b" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900">A</text>
        <text x="94" y="51" fill="#ffd43b" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900">Ad<tspan fill="#ffffff">BidCoin</tspan></text>
      </g>

      <text x="64" y="224" fill="#ffd43b" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" letter-spacing="1">FIRST VALID CLAIM WINS</text>
      <text x="64" y="324" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="900">${reward} USDC ART DROP</text>
      <text x="64" y="378" fill="#b9b4cf" font-family="Arial, Helvetica, sans-serif" font-size="29">Connect your wallet at adbidcoin.com/claim and enter the code below.</text>

      <rect x="64" y="442" width="1072" height="126" rx="24" fill="#04030d" fill-opacity=".86" stroke="#ffd43b" stroke-opacity=".85" stroke-width="3" />
      <text x="96" y="516" fill="#b9b4cf" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800">ONE-TIME CODE</text>
      <text x="1104" y="528" text-anchor="end" fill="#ffd43b" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="900" letter-spacing="8" filter="url(#codeGlow)">${claimCode}</text>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
