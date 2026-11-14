-- AdBidCoin: 2 USDC Art Drops, server-enforced limits, card credit ledger,
-- and per-attention-block performance reports.
-- Run once in the Supabase SQL editor before deploying the matching web code.

create extension if not exists pgcrypto;

alter table public.art_drops
  add column if not exists claimant_hash text not null default '';
alter table public.art_drops
  add column if not exists engagement_session_hash text not null default '';

create index if not exists art_drops_claimant_cooldown_idx
  on public.art_drops (claimant_hash, reserved_at desc)
  where claimant_hash <> '' and status in ('reserved', 'paid', 'payout_review');
create index if not exists art_drops_session_cooldown_idx
  on public.art_drops (engagement_session_hash, reserved_at desc)
  where engagement_session_hash <> '' and status in ('reserved', 'paid', 'payout_review');
create index if not exists art_drops_wallet_cooldown_idx
  on public.art_drops (claim_wallet, reserved_at desc)
  where claim_wallet <> '' and status in ('reserved', 'paid', 'payout_review');

drop function if exists public.reserve_art_drop(text, text);

create or replace function public.reserve_art_drop(
  requested_code_hash text,
  requested_wallet text,
  requested_claimant_hash text,
  requested_session_hash text,
  requested_daily_limit numeric default 70
)
returns setof public.art_drops
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_drop public.art_drops%rowtype;
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  allocated_today numeric := 0;
begin
  perform pg_advisory_xact_lock(hashtext('adbidcoin-art-drop-reserve'));

  if coalesce((select paused from public.art_drop_control where id = 1), true) then
    raise exception 'Art Drops are temporarily paused.';
  end if;

  if exists (
    select 1 from public.art_drops
    where status in ('reserved', 'paid', 'payout_review')
      and coalesce(paid_at, reserved_at, created_at) >= now() - interval '24 hours'
      and (
        claim_wallet = requested_wallet
        or (requested_claimant_hash <> '' and claimant_hash = requested_claimant_hash)
        or (requested_session_hash <> '' and engagement_session_hash = requested_session_hash)
      )
  ) then
    raise exception 'A wallet or viewer associated with this session has already received an Art Drop during the rolling 24-hour period.';
  end if;

  select coalesce(sum(reward_usdc), 0) into allocated_today
  from public.art_drops
  where status in ('reserved', 'paid', 'payout_review')
    and coalesce(reserved_at, created_at) >= day_start;

  select * into selected_drop
  from public.art_drops
  where code_hash = requested_code_hash
  for update;

  if not found then return; end if;

  if allocated_today + selected_drop.reward_usdc > least(requested_daily_limit, 70) then
    raise exception 'The 70 USDC daily Art Drop budget has been reached. Please return after 00:00 UTC.';
  end if;

  if selected_drop.status = 'active'
     and selected_drop.expires_at is not null
     and selected_drop.expires_at > now() then
    update public.art_drops
    set status = 'reserved',
        claim_wallet = requested_wallet,
        claimant_hash = requested_claimant_hash,
        engagement_session_hash = requested_session_hash,
        reserved_at = now(),
        payout_error = ''
    where id = selected_drop.id
    returning * into selected_drop;
    return next selected_drop;
  end if;
end;
$$;

create table if not exists public.platform_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_credits numeric(14, 2) not null default 0 check (balance_credits >= 0),
  reserved_credits numeric(14, 2) not null default 0 check (reserved_credits >= 0),
  deficit_credits numeric(14, 2) not null default 0 check (deficit_credits >= 0),
  status text not null default 'active' check (status in ('active', 'frozen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_credit_accounts
  add column if not exists deficit_credits numeric(14, 2) not null default 0;
alter table public.platform_credit_accounts
  add column if not exists status text not null default 'active';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_credit_accounts_balance_check'
      and conrelid = 'public.platform_credit_accounts'::regclass
  ) then
    alter table public.platform_credit_accounts add constraint platform_credit_accounts_balance_check
      check (balance_credits >= 0 and reserved_credits >= 0 and deficit_credits >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_credit_accounts_status_check'
      and conrelid = 'public.platform_credit_accounts'::regclass
  ) then
    alter table public.platform_credit_accounts add constraint platform_credit_accounts_status_check
      check (status in ('active', 'frozen'));
  end if;
end $$;

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_usd numeric(14, 2) not null check (amount_usd > 0),
  fee_usd numeric(14, 2) not null default 0 check (fee_usd >= 0),
  credits numeric(14, 2) not null check (credits > 0),
  refunded_credits numeric(14, 2) not null default 0 check (refunded_credits >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'reserve', 'release', 'spend', 'refund', 'adjustment')),
  amount_credits numeric(14, 2) not null,
  balance_after numeric(14, 2) not null,
  reserved_after numeric(14, 2) not null,
  reference_type text not null,
  reference_id text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_bid_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auction_id text not null references public.auctions(id) on delete cascade,
  amount_credits numeric(14, 2) not null check (amount_credits > 0),
  bid_id bigint unique references public.bids(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.bids add column if not exists funding_source text not null default 'wallet';
alter table public.bids add column if not exists user_id uuid references auth.users(id) on delete set null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bids_funding_source_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table public.bids add constraint bids_funding_source_check
      check (funding_source in ('wallet', 'credit'));
  end if;
end $$;

create index if not exists credit_purchases_user_created_idx
  on public.credit_purchases (user_id, created_at desc);
create index if not exists credit_transactions_user_created_idx
  on public.platform_credit_transactions (user_id, created_at desc);
create index if not exists credit_bid_reservations_user_created_idx
  on public.credit_bid_reservations (user_id, created_at desc);

create or replace function public.settle_credit_purchase(
  requested_purchase_id uuid,
  requested_session_id text,
  requested_payment_intent_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.credit_purchases%rowtype;
  account public.platform_credit_accounts%rowtype;
  recovered numeric := 0;
  credited numeric := 0;
begin
  perform pg_advisory_xact_lock(hashtext(requested_purchase_id::text));
  select * into purchase from public.credit_purchases
    where id = requested_purchase_id for update;
  if not found then raise exception 'Credit purchase not found.'; end if;
  if purchase.status = 'paid' then return; end if;
  if purchase.status <> 'pending' then raise exception 'Credit purchase is not payable.'; end if;

  insert into public.platform_credit_accounts (user_id)
  values (purchase.user_id) on conflict (user_id) do nothing;
  select least(deficit_credits, purchase.credits) into recovered
  from public.platform_credit_accounts where user_id = purchase.user_id;
  credited := purchase.credits - recovered;
  update public.platform_credit_accounts
  set balance_credits = balance_credits + credited,
      deficit_credits = greatest(0, deficit_credits - recovered),
      status = case when deficit_credits - recovered <= 0 then 'active' else 'frozen' end,
      updated_at = now()
  where user_id = purchase.user_id returning * into account;

  update public.credit_purchases
  set status = 'paid', stripe_session_id = requested_session_id,
      stripe_payment_intent_id = requested_payment_intent_id,
      paid_at = now(), updated_at = now()
  where id = purchase.id;

  insert into public.platform_credit_transactions (
    user_id, kind, amount_credits, balance_after, reserved_after,
    reference_type, reference_id, idempotency_key
  ) values (
    purchase.user_id, 'purchase', purchase.credits, account.balance_credits,
    account.reserved_credits, 'credit_purchase', purchase.id::text,
    'purchase:' || purchase.id::text
  ) on conflict (idempotency_key) do nothing;
  update public.platform_credit_transactions
  set metadata = jsonb_build_object(
    'purchased_credits', purchase.credits,
    'credited_to_balance', credited,
    'recovered_deficit', recovered
  )
  where idempotency_key = 'purchase:' || purchase.id::text;
end;
$$;

create or replace function public.apply_credit_refund(
  requested_purchase_id uuid,
  requested_refunded_credits numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.credit_purchases%rowtype;
  account public.platform_credit_accounts%rowtype;
  delta numeric;
  deducted numeric;
  deficit numeric;
begin
  perform pg_advisory_xact_lock(hashtext(requested_purchase_id::text));
  select * into purchase from public.credit_purchases
    where id = requested_purchase_id for update;
  if not found or purchase.status not in ('paid', 'partially_refunded', 'refunded') then
    raise exception 'Paid credit purchase not found.';
  end if;
  delta := greatest(0, least(purchase.credits, requested_refunded_credits) - purchase.refunded_credits);
  if delta = 0 then return; end if;

  select least(balance_credits, delta) into deducted
  from public.platform_credit_accounts where user_id = purchase.user_id;
  deficit := delta - deducted;
  update public.platform_credit_accounts
  set balance_credits = balance_credits - deducted,
      deficit_credits = deficit_credits + deficit,
      status = case when deficit_credits + deficit > 0 then 'frozen' else status end,
      updated_at = now()
  where user_id = purchase.user_id returning * into account;
  update public.credit_purchases
  set refunded_credits = refunded_credits + delta,
      status = case when refunded_credits + delta >= credits then 'refunded' else 'partially_refunded' end,
      updated_at = now()
  where id = purchase.id;
  insert into public.platform_credit_transactions (
    user_id, kind, amount_credits, balance_after, reserved_after,
    reference_type, reference_id, idempotency_key
  ) values (
    purchase.user_id, 'refund', -delta, account.balance_credits,
    account.reserved_credits, 'credit_purchase', purchase.id::text,
    'refund:' || purchase.id::text || ':' || (purchase.refunded_credits + delta)::text
  ) on conflict (idempotency_key) do nothing;
  update public.platform_credit_transactions
  set metadata = jsonb_build_object(
    'refunded_credits', delta,
    'deducted_from_balance', deducted,
    'unrecovered_deficit', deficit
  )
  where idempotency_key = 'refund:' || purchase.id::text || ':' || (purchase.refunded_credits + delta)::text;
end;
$$;

create or replace function public.place_credit_bid(
  requested_user_id uuid,
  requested_auction_id text,
  requested_amount numeric
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.platform_credit_accounts%rowtype;
  auction public.auctions%rowtype;
  current_highest numeric := 0;
  minimum_bid numeric := 0.25;
  reservation_id uuid := gen_random_uuid();
  inserted_bid_id bigint;
begin
  if requested_amount <= 0 or requested_amount <> round(requested_amount, 2) then
    raise exception 'Credit bid amount must be a positive value with at most two decimals.';
  end if;
  perform pg_advisory_xact_lock(hashtext('credit-bid:' || requested_auction_id));
  select * into auction from public.auctions
    where id = requested_auction_id for update;
  if not found or auction.status <> 'scheduled' or auction.starts_at <= (extract(epoch from clock_timestamp()) * 1000)::bigint then
    raise exception 'That auction has closed. Refresh and try again.';
  end if;
  select coalesce(max(effective_bid_usdc), 0) into current_highest
  from public.bids
  where auction_id = requested_auction_id
    and payment_status = 'verified'
    and bid_source = 'user';
  if current_highest > 0 then
    minimum_bid := ceil((current_highest + 1) * 100) / 100;
  end if;
  if requested_amount < minimum_bid then
    raise exception 'The minimum credit bid is % credits.', to_char(minimum_bid, 'FM999999990.00');
  end if;

  perform pg_advisory_xact_lock(hashtext(requested_user_id::text));
  select * into account from public.platform_credit_accounts
    where user_id = requested_user_id for update;
  if not found or account.status <> 'active' or account.deficit_credits > 0 then
    raise exception 'This platform credit account is not available for bidding.';
  end if;
  if account.balance_credits < requested_amount then
    raise exception 'Insufficient platform credit balance.';
  end if;

  update public.platform_credit_accounts
  set balance_credits = balance_credits - requested_amount,
      reserved_credits = reserved_credits + requested_amount,
      updated_at = now()
  where user_id = requested_user_id returning * into account;
  insert into public.credit_bid_reservations (id, user_id, auction_id, amount_credits)
  values (reservation_id, requested_user_id, requested_auction_id, requested_amount);
  insert into public.platform_credit_transactions (
    user_id, kind, amount_credits, balance_after, reserved_after,
    reference_type, reference_id, idempotency_key
  ) values (
    requested_user_id, 'reserve', 0, account.balance_credits, account.reserved_credits,
    'credit_bid', reservation_id::text, 'reserve:' || reservation_id::text
  );

  insert into public.bids (
    auction_id, wallet, amount_usdc, quiet_balance, quiet_balance_slot,
    bid_multiplier, effective_bid_usdc, payment_status, payment_signature,
    verification_provider, bid_source, funding_source, user_id
  ) values (
    requested_auction_id, 'credit:' || requested_user_id::text, requested_amount,
    0, 0, 1, requested_amount, 'verified', 'credit:' || reservation_id::text,
    'stripe-platform-credit', 'user', 'credit', requested_user_id
  ) returning id into inserted_bid_id;

  update public.platform_credit_accounts
  set reserved_credits = reserved_credits - requested_amount, updated_at = now()
  where user_id = requested_user_id returning * into account;
  update public.credit_bid_reservations
  set status = 'settled', bid_id = inserted_bid_id, settled_at = now()
  where id = reservation_id;
  insert into public.platform_credit_transactions (
    user_id, kind, amount_credits, balance_after, reserved_after,
    reference_type, reference_id, idempotency_key
  ) values (
    requested_user_id, 'spend', -requested_amount, account.balance_credits,
    account.reserved_credits, 'credit_bid', reservation_id::text,
    'spend:' || reservation_id::text
  );
  return inserted_bid_id;
end;
$$;

create or replace function public.release_credit_bid(
  requested_reservation_id uuid,
  requested_reason text default 'administrative release'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.credit_bid_reservations%rowtype;
  account public.platform_credit_accounts%rowtype;
begin
  select * into reservation from public.credit_bid_reservations
    where id = requested_reservation_id for update;
  if not found then raise exception 'Credit bid reservation not found.'; end if;
  if reservation.status in ('released', 'refunded') then return; end if;
  perform pg_advisory_xact_lock(hashtext(reservation.user_id::text));

  if reservation.status = 'reserved' then
    update public.platform_credit_accounts
    set balance_credits = balance_credits + reservation.amount_credits,
        reserved_credits = greatest(0, reserved_credits - reservation.amount_credits),
        updated_at = now()
    where user_id = reservation.user_id returning * into account;
  else
    update public.platform_credit_accounts
    set balance_credits = balance_credits + reservation.amount_credits,
        updated_at = now()
    where user_id = reservation.user_id returning * into account;
    update public.bids set payment_status = 'failed'
      where id = reservation.bid_id and funding_source = 'credit';
  end if;

  update public.credit_bid_reservations
  set status = 'released', released_at = now()
  where id = reservation.id;
  insert into public.platform_credit_transactions (
    user_id, kind, amount_credits, balance_after, reserved_after,
    reference_type, reference_id, idempotency_key, metadata
  ) values (
    reservation.user_id, 'release', reservation.amount_credits,
    account.balance_credits, account.reserved_credits, 'credit_bid',
    reservation.id::text, 'release:' || reservation.id::text,
    jsonb_build_object('reason', left(requested_reason, 300))
  ) on conflict (idempotency_key) do nothing;
end;
$$;

alter table public.attention_events
  add column if not exists featured_content_auction_id text not null default '';
alter table public.attention_events
  add column if not exists viewer_hash text not null default '';
create index if not exists attention_events_block_metrics_idx
  on public.attention_events (auction_id, event_type, created_at);

create table if not exists public.attention_block_reports (
  block_auction_id text primary key references public.auctions(id) on delete cascade,
  block_sequence bigint not null,
  featured_content_auction_id text not null default '',
  is_repeat boolean not null default false,
  title text not null default '',
  image_url text not null default '',
  winning_bid_usdc numeric(14, 2),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  impressions integer not null default 0,
  unique_viewers integer,
  link_clicks integer not null default 0,
  click_through_rate numeric(10, 4),
  cost_per_click numeric(14, 4),
  publication_status text not null default 'pending'
    check (publication_status in ('pending', 'publishing', 'published', 'failed')),
  x_post_id text not null default '',
  x_error text not null default '',
  retry_count integer not null default 0,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.platform_credit_accounts enable row level security;
alter table public.credit_purchases enable row level security;
alter table public.platform_credit_transactions enable row level security;
alter table public.credit_bid_reservations enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.attention_block_reports enable row level security;

revoke all on table public.platform_credit_accounts from anon, authenticated;
revoke all on table public.credit_purchases from anon, authenticated;
revoke all on table public.platform_credit_transactions from anon, authenticated;
revoke all on table public.credit_bid_reservations from anon, authenticated;
revoke all on table public.stripe_webhook_events from anon, authenticated;
revoke all on table public.attention_block_reports from anon, authenticated;
revoke all on function public.reserve_art_drop(text, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.settle_credit_purchase(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_credit_refund(uuid, numeric) from public, anon, authenticated;
revoke all on function public.place_credit_bid(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.release_credit_bid(uuid, text) from public, anon, authenticated;

grant select, insert, update, delete on table public.platform_credit_accounts to service_role;
grant select, insert, update, delete on table public.credit_purchases to service_role;
grant select, insert, update, delete on table public.platform_credit_transactions to service_role;
grant select, insert, update, delete on table public.credit_bid_reservations to service_role;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
grant select, insert, update, delete on table public.attention_block_reports to service_role;
grant execute on function public.reserve_art_drop(text, text, text, text, numeric) to service_role;
grant execute on function public.settle_credit_purchase(uuid, text, text) to service_role;
grant execute on function public.apply_credit_refund(uuid, numeric) to service_role;
grant execute on function public.place_credit_bid(uuid, text, numeric) to service_role;
grant execute on function public.release_credit_bid(uuid, text) to service_role;

comment on table public.platform_credit_accounts is
  'Internal, non-transferable platform credits. One credit supplies one USDC of auction bidding value.';
comment on table public.attention_block_reports is
  'Verified per-block performance snapshots with idempotent X publication state.';
