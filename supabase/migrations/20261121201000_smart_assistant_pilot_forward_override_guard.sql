-- 31aj follow-up: preserve future forward budgets when overriding the
-- forward rule's *start month* with a month-only value. Applied after
-- 20261121195500_smart_assistant_pilot_atomic_batch.sql.
create or replace function public.smart_assistant_commit_batch_pilot_v1(
  p_household_id uuid, p_actor_user_id uuid, p_request_id uuid, p_actions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
 v_allow boolean;
 v_today date := (pg_catalog.now() at time zone 'Europe/Paris')::date;
 v_hash text;
 v_receipt public.smart_assistant_pilot_batch_receipts%rowtype;
 v_action jsonb;
 v_kind text;
 v_index integer := 0;
 v_total integer;
 v_category public.categories%rowtype;
 v_category_id uuid;
 v_month date;
 v_date date;
 v_scope text;
 v_mode text;
 v_amount bigint;
 v_before bigint;
 v_current bigint;
 v_after bigint;
 v_plan public.budgets%rowtype;
 v_next_month date;
 v_stop_month date;
 v_restored boolean;
 v_label text;
 v_name text;
 v_child jsonb;
 v_expense bigint;
 v_created integer := 0;
 v_seen_categories uuid[] := '{}';
 v_result jsonb;
begin
 if p_household_id is null or p_actor_user_id is null or p_request_id is null
    or p_actions is null or pg_catalog.jsonb_typeof(p_actions)<>'array'
    or pg_catalog.jsonb_array_length(p_actions) not between 1 and 12 then
   return pg_catalog.jsonb_build_object('status','invalid');
 end if;
 select exists(
  select 1 from public.households h where h.id=p_household_id
    and h.household_mode='solo'
    and (select pg_catalog.count(*) from public.household_members m where m.household_id=h.id)=1
    and exists(select 1 from public.household_members m where m.household_id=h.id
      and m.user_id=p_actor_user_id and m.slot='B')
 ) into v_allow;
 if not v_allow then return pg_catalog.jsonb_build_object('status','forbidden'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text,3101));
 v_hash := pg_catalog.md5(p_actions::text);
 select * into v_receipt from public.smart_assistant_pilot_batch_receipts
  where household_id=p_household_id and request_id=p_request_id for update;
 if found then
  if v_receipt.payload_hash<>v_hash then return pg_catalog.jsonb_build_object('status','conflict'); end if;
  return pg_catalog.jsonb_build_object('status','same','count',v_receipt.result->'count','categoriesCreated',v_receipt.result->'categoriesCreated');
 end if;

 begin
  v_total:=pg_catalog.jsonb_array_length(p_actions);
  for v_action in select value from pg_catalog.jsonb_array_elements(p_actions) loop
   v_index:=v_index+1;
   if pg_catalog.jsonb_typeof(v_action)<>'object' then
    raise exception using errcode='P0002',message='invalid action';
   end if;
   v_kind:=v_action->>'kind';
   if v_kind='create_category' then
    v_name:=v_action->>'name';
    if (v_action->>'budgetCents') !~ '^[0-9]{1,9}$'
       or (v_action->>'budgetCents')::bigint>100000000
       or (v_action->>'month') !~ '^\d{4}-(0[1-9]|1[0-2])$'
       or (v_action->>'expenseCents') is not null
            and ((v_action->>'expenseCents') !~ '^[0-9]{1,9}$' or (v_action->>'expenseCents')::bigint>100000000)
       then raise exception using errcode='P0002',message='invalid category'; end if;
    v_month := ((v_action->>'month')||'-01')::date;
    v_expense:=nullif(v_action->>'expenseCents','')::bigint;
    v_date:=nullif(v_action->>'expenseDate','')::date;
    -- The existing service-only RPC enforces name, dates, one-user household,
    -- active duplicates, and atomic category + forward budget + first expense.
    select public.smart_assistant_create_category_pilot_v2(
      p_household_id,p_actor_user_id,pg_catalog.gen_random_uuid(),v_name,
      v_month,(v_action->>'budgetCents')::bigint,v_expense,v_date
    ) into v_child;
    if v_child->>'status'<>'created' then
      raise exception using errcode='P0001',message='category conflict';
    end if;
    v_created:=v_created+1;
   elsif v_kind in ('expense','income','plan') then
    if (v_action->>'categoryId') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
       or (v_action->>'amountCents') !~ '^[0-9]{1,9}$'
       or (v_action->>'amountCents')::bigint>100000000 then
      raise exception using errcode='P0002',message='invalid operation';
    end if;
    v_category_id:=(v_action->>'categoryId')::uuid;
    v_amount:=(v_action->>'amountCents')::bigint;
    select * into v_category from public.categories
     where household_id=p_household_id and id=v_category_id and archived_at is null
       and owner_slot='B' and is_saving=false for update;
    if not found then raise exception using errcode='P0001',message='category unavailable'; end if;
    if v_kind='plan' then
     if v_category.type not in ('expense','income')
        or (v_action->>'month') !~ '^\d{4}-(0[1-9]|1[0-2])$'
        or (v_action->>'frequency') not in ('once','monthly')
        or (v_action->>'planMode') not in ('set','increase','decrease')
        or (v_action->>'beforeCents') !~ '^[0-9]{1,9}$'
        or (v_action->>'beforeCents')::bigint>100000000 then
      raise exception using errcode='P0002',message='invalid plan';
     end if;
     v_month:=((v_action->>'month')||'-01')::date;
     if v_month<v_category.created_from
        or v_month> (pg_catalog.date_trunc('month',v_today::timestamp)+interval '2 years')::date
        or v_category.excluded_months ? pg_catalog.to_char(v_month,'YYYY-MM')
        or v_category_id=any(v_seen_categories) then
      raise exception using errcode='P0001',message='plan conflict';
     end if;
     v_seen_categories:=pg_catalog.array_append(v_seen_categories,v_category_id);
     v_scope:=case when v_action->>'frequency'='monthly' then 'forward' else 'month' end;
     v_mode:=v_action->>'planMode';
     v_before:=(v_action->>'beforeCents')::bigint;
     select pg_catalog.round(b.planned_amount*100)::bigint into v_current
       from public.budgets b
       where b.household_id=p_household_id and b.category_id=v_category_id
         and b.archived_at is null and b.month<=v_month
         and (b.scope='forward' or b.scope='month' and b.month=v_month)
       order by case when b.scope='month' and b.month=v_month then 0 else 1 end,
                b.month desc limit 1 for update;
     v_current:=coalesce(v_current,0);
     if v_current<>v_before then raise exception using errcode='P0001',message='stale budget'; end if;
     v_after:=case v_mode when 'set' then v_amount
              when 'increase' then v_current+v_amount
              else v_current-v_amount end;
     if v_after<0 or v_after>100000000 then raise exception using errcode='P0002',message='invalid total'; end if;
     select * into v_plan from public.budgets where household_id=p_household_id
       and category_id=v_category_id and month=v_month for update;
     if found then
      if v_plan.archived_at is not null then raise exception using errcode='P0001',message='archived budget'; end if;
      -- A forward rule must not vanish when the user edits its *starting*
      -- month only. Restore the old recurring value at the earliest following
      -- month with no explicit budget row, before the next forward rule.
      if v_plan.scope='forward' and v_scope='month' then
       select min(b.month) into v_stop_month from public.budgets b
        where b.household_id=p_household_id and b.category_id=v_category_id
          and b.archived_at is null and b.scope='forward' and b.month>v_month;
       v_next_month:=(v_month+interval '1 month')::date;
       v_restored:=false;
       while (v_stop_month is null or v_next_month<v_stop_month)
          and v_next_month<(v_month+interval '20 years')::date loop
        if not exists(select 1 from public.budgets b
          where b.household_id=p_household_id and b.category_id=v_category_id
            and b.month=v_next_month) then
         insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
          values(p_household_id,v_category_id,v_next_month,v_plan.planned_amount,'forward','B');
         v_restored:=true;
         exit;
        end if;
        v_next_month:=(v_next_month+interval '1 month')::date;
       end loop;
       if not v_restored and v_stop_month is null then
        raise exception using errcode='P0001',message='cannot preserve future forward rule';
       end if;
      end if;
      update public.budgets set planned_amount=v_after::numeric/100,scope=v_scope,
         owner_slot='B',updated_at=pg_catalog.now()
       where id=v_plan.id;
     else
      insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
       values(p_household_id,v_category_id,v_month,v_after::numeric/100,v_scope,'B');
     end if;
    else
     if v_category.type<>v_kind
        or v_amount<=0
        or (v_action->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
        or pg_catalog.char_length(coalesce(v_action->>'label','')) not between 1 and 120
        then raise exception using errcode='P0002',message='invalid transaction'; end if;
     v_date:=(v_action->>'date')::date;
     if v_date>v_today or v_date<v_category.created_from
        or v_category.excluded_months ? pg_catalog.to_char(v_date,'YYYY-MM') then
       raise exception using errcode='P0001',message='transaction date unavailable';
     end if;
     v_label:=v_action->>'label';
     insert into public.transactions(
      household_id,category_id,legacy_id,owner_slot,amount,transaction_date,label,metadata
     ) values(
      p_household_id,v_category_id,'smart-assistant-batch-'||p_request_id::text||'-'||v_index::text,
      'B',v_amount::numeric/100,v_date,v_label,
      pg_catalog.jsonb_build_object('type',v_kind,'assistantRequestId',p_request_id::text,'origin','smart-assistant-pilot-batch')
     );
    end if;
   else
    raise exception using errcode='P0002',message='unsupported operation';
   end if;
  end loop;
  v_result:=pg_catalog.jsonb_build_object('count',v_total,'categoriesCreated',v_created);
  insert into public.smart_assistant_pilot_batch_receipts(
    household_id,request_id,payload_hash,result
  ) values(p_household_id,p_request_id,v_hash,v_result);
 exception when sqlstate 'P0001' then
  return pg_catalog.jsonb_build_object('status','conflict');
 when sqlstate 'P0002' then
  return pg_catalog.jsonb_build_object('status','invalid');
 when others then
  return pg_catalog.jsonb_build_object('status','unavailable');
 end;
 return pg_catalog.jsonb_build_object('status','created','count',v_total,'categoriesCreated',v_created);
end
$fn$;

revoke all on function public.smart_assistant_commit_batch_pilot_v1(uuid,uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.smart_assistant_commit_batch_pilot_v1(uuid,uuid,uuid,jsonb)
 to service_role;
