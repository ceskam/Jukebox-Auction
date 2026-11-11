const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  const root = path.join(__dirname, '..');
  // Minimal existing production schema; execute the real reservation migration.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table art_drop_control (id integer primary key, paused boolean);
    insert into art_drop_control values (1, false);
    create table art_drops (
      id text primary key, code_hash text, status text, expires_at timestamptz,
      claim_wallet text, reserved_at timestamptz, payout_error text
    );
    create table engagement_sessions (
      session_hash text primary key, first_seen timestamptz not null,
      last_seen timestamptz not null, last_sponsor_click_at timestamptz,
      sponsor_auction_id text not null
    );
    create function reserve_art_drop(text, text) returns void language sql as 'select';
  `);
  const migration = readFileSync(path.join(root, 'database/art-drop-claim-evidence.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Upgrades can safely be reapplied.
  assert.equal((await db.query(`select to_regprocedure('reserve_art_drop(text,text)') as legacy`)).rows[0].legacy, null);
  let n = 0;
  async function seed(change = '') {
    const id = `drop-${++n}`;
    await db.query(`insert into art_drops values ($1, $1, 'active', now()+interval '1 hour', '', null, '', null)`, [id]);
    await db.query(`insert into engagement_sessions values ($1, now()-interval '6 minutes', now(), now()-interval '1 minute', 'attention-1')`, [id]);
    if (change) await db.query(`update engagement_sessions set ${change} where session_hash=$1`, [id]);
    return id;
  }
  async function claim(id, session = id, auction = 'attention-1') {
    return db.query(`select * from reserve_art_drop($1, 'wallet-A', $2, $3)`, [id, session, auction]);
  }
  const valid = await seed();
  const won = (await claim(valid)).rows[0];
  assert.equal(won.status, 'reserved');
  const snapshot = won.claim_engagement;
  assert.equal(snapshot.wallet, 'wallet-A');
  assert.equal(snapshot.session_hash, valid);
  assert.equal(snapshot.required_auction_id, snapshot.sponsor_auction_id);
  assert.ok(snapshot.elapsed_seconds >= 360);
  assert.equal((await db.query(`select (claim_engagement->>'checked_at')::timestamptz = reserved_at as same_time from art_drops where id=$1`, [valid])).rows[0].same_time, true);
  await db.query(`update engagement_sessions set first_seen=now(), last_sponsor_click_at=null where session_hash=$1`, [valid]);
  assert.deepEqual((await db.query(`select claim_engagement from art_drops where id=$1`, [valid])).rows[0].claim_engagement, snapshot);
  assert.equal((await claim(valid)).rows.length, 0, 'duplicate reservation rejected');
  const invalid = [
    "first_seen=now()-interval '4 minutes'",
    "last_seen=now()-interval '3 minutes'",
    'last_sponsor_click_at=null',
    "last_sponsor_click_at=now()-interval '25 hours'",
    "last_sponsor_click_at=now()+interval '1 minute'",
    "last_seen=now()+interval '1 minute'",
    "sponsor_auction_id='attention-other'",
  ];
  for (const change of invalid) {
    const id = await seed(change);
    await assert.rejects(claim(id), /engagement/);
    const row = (await db.query(`select * from art_drops where id=$1`, [id])).rows[0];
    assert.equal(row.status, 'active');
    assert.equal(row.claim_engagement, null);
  }
  const missing = await seed();
  await assert.rejects(claim(missing, 'unknown'), /engagement/);
  await assert.rejects(claim(missing, missing, ''), /engagement/);
  const expired = await seed();
  await db.query(`update art_drops set expires_at=now()-interval '1 minute' where id=$1`, [expired]);
  assert.equal((await claim(expired)).rows.length, 0);
  const paused = await seed();
  await db.exec('update art_drop_control set paused=true');
  assert.equal((await claim(paused)).rows.length, 0);
  const grants = (await db.query(`select has_function_privilege('anon', 'reserve_art_drop(text,text,text,text)', 'execute') as anon, has_function_privilege('authenticated', 'reserve_art_drop(text,text,text,text)', 'execute') as authenticated, has_function_privilege('service_role', 'reserve_art_drop(text,text,text,text)', 'execute') as service`)).rows[0];
  assert.deepEqual(grants, { anon: false, authenticated: false, service: true });
  await db.close();
  console.log('PASS: atomic snapshot, persistence, invalid eligibility, duplicate/expired/paused claims, legacy RPC removal, migration reapplication, and access grants');
})().catch(error => { console.error(error); process.exit(1); });
