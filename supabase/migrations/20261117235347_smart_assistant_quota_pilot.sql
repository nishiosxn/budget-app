-- Isolated pilot quota; no financial table changes.
-- One shared account-level reservation counter, UTC day. No financial or user data.
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

-- Transactional self-test; deliberately roll back all synthetic reservations.
do $test$
begin
 if pg_catalog.has_function_privilege('anon','public.reserve_smart_assistant_quota_v1(integer)','EXECUTE')
 or pg_catalog.has_function_privilege('authenticated','public.reserve_smart_assistant_quota_v1(integer)','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.reserve_smart_assistant_quota_v1(integer)','EXECUTE')
 then raise exception 'Unexpected quota privileges'; end if;
 begin
  if public.reserve_smart_assistant_quota_v1(0) or public.reserve_smart_assistant_quota_v1(1001) or public.reserve_smart_assistant_quota_v1(null) then raise exception 'Invalid reservation accepted'; end if;
  for i in 1..8 loop
   if not public.reserve_smart_assistant_quota_v1(1000) then raise exception 'Reservation unexpectedly refused'; end if;
  end loop;
  if public.reserve_smart_assistant_quota_v1(1) then raise exception 'Neuron cap exceeded'; end if;
  raise exception using errcode='ZX001',message='Rollback neuron cap test';
 exception when sqlstate 'ZX001' then null;
 end;
 begin
  for i in 1..100 loop
   if not public.reserve_smart_assistant_quota_v1(1) then raise exception 'Request unexpectedly refused'; end if;
  end loop;
  if public.reserve_smart_assistant_quota_v1(1) then raise exception 'Request cap exceeded'; end if;
  raise exception using errcode='ZX002',message='Rollback request cap test';
 exception when sqlstate 'ZX002' then null;
 end;
 if exists(select 1 from smart_assistant_private.daily_reservations) then raise exception 'Test residues'; end if;
end
$test$;
