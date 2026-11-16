-- Schedule private full-database financial snapshots every 6 hours.
-- pg_cron is installed only after the schema and initial manual snapshot passed verification.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- pg_cron uses the database timezone (UTC on this project).
-- Job names are stable; the daily snapshots are kept 30 days.
select cron.schedule(
 'smart-budget-financial-snapshot-every-6h',
 '17 */6 * * *',
 'select smart_budget_backups.capture_snapshot(''scheduled'');'
);
