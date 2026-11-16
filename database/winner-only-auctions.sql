-- AdBidCoin winner-only auction settlement.
-- Apply after schema.sql and credits-reports-and-art-drop-limits.sql.
--
-- Card bids are authorized but not captured until the auction ends. Wallet bids
-- are deposited into a per-bid Solana program escrow. The highest verified bid
-- is settled; every other authorization/escrow is released.

create extension if not exists pgcrypto;

alter table public.bids
  add column if not exists settlement_status text not null default 'captured';
alter table public.bids
  add column if not exists settlement_reference text not null default '';

alter table public.bids drop constraint if exists bids_funding_source_check;
alter table public.bids add constraint bids_funding_source_check
  check (funding_source in ('wallet', 'credit', 'card_authorization', 'wallet_escrow'));

alter table public.bids drop constraint if exists bids_settlement_status_check;
alter table public.bids add constraint bids_settlement_status_check check (
  settlement_status in (
    'reserved', 'capture_pending', 'captured', 'release_pending', 'released',
    'refund_pending', 'refunded', 'failed'
  )
);

create table if not exists public.card_bid_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auction_id text not null references public.auctions(id) on delete cascade,
  amount_usd numeric(14, 2) not null check (amount_usd > 0),
  fee_usd numeric(14, 2) not null default 0 check (fee_usd >= 0),
  bid_value_usdc numeric(14, 2) not null check (bid_value_usdc > 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  bid_id bigint unique references public.bids(id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'authorized', 'capture_pending', 'captured', 'release_pending', 'released', 'failed', 'expired')
  ),
  authorized_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  failure_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_bid_escrows (
  id uuid primary key default gen_random_uuid(),
  auction_id text not null references public.auctions(id) on delete cascade,
  wallet text not null,
  amount_usdc numeric(14, 2) not null check (amount_usdc > 0),
  escrow_pda text not null unique,
  deposit_signature text not null unique,
  bid_id bigint unique references public.bids(id) on delete restrict,
  status text not null default 'deposited' check (
    status in ('deposited', 'settle_pending', 'settled', 'refund_pending', 'refunded', 'failed')
  ),
  settlement_signature text not null default '',
  failure_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auction_settlements (
  auction_id text primary key references public.auctions(id) on delete cascade,
  winning_bid_id bigint references public.bids(id) on delete restrict,
  funding_source text not null default '',
  status text not null default 'pending' check (
    status in ('pending', 'settling', 'settled', 'needs_review')
  ),
  winner_reference text not null default '',
  error text not null default '',
  started_at timestamptz,
  settled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists card_bid_authorizations_auction_status_idx
  on public.card_bid_authorizations (auction_id, status, created_at);
create index if not exists card_bid_authorizations_user_created_idx
  on public.card_bid_authorizations (user_id, created_at desc);
create index if not exists wallet_bid_escrows_auction_status_idx
  on public.wallet_bid_escrows (auction_id, status, created_at);
create index if not exists auction_settlements_status_idx
  on public.auction_settlements (status, updated_at);

create or replace function public.record_card_authorized_bid(
  requested_authorization_id uuid,
  requested_payment_intent_id text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_record public.card_bid_authorizations%rowtype;
  auction public.auctions%rowtype;
  current_highest numeric := 0;
  minimum_bid numeric := 0.25;
  inserted_bid_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('auction-bid:' || requested_authorization_id::text));
  select * into auth_record from public.card_bid_authorizations
    where id = requested_authorization_id for update;
  if not found then raise exception 'Card bid authorization not found.'; end if;
  if auth_record.status = 'authorized' and auth_record.bid_id is not null then
    return auth_record.bid_id;
  end if;
  if auth_record.status <> 'pending' then
    raise exception 'Card bid authorization is not pending.';
  end if;

  perform pg_advisory_xact_lock(hashtext('auction-bid:' || auth_record.auction_id));
  select * into auction from public.auctions
    where id = auth_record.auction_id for update;
  if not found or auction.starts_at <= (extract(epoch from clock_timestamp()) * 1000)::bigint then
    raise exception 'That auction has closed.';
  end if;

  select coalesce(max(effective_bid_usdc), 0) into current_highest
  from public.bids
  where auction_id = auth_record.auction_id
    and payment_status = 'verified' and bid_source = 'user';
  if current_highest > 0 then minimum_bid := ceil((current_highest + 1) * 100) / 100; end if;
  if auth_record.bid_value_usdc < minimum_bid then
    raise exception 'The minimum bid is %.', to_char(minimum_bid, 'FM999999990.00');
  end if;

  insert into public.bids (
    auction_id, wallet, amount_usdc, quiet_balance, quiet_balance_slot,
    bid_multiplier, effective_bid_usdc, payment_status, payment_signature,
    verification_provider, bid_source, funding_source, user_id,
    settlement_status, settlement_reference
  ) values (
    auth_record.auction_id, 'credit:' || auth_record.user_id::text,
    auth_record.bid_value_usdc, 0, 0, 1, auth_record.bid_value_usdc,
    'verified', 'stripe-auth:' || requested_payment_intent_id,
    'stripe-manual-capture', 'user', 'card_authorization', auth_record.user_id,
    'reserved', auth_record.id::text
  ) returning id into inserted_bid_id;

  update public.card_bid_authorizations set
    stripe_payment_intent_id = requested_payment_intent_id,
    bid_id = inserted_bid_id,
    status = 'authorized', authorized_at = now(), updated_at = now()
  where id = auth_record.id;
  return inserted_bid_id;
end;
$$;

create or replace function public.record_wallet_escrow_bid(
  requested_auction_id text,
  requested_wallet text,
  requested_amount numeric,
  requested_escrow_pda text,
  requested_deposit_signature text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  auction public.auctions%rowtype;
  escrow_id uuid := gen_random_uuid();
  inserted_bid_id bigint;
begin
  if requested_wallet = '' or requested_escrow_pda = '' or requested_deposit_signature = '' then
    raise exception 'Complete wallet escrow evidence is required.';
  end if;
  if requested_amount < 0.25 or requested_amount <> round(requested_amount, 2) then
    raise exception 'Wallet bid amount must be at least 0.25 USDC with at most two decimals.';
  end if;
  perform pg_advisory_xact_lock(hashtext('auction-bid:' || requested_auction_id));
  select * into auction from public.auctions where id = requested_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  -- The program already proved that the deposit happened before its on-chain
  -- close. Record a verified deposit even if a concurrent higher bid arrived
  -- first, so every deposited escrow remains discoverable and refundable.

  insert into public.wallet_bid_escrows (
    id, auction_id, wallet, amount_usdc, escrow_pda, deposit_signature
  ) values (
    escrow_id, requested_auction_id, requested_wallet, requested_amount,
    requested_escrow_pda, requested_deposit_signature
  );
  insert into public.bids (
    auction_id, wallet, amount_usdc, quiet_balance, quiet_balance_slot,
    bid_multiplier, effective_bid_usdc, payment_status, payment_signature,
    verification_provider, bid_source, funding_source, settlement_status,
    settlement_reference
  ) values (
    requested_auction_id, requested_wallet, requested_amount, 0, 0, 1,
    requested_amount, 'verified', requested_deposit_signature,
    'solana-program-escrow', 'user', 'wallet_escrow', 'reserved', escrow_id::text
  ) returning id into inserted_bid_id;
  update public.wallet_bid_escrows set bid_id = inserted_bid_id, updated_at = now()
    where id = escrow_id;
  return inserted_bid_id;
end;
$$;

alter table public.card_bid_authorizations enable row level security;
alter table public.wallet_bid_escrows enable row level security;
alter table public.auction_settlements enable row level security;

revoke all on table public.card_bid_authorizations from anon, authenticated;
revoke all on table public.wallet_bid_escrows from anon, authenticated;
revoke all on table public.auction_settlements from anon, authenticated;
revoke all on function public.record_card_authorized_bid(uuid, text) from public, anon, authenticated;
revoke all on function public.record_wallet_escrow_bid(text, text, numeric, text, text) from public, anon, authenticated;

grant select, insert, update, delete on table public.card_bid_authorizations to service_role;
grant select, insert, update, delete on table public.wallet_bid_escrows to service_role;
grant select, insert, update, delete on table public.auction_settlements to service_role;
grant execute on function public.record_card_authorized_bid(uuid, text) to service_role;
grant execute on function public.record_wallet_escrow_bid(text, text, numeric, text, text) to service_role;

create or replace view public.auction_settlement_receipts
with (security_barrier = true)
as
select
  s.auction_id,
  s.status,
  s.funding_source,
  s.settled_at,
  b.amount_usdc as winning_bid_usdc,
  case when s.funding_source = 'wallet_escrow' then b.wallet else '' end as winning_wallet,
  case when s.funding_source = 'wallet_escrow' then s.winner_reference else '' end as onchain_winner_signature
from public.auction_settlements s
left join public.bids b on b.id = s.winning_bid_id
where s.status = 'settled';

revoke all on public.auction_settlement_receipts from public;
grant select on public.auction_settlement_receipts to anon, authenticated, service_role;

comment on table public.card_bid_authorizations is
  'Card bid holds. Only the winning PaymentIntent is captured; losing holds are cancelled.';
comment on table public.wallet_bid_escrows is
  'Per-bid Solana program escrows. Winner settles to treasury and losing escrows return to bidders.';
comment on table public.auction_settlements is
  'Idempotent winner-only settlement state shared by card and wallet-funded bids.';
comment on view public.auction_settlement_receipts is
  'Sanitized public settlement receipts. Card processor identifiers are never exposed.';
