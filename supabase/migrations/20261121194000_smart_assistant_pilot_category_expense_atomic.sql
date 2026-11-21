-- 31ah: atomic creation of a forward monthly category budget and optional one-off
-- expense. No deletion or history mutation. This never calls any public client.
-- Kept separate from v1 to avoid accidentally changing previously deployed RPCs.
create function public.smart_assistant_create_category_pilot_v2(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_name text,
  p_month date,
  p_budget_cents bigint,
  p_expense_cents bigint,
  p_expense_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
 v_name text;
 v_key text;
 v_legacy text;
 v_transaction_legacy text;
 v_existing public.categories%rowtype;
 v_cat_id uuid;
 v_budget public.budgets%rowtype;
 v_transaction public.transactions%rowtype;
 v_allowed boolean;
 v_count integer;
 v_today date;
begin
 if p_household_id is null or p_actor_user_id is null or p_request_id is null then
   return jsonb_build_object('status','invalid');
 end if;
 v_name := pg_catalog.btrim(p_name);
 if v_name is null or pg_catalog.char_length(v_name)<1 or pg_catalog.char_length(v_name)>60
    or v_name ~ '[<>[:cntrl:]]' or v_name !~ '^[[:alnum:]]' then
   return jsonb_build_object('status','invalid');
 end if;
 v_today := (pg_catalog.now() at time zone 'Europe/Paris')::date;
 if p_budget_cents is null or p_budget_cents < 0 or p_budget_cents > 100000000
    or p_month is null
    or p_month <> pg_catalog.date_trunc('month',p_month::timestamp)::date
    or p_month < date '2020-01-01'
    or p_month > (pg_catalog.date_trunc('month', v_today::timestamp) + interval '2 years')::date
    or (p_expense_cents is null) <> (p_expense_date is null)
    or (p_expense_cents is not null and
        (p_expense_cents<=0 or p_expense_cents>100000000
         or pg_catalog.date_trunc('month',p_expense_date::timestamp)::date<>p_month
         or p_expense_date>v_today)) then
   return jsonb_build_object('status','invalid');
 end if;
 -- The Edge Function must authenticate both identifiers and enforce an exact
 -- allowlist. This independent check ensures a one-person pilot only.
 select exists(
  select 1 from public.households h
  where h.id=p_household_id and h.household_mode='solo'
    and (select pg_catalog.count(*) from public.household_members hm
         where hm.household_id=h.id)=1
    and exists(select 1 from public.household_members hm where hm.household_id=h.id
       and hm.user_id=p_actor_user_id and hm.slot='B')
 ) into v_allowed;
 if not v_allowed then return jsonb_build_object('status','forbidden'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text, 3101));
 v_key := pg_catalog.lower(pg_catalog.regexp_replace(v_name, '\s+', ' ', 'g'));
 v_legacy := 'smart-assistant-cat-'||p_request_id::text;
 v_transaction_legacy := 'smart-assistant-initial-'||p_request_id::text;
 -- Replaying the exact request must not add another budget or expense.
 select * into v_existing from public.categories
  where household_id=p_household_id and legacy_id=v_legacy
  order by created_at limit 1;
 if found then
   if v_existing.archived_at is not null
     or pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_existing.name), '\s+', ' ', 'g'))<>v_key
     or v_existing.type<>'expense'
     or v_existing.owner_slot is distinct from 'B'
     or v_existing.is_custom is distinct from true
     or v_existing.created_from<>p_month then
      return jsonb_build_object('status','conflict');
   end if;
   select * into v_budget from public.budgets where
    household_id=p_household_id and category_id=v_existing.id
    and month=p_month and archived_at is null limit 1;
   if not found or v_budget.scope<>'forward' or v_budget.owner_slot is distinct from 'B'
      or v_budget.planned_amount<>(p_budget_cents::numeric/100) then
      return jsonb_build_object('status','conflict');
   end if;
   select * into v_transaction from public.transactions where household_id=p_household_id
    and legacy_id=v_transaction_legacy order by created_at limit 1;
   if p_expense_cents is null then
     if found then return jsonb_build_object('status','conflict'); end if;
     return jsonb_build_object('status','same','categoryId',v_existing.id::text,'name',v_existing.name,'expenseCreated',false);
   end if;
   if not found or v_transaction.archived_at is not null
      or v_transaction.category_id<>v_existing.id
      or v_transaction.owner_slot is distinct from 'B'
      or v_transaction.transaction_date<>p_expense_date
      or v_transaction.amount<>(p_expense_cents::numeric/100)
      or v_transaction.label is distinct from v_existing.name
      or v_transaction.metadata->>'type' is distinct from 'expense'
      or v_transaction.metadata->>'assistantRequestId' is distinct from p_request_id::text then
     return jsonb_build_object('status','conflict');
   end if;
   return jsonb_build_object('status','same','categoryId',v_existing.id::text,'name',v_existing.name,'expenseCreated',true);
 end if;
 -- Only one active category of this name can exist in a household.
 if exists(select 1 from public.categories c where c.household_id=p_household_id
    and c.archived_at is null
    and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(c.name), '\s+', ' ', 'g'))=v_key) then
   return jsonb_build_object('status','duplicate');
 end if;
 select pg_catalog.count(*) into v_count from public.categories
   where household_id=p_household_id and archived_at is null;
 if v_count>=300 then return jsonb_build_object('status','limit'); end if;
 insert into public.categories(
   household_id,legacy_id,name,type,group_name,owner_slot,owner_user_id,
   is_saving,created_from,is_custom,sort_order
 ) values(
   p_household_id,v_legacy,v_name,'expense','Vie courante','B',null,
   false,p_month,true,v_count
 ) returning id into v_cat_id;
 -- A single 'forward' budget persists month after month until replaced.
 insert into public.budgets(
   household_id,category_id,month,planned_amount,scope,owner_slot
 ) values(
   p_household_id,v_cat_id,p_month,p_budget_cents::numeric/100,'forward','B'
 );
 if p_expense_cents is not null then
   insert into public.transactions(
     household_id,category_id,legacy_id,owner_slot,amount,transaction_date,
     label,metadata
   ) values(
     p_household_id,v_cat_id,v_transaction_legacy,'B',p_expense_cents::numeric/100,
     p_expense_date,v_name,
     pg_catalog.jsonb_build_object('type','expense','assistantRequestId',p_request_id::text,'origin','smart-assistant-category-creation')
   );
 end if;
 return jsonb_build_object('status','created','categoryId',v_cat_id::text,'name',v_name,'expenseCreated',p_expense_cents is not null);
end
$fn$;

revoke all on function public.smart_assistant_create_category_pilot_v2(uuid,uuid,uuid,text,date,bigint,bigint,date)
 from public, anon, authenticated;
grant execute on function public.smart_assistant_create_category_pilot_v2(uuid,uuid,uuid,text,date,bigint,bigint,date)
 to service_role;
