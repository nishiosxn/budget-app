-- TEST ONLY. Reconstituted from catalog metadata read in lot 8B, never from production rows.
-- Invoked by schema.sql after the versioned historical migrations on the disposable CLI stack.
do $$ begin
 if inet_server_port()<>5432 or current_database()<>'postgres' or exists(select from auth.users) then
  raise exception 'Expected a fresh disposable Supabase instance';
 end if;
end $$;

alter table public.categories add constraint fixture_category_name_length check(char_length(name) between 1 and 100);
alter table public.households add constraint fixture_household_name_length check(char_length(name) between 1 and 80);
alter table public.household_members add constraint fixture_member_name_length check(char_length(display_name) between 1 and 60);
alter table public.budgets alter column planned_amount type numeric(12,2);
alter table public.transactions alter column amount type numeric(12,2);
alter table public.recurrences alter column amount type numeric(12,2);

-- Reproduce effective browser UPDATE grants, not the broad synthetic table grants.
revoke update on public.categories,public.budgets,public.transactions,public.recurrences,public.households,public.household_members from authenticated;
revoke update(slot) on public.household_members from authenticated;
grant update(name,group_name,owner_user_id,is_saving,archived_at,sort_order,owner_slot,excluded_months,is_custom) on public.categories to authenticated;
grant update(planned_amount,scope,owner_slot,archived_at) on public.budgets to authenticated;
grant update(category_id,amount,transaction_date,label,owner_user_id,recurrence_id,is_adjustment,adjustment_label,owner_slot,metadata,archived_at) on public.transactions to authenticated;
grant update(category_id,amount,label,owner_user_id,start_month,end_month,excluded_months,overrides,legacy_id,owner_slot,start_day,metadata,archived_at) on public.recurrences to authenticated;
grant update(name,person_a_label,person_b_label,household_mode) on public.households to authenticated;

-- Actual historical guard: only direct browser writes depend on the header.
create schema if not exists incident_backup_20261116;
create function incident_backup_20261116.freeze_financial_writes()
returns trigger language plpgsql as $function$
declare
 v_headers text;
 v_client_version text;
begin
 if current_user in ('authenticated','anon') then
  v_headers:=current_setting('request.headers',true);
  if v_headers is not null and v_headers<>'' then
   begin
    v_client_version:=(v_headers::jsonb)->>'x-smart-budget-sync-version';
   exception when others then
    v_client_version:=null;
   end;
  end if;
  if v_client_version is distinct from '20261116-hf1' then
   raise exception 'Smart Budget : version obsolète bloquée pour protéger les données restaurées. Rechargez la version officielle.' using errcode='P0001';
  end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$function$;
do $$
declare t text;
begin
 foreach t in array array['households','categories','budgets','transactions','recurrences','account_opening_balances'] loop
  execute format('create trigger incident_20261116_maintenance_lock before insert or delete or update on public.%I for each row execute function incident_backup_20261116.freeze_financial_writes()',t);
 end loop;
end $$;
