-- Run once in the Supabase SQL editor before deploying QUIET bid power.

alter table public.bids
  add column if not exists quiet_balance numeric(30, 9) not null default 0;

alter table public.bids
  add column if not exists quiet_balance_slot bigint not null default 0;

alter table public.bids
  add column if not exists bid_multiplier numeric(12, 6) not null default 1;

alter table public.bids
  add column if not exists effective_bid_usdc numeric(24, 8);

update public.bids
set effective_bid_usdc = amount_usdc
where effective_bid_usdc is null;

alter table public.bids
  alter column effective_bid_usdc set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bids_quiet_balance_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table public.bids
      add constraint bids_quiet_balance_check check (quiet_balance >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bids_bid_multiplier_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table public.bids
      add constraint bids_bid_multiplier_check
      check (bid_multiplier >= 1 and bid_multiplier <= 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bids_effective_bid_usdc_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table public.bids
      add constraint bids_effective_bid_usdc_check
      check (effective_bid_usdc > 0);
  end if;
end
$$;

drop index if exists public.bids_auction_highest_idx;

create index bids_auction_highest_idx
  on public.bids (
    auction_id,
    payment_status,
    bid_source,
    effective_bid_usdc desc,
    amount_usdc desc,
    created_at asc
  );

comment on column public.bids.quiet_balance is
  'Server-verified QUIET balance snapshot used to calculate bid power.';

comment on column public.bids.quiet_balance_slot is
  'Confirmed Solana slot used for the QUIET balance snapshot.';

comment on column public.bids.bid_multiplier is
  'Linear QUIET bid multiplier snapshotted when the verified bid is recorded.';

comment on column public.bids.effective_bid_usdc is
  'USDC amount multiplied by bid_multiplier; used to rank user bids.';
