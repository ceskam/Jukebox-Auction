-- AdBidCoin Art Drops: randomized, first-valid-claim USDC rewards.
-- Run once in the Supabase SQL editor before enabling ART_DROPS_ENABLED.
-- All access is server-only. Claim reservation is atomic to prevent double payouts.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.art_drop_control (
  id smallint primary key default 1 check (id = 1),
  paused boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.art_drop_control (id, paused)
values (1, true)
on conflict (id) do nothing;

create table if not exists public.art_drops (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  claim_code text not null,
  code_hash text not null unique,
  reward_usdc numeric(12, 2) not null
    check (reward_usdc > 0 and reward_usdc <= 100),
  status text not null default 'scheduled'
    check (status in (
      'scheduled',
      'active',
      'reserved',
      'paid',
      'expired',
      'cancelled',
      'payout_review'
    )),
  scheduled_for timestamptz not null,
  published_at timestamptz,
  expires_at timestamptz,
  reserved_at timestamptz,
  claim_wallet text not null default '',
  payout_signature text not null default '',
  payout_error text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists art_drops_one_open_drop_idx
  on public.art_drops ((true))
  where status in ('scheduled', 'active', 'reserved');

create unique index if not exists art_drops_payout_signature_idx
  on public.art_drops (payout_signature)
  where payout_signature <> '';

create index if not exists art_drops_status_schedule_idx
  on public.art_drops (status, scheduled_for, created_at desc);

create index if not exists art_drops_recent_paid_idx
  on public.art_drops (paid_at desc)
  where status = 'paid';

drop trigger if exists art_drop_control_set_updated_at
  on public.art_drop_control;
create trigger art_drop_control_set_updated_at
before update on public.art_drop_control
for each row execute function public.set_updated_at();

drop trigger if exists art_drops_set_updated_at
  on public.art_drops;
create trigger art_drops_set_updated_at
before update on public.art_drops
for each row execute function public.set_updated_at();

-- Reserve an active drop for exactly one request. Reserved rows are never
-- returned again, including to the same wallet, preventing concurrent retries
-- from submitting duplicate payouts.
create or replace function public.reserve_art_drop(
  requested_code_hash text,
  requested_wallet text
)
returns setof public.art_drops
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_drop public.art_drops%rowtype;
begin
  if coalesce((select paused from public.art_drop_control where id = 1), true) then
    return;
  end if;

  select *
  into selected_drop
  from public.art_drops
  where code_hash = requested_code_hash
  for update;

  if not found then
    return;
  end if;

  if selected_drop.status = 'active'
     and selected_drop.expires_at is not null
     and selected_drop.expires_at > now() then
    update public.art_drops
    set
      status = 'reserved',
      claim_wallet = requested_wallet,
      reserved_at = now(),
      payout_error = ''
    where id = selected_drop.id
    returning * into selected_drop;

    return next selected_drop;
    return;
  end if;
end;
$$;

comment on table public.art_drops is
  'Randomized AdBidCoin Art Drops. Public graphics reveal one-time codes; private treasury keys never leave the server signer.';
comment on function public.reserve_art_drop(text, text) is
  'Atomically reserves one active reward for the first wallet-authenticated claimant.';

alter table public.art_drop_control enable row level security;
alter table public.art_drops enable row level security;

revoke all on table public.art_drop_control from anon, authenticated;
revoke all on table public.art_drops from anon, authenticated;
revoke all on function public.reserve_art_drop(text, text) from public, anon, authenticated;

grant select, insert, update, delete on table public.art_drop_control to service_role;
grant select, insert, update, delete on table public.art_drops to service_role;
grant execute on function public.reserve_art_drop(text, text) to service_role;
