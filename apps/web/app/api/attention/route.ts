import db from "../../../lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auctionId = searchParams.get("auctionId");

  if (!auctionId) {
    return Response.json(null);
  }

  const content = db
    .prepare(
      `
      SELECT *
      FROM attention_content
      WHERE auction_id = ?
      LIMIT 1
      `
    )
    .get(auctionId);

  return Response.json(content ?? null);
}

export async function POST(request: Request) {
  const body = await request.json();

  db.prepare(
    `
    INSERT INTO attention_content (
      auction_id,
      wallet,
      title,
      description,
      url,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(auction_id) DO UPDATE SET
      wallet = excluded.wallet,
      title = excluded.title,
      description = excluded.description,
      url = excluded.url,
      created_at = excluded.created_at
    `
  ).run(
    body.auctionId,
    body.wallet,
    body.title,
    body.description,
    body.url,
    new Date().toISOString()
  );

  return Response.json({
    success: true,
  });
}
