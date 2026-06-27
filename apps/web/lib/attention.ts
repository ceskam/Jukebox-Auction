import db from "./db";
import { getAuctionById } from "./auction";

export type AttentionContent = {
  auctionId: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
  createdAt: string;
  updatedAt: string | null;
};

export function getAttentionContent(auctionId: string) {
  return db
    .prepare(
      `
      SELECT
        auction_id AS auctionId,
        wallet,
        title,
        description,
        url,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM attention_content
      WHERE auction_id = ?
      LIMIT 1
      `
    )
    .get(auctionId) as AttentionContent | undefined;
}

function normalizeUrl(url: string) {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch {
    return `https://${url}`;
  }
}

export function saveAttentionContent({
  auctionId,
  wallet,
  title,
  description,
  url,
}: {
  auctionId: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
}) {
  const auction = getAuctionById(auctionId);

  if (!wallet || wallet !== auction.winner) {
    return {
      success: false,
      message: "Only the winning wallet can edit this attention block.",
    };
  }

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const normalizedUrl = normalizeUrl(url.trim());

  if (!trimmedTitle) {
    return {
      success: false,
      message: "Add a title for your attention block.",
    };
  }

  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO attention_content (
      auction_id,
      wallet,
      title,
      description,
      url,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(auction_id) DO UPDATE SET
      wallet = excluded.wallet,
      title = excluded.title,
      description = excluded.description,
      url = excluded.url,
      updated_at = excluded.updated_at
    `
  ).run(
    auction.id,
    wallet,
    trimmedTitle,
    trimmedDescription,
    normalizedUrl,
    now,
    now
  );

  return {
    success: true,
    content: getAttentionContent(auction.id),
  };
}
