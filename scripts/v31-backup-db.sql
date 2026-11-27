-- The parent script requires smart_budget_ci and rolls back the entire drill.
alter table public.transactions add id uuid primary key default gen_random_uuid();
alter table public.recurrences add id uuid primary key default gen_random_uuid();
create table public.budgets(id uuid primary key);
create table public.household_invites(id uuid primary key);
create table public.account_opening_balances(household_id uuid,month date,owner_slot text);
\ir ../supabase/migrations/20261116025347_v2_9_private_rolling_snapshots.sql
\ir ../supabase/migrations/20261116025548_v2_9_restore_preview.sql
do $$
declare
 snapshot bigint;
 target uuid;
 before_restore bigint;
 delta record;
begin
 assert not has_schema_privilege('authenticated','smart_budget_backups','usage');
 assert not has_schema_privilege('service_role','smart_budget_backups','usage');
 snapshot:=smart_budget_backups.capture_snapshot('manual');
 assert (select count(*)=8 from smart_budget_backups.compare_snapshot(snapshot));
 select id into strict target from public.transactions where owner_slot='A';
 update public.transactions set amount=amount+0.01 where id=target;
 select * into strict delta from smart_budget_backups.compare_snapshot(snapshot) where table_name='transactions';
 assert delta.changed_since=1 and delta.added_since=0 and delta.missing_since=0;
 before_restore:=smart_budget_backups.capture_snapshot('pre_restore');
 -- Restore a single reviewed field, without replacing a table or another household.
 update public.transactions t set amount=old.amount from smart_budget_backups.snapshot_tables s
 cross join lateral jsonb_to_recordset(s.rows) as old(id uuid,household_id uuid,amount numeric)
 where s.snapshot_id=snapshot and s.source_table='transactions'
   and t.id=target and t.id=old.id and t.household_id=old.household_id;
 assert not exists(select from smart_budget_backups.compare_snapshot(snapshot)
                   where changed_since+added_since+missing_since<>0);
 assert (select changed_since=1 from smart_budget_backups.compare_snapshot(before_restore) where table_name='transactions');
end $$;
