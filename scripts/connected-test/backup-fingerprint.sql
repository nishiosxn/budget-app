\set ON_ERROR_STOP on
-- No rows printed: deterministic per-table row count and digest, plus schema contracts.
set search_path=pg_catalog;
select format('select %L,count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' order by to_jsonb(t)::text),'''')) from %I.%I t',
 n.nspname||'.'||c.relname,n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private','smart_assistant_private','smart_budget_backups','incident_backup_20261116') and c.relkind in ('r','p')
order by n.nspname,c.relname
\gexec
select 'constraint',n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid)
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private','smart_assistant_private','smart_budget_backups','incident_backup_20261116')
order by n.nspname,c.relname,k.conname;
select 'policy',schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','private','smart_assistant_private','smart_budget_backups','incident_backup_20261116')
order by schemaname,tablename,policyname;
select 'trigger',n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','private','smart_assistant_private','smart_budget_backups','incident_backup_20261116')
order by n.nspname,c.relname,t.tgname;
select 'security',n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege('anon',c.oid,'SELECT'),has_table_privilege('authenticated',c.oid,'SELECT'),
 has_table_privilege('authenticated',c.oid,'INSERT'),has_table_privilege('authenticated',c.oid,'UPDATE'),
 has_table_privilege('authenticated',c.oid,'DELETE'),has_table_privilege('service_role',c.oid,'SELECT')
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private','smart_assistant_private','smart_budget_backups','incident_backup_20261116') and c.relkind in ('r','p')
order by n.nspname,c.relname;
