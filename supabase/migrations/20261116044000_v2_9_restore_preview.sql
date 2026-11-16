-- Read-only preview of table-level and row-level changes since a private snapshot.
-- Not exposed to authenticated/anon/service_role; no restore function is exposed.
create or replace function smart_budget_backups.compare_snapshot(p_snapshot_id bigint)
returns table(
 table_name text,saved_rows bigint,current_rows bigint,
 added_since bigint,missing_since bigint,changed_since bigint
)
language plpgsql security invoker set search_path=pg_catalog as $fn$
declare
 e record;
 v_rows jsonb;
 v_old jsonb;
 v_new jsonb;
begin
 if current_user<>'postgres' then raise exception 'Operator-only restore preview'; end if;
 if not exists(select 1 from smart_budget_backups.snapshots s where s.id=p_snapshot_id and s.completed_at is not null)
 then raise exception 'Unknown or incomplete snapshot'; end if;
 for e in
   select st.source_table as tbl,st.row_count as old_count,st.rows as old_rows
   from smart_budget_backups.snapshot_tables st where st.snapshot_id=p_snapshot_id order by st.source_table
 loop
   -- The identifier is restricted by the table CHECK constraint and quoted.
   execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',e.tbl)
   into v_rows;
   select coalesce(jsonb_object_agg(
      case e.tbl when 'household_members' then item->>'household_id'||'|'||item->>'user_id'
                 when 'account_opening_balances' then item->>'household_id'||'|'||item->>'month'||'|'||item->>'owner_slot'
                 else item->>'id' end,item
   ),'{}'::jsonb) into v_old from jsonb_array_elements(e.old_rows) as item;
   select coalesce(jsonb_object_agg(
      case e.tbl when 'household_members' then item->>'household_id'||'|'||item->>'user_id'
                 when 'account_opening_balances' then item->>'household_id'||'|'||item->>'month'||'|'||item->>'owner_slot'
                 else item->>'id' end,item
   ),'{}'::jsonb) into v_new from jsonb_array_elements(v_rows) as item;
   table_name:=e.tbl;
   saved_rows:=e.old_count;
   current_rows:=jsonb_array_length(v_rows);
   select count(*) into added_since from jsonb_object_keys(v_new) as k(key) where not(v_old ? k.key);
   select count(*) into missing_since from jsonb_object_keys(v_old) as k(key) where not(v_new ? k.key);
   select count(*) into changed_since from jsonb_object_keys(v_old) as k(key)
     where v_new ? k.key and v_old->k.key is distinct from v_new->k.key;
   return next;
 end loop;
end
$fn$;
revoke all on function smart_budget_backups.compare_snapshot(bigint) from public,anon,authenticated,service_role;
comment on function smart_budget_backups.compare_snapshot(bigint) is 'Operator-only read-only row diff against a recorded snapshot; no automatic restoration.';
