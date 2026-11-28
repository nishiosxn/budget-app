-- Disposable fixture only: definition compared to the hosted catalog, no data copied.
CREATE OR REPLACE FUNCTION public.smart_assistant_quota_status_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select pg_catalog.jsonb_build_object(
  'utcDay', ((pg_catalog.now() at time zone 'UTC')::date)::text,
  'units', coalesce(d.units, 0),
  'requests', coalesce(d.requests, 0),
  'limit', 8000,
  'requestLimit', 100
)
from (select 1) as anchor
left join smart_assistant_private.daily_reservations as d
  on d.utc_day=(pg_catalog.now() at time zone 'UTC')::date;
$function$;
revoke all on function public.smart_assistant_quota_status_v1() from public,anon,authenticated;
grant execute on function public.smart_assistant_quota_status_v1() to service_role;
