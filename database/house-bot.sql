-- Run once in the Supabase SQL editor before enabling the house bot in Vercel.

alter table public.bids
  add column if not exists bid_source text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bids_bid_source_check'
      and conrelid = 'public.bids'::regclass
  ) then
    alter table public.bids
      add constraint bids_bid_source_check
      check (bid_source in ('user', 'house'));
  end if;
end
$$;

create unique index if not exists bids_one_active_house_bid_per_auction_idx
  on public.bids (auction_id)
  where bid_source = 'house' and payment_status in ('pending', 'verified');

comment on column public.bids.bid_source is
  'Identifies user bids separately from disclosed operator-funded house bids.';
