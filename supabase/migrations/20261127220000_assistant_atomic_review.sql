-- Only the Edge Function can prepare or execute a reviewed pilot request.
-- Keep the financial payload server-side until execution. The browser can retain an opaque UUID.
create table private.smart_assistant_reviews (
 household_id uuid not null references public.households(id) on delete cascade,
 actor uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 signature text not null,
 actions jsonb,
 rejected boolean not null default false,
 expires_at timestamptz not null default (now()+interval '1 day'),
 primary key(household_id,request_id)
);
alter table private.smart_assistant_reviews enable row level security;
revoke all on private.smart_assistant_reviews from public,anon,authenticated;

create function public.smart_assistant_atomic_review(
 p_household uuid,p_actor uuid,p_roster uuid[],p_request uuid,p_action text,p_actions jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 ticket private.smart_assistant_reviews%rowtype;
 roster uuid[];
 mode text;
 actor_slot text;
 saved_result jsonb;
 op jsonb;
 kind text;
 cat public.categories%rowtype;
 budget public.budgets%rowtype;
 effective public.budgets%rowtype;
 movements jsonb:='[]';
 movement_result jsonb;
 today date:=(now() at time zone 'Europe/Paris')::date;
 target_month date;
 first_free date;
 stop_month date;
 cents bigint;
 planned bigint;
 new_scope text;
 legacy text;
 name_text text;
 owner_slot_code text;
 plan_keys text[]:='{}';
 plan_key text;
 count_ops integer:=0;
 created integer:=0;
 order_no integer;
begin
 if p_household is null or p_actor is null or p_request is null or p_action is null
  or p_action not in ('prepare','status','commit') or p_roster is null
  or cardinality(p_roster) not between 1 and 2 or array_position(p_roster,null) is not null then
  return jsonb_build_object('status','invalid');
 end if;
 select household_mode into mode from public.households where id=p_household for update;
 select array_agg(user_id order by user_id),max(slot) filter(where user_id=p_actor)
 into roster,actor_slot from (
  select user_id,slot from public.household_members where household_id=p_household for share
 ) m;
 if mode is null or mode not in ('solo','couple') or roster is null or not (p_actor=any(roster))
  or not (roster <@ p_roster and p_roster <@ roster) or cardinality(roster)<>(case when mode='solo' then 1 else 2 end)
  or actor_slot is null or actor_slot not in ('A','B') or (mode='solo' and actor_slot<>'B') then
  return jsonb_build_object('status','forbidden');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_household::text,3101));
 select * into ticket from private.smart_assistant_reviews where household_id=p_household and request_id=p_request for update;
 if found and ticket.actor<>p_actor then return jsonb_build_object('status','forbidden'); end if;
 if p_action='prepare' then
  if jsonb_typeof(p_actions) is distinct from 'array' or pg_column_size(p_actions)>24000 then
   return jsonb_build_object('status','invalid');
  end if;
  if jsonb_array_length(p_actions) not between 1 and 12 then return jsonb_build_object('status','invalid');end if;
  if ticket.request_id is null then
   if exists(select 1 from public.smart_assistant_pilot_batch_receipts where household_id=p_household and request_id=p_request) then
    return jsonb_build_object('status','conflict');end if;
   update private.smart_assistant_reviews set actions=null
    where household_id=p_household and actor=p_actor and expires_at<=now() and actions is not null;
   if (select count(*) from private.smart_assistant_reviews where household_id=p_household and actor=p_actor and actions is not null)>=12 then
    return jsonb_build_object('status','invalid');end if;
   insert into private.smart_assistant_reviews(household_id,actor,request_id,signature,actions)
    values(p_household,p_actor,p_request,md5(p_actions::text),p_actions);
   return jsonb_build_object('status','prepared');
  elsif ticket.signature<>md5(p_actions::text) then
   return jsonb_build_object('status','conflict');
  end if;
 end if;
 if ticket.request_id is null then return jsonb_build_object('status','missing');end if;
 select result into saved_result from public.smart_assistant_pilot_batch_receipts
  where household_id=p_household and request_id=p_request and payload_hash='review-'||ticket.signature;
 if found then return saved_result||jsonb_build_object('status','complete');end if;
 if ticket.rejected then return jsonb_build_object('status','rejected');end if;
 if ticket.actions is null or ticket.expires_at<=now() then return jsonb_build_object('status','expired');end if;
 if p_action<>'commit' then return jsonb_build_object('status','prepared');end if;

 begin
  for op in select value from jsonb_array_elements(ticket.actions) loop
   count_ops:=count_ops+1;
   kind:=op->>'kind';
   if kind='create_category' then
    name_text:=regexp_replace(btrim(op->>'name'),'\s+',' ','g');
    target_month:=((op->>'month')||'-01')::date;
    owner_slot_code:=op->>'owner';
    cents:=(op->>'budgetCents')::bigint;
    if name_text is null or name_text !~ '^[[:alnum:]][[:alnum:] /&''_-]{0,59}$'
     or target_month is null or target_month>date_trunc('month',today)+interval '2 years'
     or owner_slot_code is distinct from actor_slot or (cents is not null and cents not between 0 and 100000000)
     or exists(select 1 from public.categories c where c.household_id=p_household and c.archived_at is null
        and regexp_replace(lower(btrim(c.name)),'\s+',' ','g')=lower(name_text)) then
     raise exception using errcode='P0001',message='category changed';
    end if;
    select count(*) into order_no from public.categories where household_id=p_household and archived_at is null;
    if order_no>=300 then raise invalid_parameter_value;end if;
    legacy:='smart-category-'||p_request::text||'-'||count_ops;
    insert into public.categories(household_id,legacy_id,name,type,group_name,owner_slot,is_saving,created_from,is_custom,sort_order)
     values(p_household,legacy,name_text,'expense','Vie courante',owner_slot_code,false,target_month,true,order_no)
     returning * into cat;
    if cents is not null then
     insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
      values(p_household,cat.id,target_month,cents::numeric/100,'forward',owner_slot_code);
    end if;
    if op->>'expenseCents' is not null then
     if date_trunc('month',(op->>'date')::date)::date is distinct from target_month then raise invalid_parameter_value;end if;
     movements:=movements||jsonb_build_array(jsonb_build_object('kind','expense','categoryId',legacy,'owner',owner_slot_code,
      'date',op->>'date','label',name_text,'frequency','once','amountCents',(op->>'expenseCents')::bigint));
    end if;
    created:=created+1;
    continue;
   end if;
   select * into cat from public.categories c where c.household_id=p_household
    and c.archived_at is null and coalesce(c.legacy_id,c.id::text)=op->>'categoryId' for update;
   if not found or cat.updated_at is distinct from (op->>'categoryVersion')::timestamptz then
    raise exception using errcode='P0001',message='category changed';
   end if;
   if kind in ('expense','income','saving') then
    movements:=movements||jsonb_build_array(op-'categoryVersion');
    continue;
   end if;
   if kind is distinct from 'plan' or coalesce(op->>'frequency','') not in ('once','monthly')
    or coalesce(op->>'planMode','') not in ('set','increase','decrease')
    or coalesce(op->>'amountCents','') !~ '^[0-9]{1,9}$' then raise invalid_parameter_value;end if;
   cents:=(op->>'amountCents')::bigint;
   if cents>100000000 or (cents=0 and op->>'planMode'<>'set') then raise invalid_parameter_value;end if;
   target_month:=(op->>'date')::date;
   plan_key:=cat.id::text||'/'||target_month::text;
   if extract(day from target_month)<>1 or target_month<cat.created_from or cat.excluded_months ? to_char(target_month,'YYYY-MM')
    or target_month>date_trunc('month',today)+interval '2 years' or plan_key=any(plan_keys)
    or exists(select 1 from jsonb_array_elements(ticket.actions) candidate
     where candidate->>'kind'='plan' and candidate->>'categoryId'=op->>'categoryId'
      and candidate->>'date'<>op->>'date' and (op->>'frequency'='monthly' or candidate->>'frequency'='monthly'))
    then raise exception using errcode='P0001',message='budget changed';end if;
   plan_keys:=array_append(plan_keys,plan_key);
   select * into effective from public.budgets b where b.household_id=p_household and b.category_id=cat.id
    and b.archived_at is null and b.month<=target_month and (b.scope='forward' or (b.scope='month' and b.month=target_month))
    order by b.month desc limit 1 for update;
   planned:=coalesce(round(effective.planned_amount*100)::bigint,0);
   if planned is distinct from (op->>'beforeCents')::bigint
    or effective.updated_at is distinct from (op->>'budgetVersion')::timestamptz then
    raise exception using errcode='P0001',message='budget changed';end if;
   owner_slot_code:=case when effective.id is null then cat.owner_slot else effective.owner_slot end;
   planned:=case op->>'planMode' when 'increase' then planned+cents when 'decrease' then planned-cents else cents end;
   if planned not between 0 and 100000000 then raise invalid_parameter_value;end if;
   new_scope:=case op->>'frequency' when 'monthly' then 'forward' else 'month' end;
   select * into budget from public.budgets where household_id=p_household and category_id=cat.id and month=target_month for update;
   if found then
    if budget.archived_at is not null then raise exception using errcode='P0001',message='budget archived';end if;
    -- Preserve the original forward rule when its starting month gets an exception.
    if budget.scope='forward' and new_scope='month' then
     select min(b.month) into stop_month from public.budgets b where b.household_id=p_household and b.category_id=cat.id
      and b.archived_at is null and b.scope='forward' and b.month>target_month;
     first_free:=(target_month+interval '1 month')::date;
     while (stop_month is null or first_free<stop_month) and first_free<(target_month+interval '20 years')::date
        and exists(select 1 from public.budgets b where b.household_id=p_household and b.category_id=cat.id and b.month=first_free)
     loop first_free:=(first_free+interval '1 month')::date; end loop;
     if stop_month is null or first_free<stop_month then
      if first_free>=(target_month+interval '20 years')::date then raise invalid_parameter_value;end if;
      insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
       values(p_household,cat.id,first_free,budget.planned_amount,'forward',budget.owner_slot);
     end if;
    end if;
    update public.budgets set planned_amount=planned::numeric/100,scope=new_scope,owner_slot=owner_slot_code,updated_at=now()
     where id=budget.id;
   else
    insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
     values(p_household,cat.id,target_month,planned::numeric/100,new_scope,owner_slot_code);
   end if;
  end loop;
  if jsonb_array_length(movements)>0 then
   movement_result:=public.smart_assistant_confirm_movements(p_household,p_actor,p_roster,gen_random_uuid(),movements);
   if movement_result->>'status' is distinct from 'created' then
    raise exception using errcode='P0001',message='movement changed';end if;
  end if;
  saved_result:=jsonb_build_object('count',count_ops,'categoriesCreated',created);
  insert into public.smart_assistant_pilot_batch_receipts(household_id,request_id,payload_hash,result)
   values(p_household,p_request,'review-'||ticket.signature,saved_result);
  update private.smart_assistant_reviews set actions=null where household_id=p_household and request_id=p_request;
  return saved_result||jsonb_build_object('status','complete');
 exception when raise_exception or data_exception or integrity_constraint_violation then
  -- The subtransaction rolls back every financial action. Keep a terminal refusal for retries.
  update private.smart_assistant_reviews set actions=null,rejected=true where household_id=p_household and request_id=p_request;
  return jsonb_build_object('status','rejected');
 end;
end $$;
revoke all on function public.smart_assistant_atomic_review(uuid,uuid,uuid[],uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.smart_assistant_atomic_review(uuid,uuid,uuid[],uuid,text,jsonb) to service_role;
