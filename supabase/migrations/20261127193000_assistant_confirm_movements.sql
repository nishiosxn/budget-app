-- Extended pilot. Only the server can call this transaction with its own configured test roster.
create function public.smart_assistant_confirm_movements(
 p_household_id uuid,p_actor uuid,p_test_users uuid[],p_request_id uuid,p_operations jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 hmode text; roster uuid[]; signature text; receipt public.smart_assistant_pilot_batch_receipts%rowtype;
 op jsonb; cat public.categories%rowtype; owner_code text; row_type text; day date;
 today date:=(now() at time zone 'Europe/Paris')::date; amount numeric; label_text text;
 legacy text; idx integer:=0; row_meta jsonb; total integer;
begin
 if p_household_id is null or p_actor is null or p_request_id is null or p_test_users is null or cardinality(p_test_users) not between 1 and 2 or array_position(p_test_users,null) is not null then raise invalid_parameter_value;end if;
 select household_mode into strict hmode from public.households where id=p_household_id for update;
 select array_agg(user_id order by user_id) into roster from
  (select user_id from public.household_members where household_id=p_household_id for share) m;
 if roster is null or not (p_actor=any(roster)) or not (roster <@ p_test_users and p_test_users <@ roster)
  or hmode is null or hmode not in ('solo','couple') or cardinality(roster)<>(case when hmode='solo' then 1 else 2 end) then
  raise insufficient_privilege;
 end if;
 if jsonb_typeof(p_operations) is distinct from 'array' then raise invalid_parameter_value;end if;
 total:=jsonb_array_length(p_operations);
 if total not between 1 and 12 then raise invalid_parameter_value;end if;
 signature:=md5('movements-v1/'||p_actor::text||'/'||p_operations::text);
 perform pg_advisory_xact_lock(hashtextextended(p_household_id::text,3101));
 select * into receipt from public.smart_assistant_pilot_batch_receipts where household_id=p_household_id and request_id=p_request_id;
 if found then
  if receipt.payload_hash<>signature then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','same','count',total);
 end if;
 if (select count(distinct value) from jsonb_array_elements(p_operations))<>total then raise invalid_parameter_value;end if;
 for op in select value from jsonb_array_elements(p_operations) loop
  idx:=idx+1;
  if jsonb_typeof(op) is distinct from 'object' or not(op ?& array['kind','categoryId','owner','amountCents','frequency','date','label'])
    or op-array['kind','categoryId','owner','amountCents','frequency','date','label'] <> '{}'::jsonb
    or exists(select from jsonb_each(op) kv where jsonb_typeof(kv.value)<>case when kv.key='amountCents' then 'number' else 'string' end)
    or op->>'kind' not in ('expense','income','saving') or op->>'owner' not in ('A','B','common')
    or (hmode='solo' and op->>'owner'<>'B') or op->>'frequency' not in ('once','monthly')
    or (op->>'kind'='saving' and op->>'frequency'<>'once') or op->>'amountCents' !~ '^[1-9][0-9]{0,8}$'
    or (op->>'amountCents')::bigint>100000000 or op->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
    or length(trim(op->>'label')) not between 1 and 120 then raise invalid_parameter_value;
  end if;
  day:=(op->>'date')::date;
  select * into strict cat from public.categories where household_id=p_household_id and archived_at is null
   and coalesce(legacy_id,id::text)=op->>'categoryId' for share;
  row_type:=case when op->>'kind'='income' then 'income' else 'expense' end;
  if cat.type<>row_type or coalesce(cat.is_saving,false)<>(op->>'kind'='saving') or day<cat.created_from
   or cat.excluded_months ? to_char(day,'YYYY-MM') or (op->>'frequency'='once' and day>today)
   or day>(today+interval '2 years')::date then raise invalid_parameter_value;end if;
  owner_code:=nullif(op->>'owner','common');
  amount:=(op->>'amountCents')::numeric/100;
  label_text:=trim(op->>'label');legacy:='smart-movement-'||p_request_id::text||'-'||idx;
  row_meta:=jsonb_build_object('type',row_type,'assistantRequestId',p_request_id);
  if op->>'frequency'='monthly' then
   insert into public.recurrences(household_id,category_id,legacy_id,owner_slot,amount,start_month,start_day,label,metadata)
    values(p_household_id,cat.id,legacy,owner_code,amount,date_trunc('month',day)::date,extract(day from day)::int,label_text,row_meta||jsonb_build_object('seriesId',legacy));
  else
   insert into public.transactions(household_id,category_id,legacy_id,owner_slot,amount,transaction_date,label,metadata)
    values(p_household_id,cat.id,legacy,owner_code,amount,day,label_text,row_meta);
  end if;
 end loop;
 insert into public.smart_assistant_pilot_batch_receipts(household_id,request_id,payload_hash,result)
 values(p_household_id,p_request_id,signature,jsonb_build_object('count',total));
 return jsonb_build_object('status','created','count',total);
exception when insufficient_privilege then return jsonb_build_object('status','forbidden');
 when data_exception or no_data_found or too_many_rows then return jsonb_build_object('status','invalid');
end $$;
revoke all on function public.smart_assistant_confirm_movements(uuid,uuid,uuid[],uuid,jsonb) from public,anon,authenticated;
grant execute on function public.smart_assistant_confirm_movements(uuid,uuid,uuid[],uuid,jsonb) to service_role;
