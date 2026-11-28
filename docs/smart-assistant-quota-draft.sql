-- REVIEW ONLY. Not a migration, not applied. Test in a disposable Supabase database first.
-- One shared account-level reservation counter, UTC day. No financial or user data.
begin;
create schema smart_assistant_private;
revoke all on schema smart_assistant_private from public, anon, authenticated;
grant usage on schema smart_assistant_private to service_role;
create table smart_assistant_private.daily_reservations (
 utc_day date primary key,
 units integer not null check (units between 1 and 8000),
 requests integer not null check (requests between 1 and 100)
);
alter table smart_assistant_private.daily_reservations enable row level security;
revoke all on table smart_assistant_private.daily_reservations from public, anon, authenticated;
grant select, insert, update on table smart_assistant_private.daily_reservations to service_role;
create function public.reserve_smart_assistant_quota_v1(p_units integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare accepted boolean;
begin
 if p_units is null or p_units < 1 or p_units > 1000 then return false; end if;
 insert into smart_assistant_private.daily_reservations as d (utc_day, units, requests)
 values ((pg_catalog.now() at time zone 'UTC')::date, p_units, 1)
 on conflict (utc_day) do update
 set units = d.units + excluded.units, requests = d.requests + 1
 where d.units + excluded.units <= 8000 and d.requests < 100
 returning true into accepted;
 return coalesce(accepted, false);
end;
$$;
revoke all on function public.reserve_smart_assistant_quota_v1(integer) from public, anon, authenticated;
grant execute on function public.reserve_smart_assistant_quota_v1(integer) to service_role;
commit;
