import Database from "better-sqlite3";

const db = new Database("attention-bid.db", {
  timeout: 5000,
});

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS auctions (
    id TEXT PRIMARY KEY,
    sequence INTEGER NOT NULL UNIQUE,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auction_id TEXT NOT NULL,
    wallet TEXT NOT NULL,
    amount INTEGER,
    amount_usdc REAL,
    payment_status TEXT NOT NULL DEFAULT 'verified',
    payment_signature TEXT,
    verification_provider TEXT NOT NULL DEFAULT 'demo-solana-usdc',
    created_at TEXT NOT NULL,
    FOREIGN KEY (auction_id) REFERENCES auctions(id)
  );

  CREATE TABLE IF NOT EXISTS attention_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auction_id TEXT NOT NULL UNIQUE,
    wallet TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (auction_id) REFERENCES auctions(id)
  );
`);

function getColumns(tableName: string) {
  return new Set(
    (db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]).map(
      (column) => column.name
    )
  );
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = getColumns(tableName);

  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn("bids", "amount_usdc", "REAL");
ensureColumn("bids", "payment_status", "TEXT NOT NULL DEFAULT 'verified'");
ensureColumn("bids", "payment_signature", "TEXT");
ensureColumn(
  "bids",
  "verification_provider",
  "TEXT NOT NULL DEFAULT 'demo-solana-usdc'"
);
ensureColumn("attention_content", "updated_at", "TEXT");
ensureColumn("attention_content", "image_url", "TEXT");

db.exec(`
  UPDATE bids
  SET amount_usdc = amount
  WHERE amount_usdc IS NULL AND amount IS NOT NULL;
`);

export default db;
