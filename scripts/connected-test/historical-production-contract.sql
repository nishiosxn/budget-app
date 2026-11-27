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

-- Complete the historical access contract observed in lot 8B. This fixture
-- models browser privileges; it is not a production schema dump.
create function private.user_is_household_member(p_household_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.household_members hm
  where hm.household_id=p_household_id and hm.user_id=p_user_id)
$$;
create function private.is_household_creator(p_household_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.households h where h.id=p_household_id and h.created_by=(select auth.uid()))
$$;
revoke all on function private.user_is_household_member(uuid,uuid),private.is_household_creator(uuid) from public,anon,authenticated;
grant execute on function private.user_is_household_member(uuid,uuid),private.is_household_creator(uuid) to authenticated;

-- Retain the real membership policy for reads and require category owners to
-- belong to the target household on both insert and update.
do $$
declare t text; predicate text;
begin
 foreach t in array array['categories','budgets','transactions','recurrences'] loop
  predicate:='private.is_household_member(household_id)';
  if t<>'budgets' then
   predicate:=predicate||' and (owner_user_id is null or private.user_is_household_member(household_id,owner_user_id))';
  end if;
  execute format('drop policy members_insert on public.%I',t);
  execute format('drop policy members_update on public.%I',t);
  execute format('create policy members_insert on public.%I for insert to authenticated with check (%s)',t,predicate);
  execute format('create policy members_update on public.%I for update to authenticated using(private.is_household_member(household_id)) with check (%s)',t,predicate);
  execute format('create policy members_delete on public.%I for delete to authenticated using(private.is_household_member(household_id))',t);
 end loop;
end $$;
create policy owners_delete_household on public.households for delete to authenticated
 using(private.is_household_owner(id));
create policy creators_insert_household on public.households for insert to authenticated
 with check(created_by=(select auth.uid()));
create policy creators_insert_membership on public.household_members for insert to authenticated
 with check((user_id=(select auth.uid()) and role='owner' and private.is_household_creator(household_id))
   or (role='member' and private.is_household_owner(household_id)));
create policy owner_or_self_update_membership on public.household_members for update to authenticated
 using(user_id=(select auth.uid()) or private.is_household_owner(household_id))
 with check(user_id=(select auth.uid()) or private.is_household_owner(household_id));
create policy owners_remove_members on public.household_members for delete to authenticated
 using(private.is_household_owner(household_id) and user_id<>(select auth.uid()));

-- Exact observed browser table/column privileges; revoke broad fixture grants.
revoke all on public.households,public.household_members,public.categories,public.budgets,public.transactions,
 public.recurrences,public.account_opening_balances,public.household_invites,public.app_admins,public.admin_audit_log
 from public,anon,authenticated;
-- Table-level REVOKE does not remove column-level grants, so the explicit
-- UPDATE grants above are retained and no membership columns are granted.
grant select on public.households,public.household_members,public.categories,public.budgets,
 public.transactions,public.recurrences,public.account_opening_balances,public.household_invites to authenticated;
grant delete on public.households,public.categories,public.budgets,public.transactions,
 public.recurrences,public.account_opening_balances,public.household_invites to authenticated;
grant insert(id,household_id,legacy_id,name,type,group_name,owner_user_id,is_saving,created_from,archived_at,sort_order,created_at,updated_at,owner_slot,excluded_months,is_custom)
 on public.categories to authenticated;
grant insert(id,household_id,category_id,month,planned_amount,created_at,updated_at,scope,owner_slot,archived_at)
 on public.budgets to authenticated;
grant insert(id,household_id,category_id,legacy_id,amount,transaction_date,label,owner_user_id,recurrence_id,is_adjustment,adjustment_label,created_at,updated_at,owner_slot,metadata,archived_at)
 on public.transactions to authenticated;
grant insert(id,household_id,category_id,amount,label,owner_user_id,start_month,end_month,excluded_months,overrides,created_at,updated_at,legacy_id,owner_slot,start_day,metadata,archived_at)
 on public.recurrences to authenticated;
grant insert,update on public.account_opening_balances to authenticated;
grant update(name,group_name,owner_user_id,is_saving,archived_at,sort_order,owner_slot,excluded_months,is_custom) on public.categories to authenticated;
grant update(planned_amount,scope,owner_slot,archived_at) on public.budgets to authenticated;
grant update(category_id,amount,transaction_date,label,owner_user_id,recurrence_id,is_adjustment,adjustment_label,owner_slot,metadata,archived_at) on public.transactions to authenticated;
grant update(category_id,amount,label,owner_user_id,start_month,end_month,excluded_months,overrides,legacy_id,owner_slot,start_day,metadata,archived_at) on public.recurrences to authenticated;
grant update(name,person_a_label,person_b_label,household_mode) on public.households to authenticated;
create policy service_admin_audit on public.admin_audit_log for all to service_role using(true) with check(true);
create policy service_app_admins on public.app_admins for all to service_role using(true) with check(true);
revoke execute on function public.create_household(text,text) from public,anon,authenticated,service_role;

-- Additional observed constraints and defaults on the disposable schema.
alter table public.household_members add constraint fixture_member_role check(role in ('owner','member'));
alter table public.categories add constraint fixture_category_month check(created_from=date_trunc('month',created_from)::date);
alter table public.categories alter column created_from set default date_trunc('month',current_date)::date;
alter table public.budgets add constraint fixture_budget_month check(month=date_trunc('month',month)::date);
alter table public.recurrences add constraint fixture_recurrence_start_month check(start_month=date_trunc('month',start_month)::date);
alter table public.recurrences add constraint fixture_recurrence_end_month check(end_month is null or (end_month>=start_month and end_month=date_trunc('month',end_month)::date));

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
