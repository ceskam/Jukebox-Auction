-- Run this once in the Supabase SQL editor before opening the live beta.
-- The application only accesses these tables through trusted server routes.

alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.attention_content enable row level security;
alter table public.attention_events enable row level security;

revoke all on table public.auctions from anon, authenticated;
revoke all on table public.bids from anon, authenticated;
revoke all on table public.attention_content from anon, authenticated;
revoke all on table public.attention_events from anon, authenticated;
revoke usage, select on all sequences in schema public from anon, authenticated;

grant select, insert, update, delete on table public.auctions to service_role;
grant select, insert, update, delete on table public.bids to service_role;
grant select, insert, update, delete on table public.attention_content to service_role;
grant select, insert, update, delete on table public.attention_events to service_role;
grant usage, select on all sequences in schema public to service_role;
