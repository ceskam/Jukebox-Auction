import db from "../../../lib/db";

export async function GET() {
  const content = db
    .prepare(
      `
      SELECT *
      FROM attention_content
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get();

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
