-- A pending Builder can only be provisioned with a new personal household.
create table private.budget_builder_setup (
 household_id uuid primary key references public.households(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid,
 draft jsonb,
 completed_at timestamptz
);
alter table private.budget_builder_setup enable row level security;
revoke all on private.budget_builder_setup from public, anon, authenticated;

create function public.provision_budget_builder(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 household uuid;
begin
 if actor is null then raise insufficient_privilege; end if;
 -- Same lock as ensure_personal_household, including for older clients.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 select m.household_id into household from public.household_members m
 where m.user_id=actor order by m.joined_at,m.household_id limit 1;
 if found then return household; end if;
 household:=public.ensure_personal_household(p_name,p_display_name);
 insert into private.budget_builder_setup(household_id,owner_id) values(household,actor);
 return household;
end
$$;

create function public.budget_builder_setup(p_household uuid, p_action text default 'status',
 p_request uuid default null, p_draft jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 setup private.budget_builder_setup%rowtype;
 row_data jsonb;
 ids text[]:='{}';
 inserted_id uuid;
 category_id text;
 budget_cents numeric;
 start_month date;
 draft_mode text;
begin
 if actor is null or not exists(select 1 from public.household_members m
     where m.household_id=p_household and m.user_id=actor and m.role='owner' and m.slot='B') then
  raise insufficient_privilege;
 end if;

 select * into setup from private.budget_builder_setup b
 where b.household_id=p_household and b.owner_id=actor for update;
 if not found then
  if p_action='status' then return jsonb_build_object('status','unavailable');end if;
  raise insufficient_privilege;
 end if;
 if p_action is null or p_action not in ('status','stage','commit') then
  raise exception 'Invalid builder action' using errcode='22023';
 end if;
 if setup.completed_at is not null then
  return jsonb_build_object('status','complete','requestId',setup.request_id);
 end if;
 if p_action='status' then
  return case when setup.request_id is null then jsonb_build_object('status','pending')
   else jsonb_build_object('status','staged','requestId',setup.request_id,'draft',setup.draft) end;
 end if;

 -- Serialize against household changes and new children referencing this foyer.
 perform 1 from public.households where id=p_household and created_by=actor for update;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.household_members
  where household_id=p_household and user_id=actor and role='owner' and slot='B' for update;
 if not found or exists(select 1 from public.household_members where household_id=p_household and user_id<>actor)
 then raise insufficient_privilege; end if;
 if exists(select 1 from public.categories where household_id=p_household)
  or exists(select 1 from public.budgets where household_id=p_household)
  or exists(select 1 from public.transactions where household_id=p_household)
  or exists(select 1 from public.recurrences where household_id=p_household)
 then raise exception 'Ce foyer contient déjà des données budgétaires.' using errcode='55000';end if;
 if p_request is null then raise exception 'Missing builder request' using errcode='22023';end if;

 if p_action='stage' then
  if setup.request_id is not null then
   if setup.request_id<>p_request or setup.draft is distinct from p_draft then
    return jsonb_build_object('status','staged','requestId',setup.request_id,'draft',setup.draft);
   end if;
   return jsonb_build_object('status','staged','requestId',p_request);
  end if;
  draft_mode:=p_draft->>'mode';
  if jsonb_typeof(p_draft) is distinct from 'object' or pg_column_size(p_draft)>150000
   or coalesce(draft_mode,'') not in ('solo','couple')
   or char_length(coalesce(p_draft->>'name','')) not between 1 and 80
   or char_length(coalesce(p_draft->>'personB','')) not between 1 and 40
   or char_length(coalesce(p_draft->>'personA','')) not between 1 and 40
   or coalesce(p_draft->>'month','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-01$'
   or jsonb_typeof(p_draft->'categories') is distinct from 'array'
   or jsonb_typeof(p_draft->'appearance') is distinct from 'object'
  then raise exception 'Invalid builder draft' using errcode='22023';end if;
  if jsonb_array_length(p_draft->'categories')>250 then
   raise exception 'Too many categories' using errcode='22023';
  end if;
  for row_data in select value from jsonb_array_elements(p_draft->'categories') loop
   category_id:=row_data->>'id';
   if coalesce(category_id,'') !~ '^[a-z0-9][a-z0-9_-]{0,100}$' or category_id=any(ids)
    or char_length(coalesce(row_data->>'name','')) not between 1 and 120
    or coalesce(row_data->>'type','') not in ('income','expense')
    or coalesce(row_data->>'owner','') not in ('A','B','common')
    or (draft_mode='solo' and row_data->>'owner'<>'B')
    or (row_data->>'type'='expense' and coalesce(row_data->>'section','') not in ('Obligatoires','Abonnements','Vie courante'))
    or jsonb_typeof(row_data->'saving') is distinct from 'boolean'
    or jsonb_typeof(row_data->'custom') is distinct from 'boolean'
    or (row_data->>'type'='income' and row_data->'saving'='true'::jsonb)
    or jsonb_typeof(row_data->'amountCents') is distinct from 'number'
    or coalesce(row_data->>'amountCents','') !~ '^[0-9]{1,10}$'
   then raise exception 'Invalid builder category' using errcode='22023';end if;
   ids:=array_append(ids,category_id);
  end loop;
  update private.budget_builder_setup set request_id=p_request,draft=p_draft where household_id=p_household;
  return jsonb_build_object('status','staged','requestId',p_request);
 end if;

 if setup.request_id is distinct from p_request or setup.draft is null then
  raise exception 'Unknown builder request' using errcode='22023';
 end if;
 start_month:=(setup.draft->>'month')::date;
 update public.households set name=setup.draft->>'name',person_b_label=setup.draft->>'personB',
  person_a_label=setup.draft->>'personA',household_mode=setup.draft->>'mode' where id=p_household;
 update public.household_members set display_name=setup.draft->>'personB' where household_id=p_household and user_id=actor;
 for row_data in select value from jsonb_array_elements(setup.draft->'categories') loop
  budget_cents:=(row_data->>'amountCents')::numeric;
  insert into public.categories(household_id,legacy_id,name,type,group_name,owner_slot,is_saving,is_custom,created_from,sort_order)
  values(p_household,row_data->>'id',row_data->>'name',row_data->>'type',
   case when row_data->>'type'='expense' then row_data->>'section' end,
   nullif(row_data->>'owner','common'),(row_data->>'saving')::boolean,(row_data->>'custom')::boolean,
   start_month,cardinality(ids)) returning id into inserted_id;
  insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
  values(p_household,inserted_id,start_month,budget_cents/100,'forward',nullif(row_data->>'owner','common'));
  ids:=array_append(ids,row_data->>'id');
 end loop;

 -- The receipt is committed with the financial rows and survives a lost HTTP response.
 update private.budget_builder_setup set draft=null,completed_at=clock_timestamp() where household_id=p_household;
 return jsonb_build_object('status','complete','requestId',p_request);
end
$$;

revoke all on function public.provision_budget_builder(text,text),
 public.budget_builder_setup(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.provision_budget_builder(text,text),
 public.budget_builder_setup(uuid,text,uuid,jsonb) to authenticated;
