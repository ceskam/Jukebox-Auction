-- Raise the card-funded auction floor without changing the wallet-funded floor.
-- Safe to run more than once after database/winner-only-auctions.sql.

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
  minimum_bid numeric := 5.00;
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
  if current_highest > 0 then
    minimum_bid := greatest(5.00, ceil((current_highest + 1) * 100) / 100);
  end if;
  if auth_record.bid_value_usdc < minimum_bid then
    raise exception 'The minimum card bid is %.', to_char(minimum_bid, 'FM999999990.00');
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

revoke all on function public.record_card_authorized_bid(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_card_authorized_bid(uuid, text)
  to service_role;
