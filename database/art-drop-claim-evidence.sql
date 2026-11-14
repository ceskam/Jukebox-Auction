-- Apply before deploying the matching application code.
-- Legacy claim calls fail closed until deployment; historical rows remain NULL.
begin;
alter table public.art_drops
  add column if not exists claim_engagement jsonb;
comment on column public.art_drops.claim_engagement is
  'Private claim-time eligibility snapshot. Session hash is a correlation identifier, not the session cookie. Historical claims remain NULL.';
-- Remove the unaudited reservation path, including its service-role grant.
drop function if exists public.reserve_art_drop(text, text);

create or replace function public.reserve_art_drop(
  requested_code_hash text,
  requested_wallet text,
  requested_session_hash text,
  requested_auction_id text
)
returns setof public.art_drops
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_drop public.art_drops%rowtype;
  engagement public.engagement_sessions%rowtype;
  checked_at timestamptz;
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
    -- Lock the session while taking the snapshot so a heartbeat/reset cannot
    -- change the evidence between validation and reservation.
    select * into engagement
    from public.engagement_sessions
    where session_hash = requested_session_hash
    for share;
    checked_at := clock_timestamp();
    if not found
       or requested_wallet is null or requested_wallet = ''
       or requested_auction_id is null or requested_auction_id = ''
       or engagement.first_seen > checked_at - interval '5 minutes'
       or engagement.last_seen < checked_at - interval '2 minutes'
       or engagement.last_seen > checked_at
       or engagement.last_sponsor_click_at is null
       or engagement.last_sponsor_click_at > checked_at
       or engagement.last_sponsor_click_at < checked_at - interval '24 hours'
       or engagement.sponsor_auction_id <> requested_auction_id then
      raise exception 'Claim engagement is missing, expired, or incomplete.';
    end if;
    if selected_drop.expires_at <= checked_at then
      return;
    end if;
    update public.art_drops
    set
      status = 'reserved',
      claim_wallet = requested_wallet,
      reserved_at = checked_at,
      claim_engagement = jsonb_build_object(
        'version', 1,
        'wallet', requested_wallet,
        'session_hash', requested_session_hash,
        'checked_at', checked_at,
        'first_seen', engagement.first_seen,
        'last_seen', engagement.last_seen,
        'elapsed_seconds', extract(epoch from checked_at - engagement.first_seen),
        'last_sponsor_click_at', engagement.last_sponsor_click_at,
        'sponsor_auction_id', engagement.sponsor_auction_id,
        'required_auction_id', requested_auction_id
      ),
      payout_error = ''
    where id = selected_drop.id
    returning * into selected_drop;

    return next selected_drop;
    return;
  end if;
end;
$$;

revoke all on function public.reserve_art_drop(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_art_drop(text, text, text, text)
  to service_role;
commit;
