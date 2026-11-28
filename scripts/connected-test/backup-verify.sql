\set ON_ERROR_STOP on
begin;
do $$
declare
 a constant uuid:='8d200000-0000-4000-8000-000000000001';
 b constant uuid:='8d200000-0000-4000-8000-000000000002';
 stage_req constant uuid:='8d200000-0000-4000-8000-000000000003';
 setup_req constant uuid:='8d200000-0000-4000-8000-000000000004';
 done_req constant uuid:='8d200000-0000-4000-8000-000000000005';
 pending_req constant uuid:='8d200000-0000-4000-8000-000000000006';
 h uuid; pending_h uuid; receipt jsonb; before_count bigint; draft jsonb;
begin
 if current_database()<>'smart_budget_restore_drill' then raise exception 'Restore database required';end if;
 select household_id into strict h from private.budget_builder_setup where owner_id=a;
 select household_id,s.draft into strict pending_h,draft from private.budget_builder_setup s where owner_id=b;
 assert draft is not null;
 assert (select count(*) from public.transactions where household_id=h and label='Reçu sauvegarde fictif' and amount=12.34)=1;
 assert not exists(select from public.categories where household_id=pending_h);
 assert (select count(*) from smart_budget_backups.snapshot_tables where snapshot_id=(select max(id) from smart_budget_backups.snapshots))=8;
 assert not has_table_privilege('authenticated','private.budget_builder_setup','SELECT');
 assert not has_table_privilege('authenticated','private.smart_assistant_reviews','SELECT');
 assert not has_table_privilege('authenticated','public.smart_assistant_pilot_batch_receipts','SELECT');
 assert not has_table_privilege('authenticated','private.v31_pilot_builder_users','INSERT');
 assert not has_table_privilege('authenticated','private.v31_pilot_rule_members','INSERT');
 assert not has_table_privilege('anon','smart_assistant_private.daily_reservations','SELECT');
 assert not has_schema_privilege('authenticated','smart_budget_backups','USAGE');
 assert not has_function_privilege('authenticated','public.smart_assistant_atomic_review(uuid,uuid,uuid[],uuid,text,jsonb)','EXECUTE');
 assert has_function_privilege('service_role','public.smart_assistant_atomic_review(uuid,uuid,uuid[],uuid,text,jsonb)','EXECUTE');

 select count(*) into before_count from public.transactions where household_id=h;
 -- Read receipt and replay through the exact restored RPC as service_role.
 set local role service_role;
 receipt:=public.smart_assistant_atomic_review(h,a,array[a],done_req,'status');
 assert receipt->>'status'='complete';
 assert public.smart_assistant_atomic_review(h,a,array[a],done_req,'commit')=receipt;
 assert public.smart_assistant_atomic_review(h,a,array[a],pending_req,'status')->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h,b,array[a],done_req,'status')->>'status'='forbidden';
 reset role;
 assert (select count(*) from public.transactions where household_id=h)=before_count;

 set local role authenticated;
 perform set_config('request.jwt.claim.sub',b::text,true);
 assert public.budget_builder_setup(pending_h)->'draft'=draft;
 assert public.budget_builder_setup(pending_h)->>'requestId'=stage_req::text;
 assert not exists(select from public.categories where household_id=h);
 assert not exists(select from public.smart_assistant_household_rules where household_id=h);
 begin
  perform public.budget_builder_setup(h);
  raise exception 'Cross-household Builder access accepted';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 assert public.budget_builder_setup(h,'commit',setup_req)->>'status'='complete';
 assert (select rules->>'backup-fixture' from public.smart_assistant_household_rules where household_id=h)='rule:groceries';
 reset role;
 assert (select count(*) from public.transactions where household_id=h)=before_count;
 assert not exists(select from public.categories where household_id=pending_h);
 -- Actually resume the pending review, then replay it. Entire drill rolls back.
 set local role service_role;
 receipt:=public.smart_assistant_atomic_review(h,a,array[a],pending_req,'commit');
 assert receipt->>'status'='complete',receipt::text;
 assert public.smart_assistant_atomic_review(h,a,array[a],pending_req,'commit')=receipt;
 reset role;
 assert (select count(*) from public.transactions where household_id=h)=before_count+1;
 -- Resume the staged Builder through the restored RPC and check idempotence.
 set local role authenticated;
 perform set_config('request.jwt.claim.sub',b::text,true);
 receipt:=public.budget_builder_setup(pending_h,'commit',stage_req);
 assert receipt->>'status'='complete';
 assert public.budget_builder_setup(pending_h,'commit',stage_req)=receipt;
 reset role;
 assert (select count(*) from public.categories where household_id=pending_h and archived_at is null)=jsonb_array_length(draft->'categories');
end $$;
rollback;
select 'RESTORE_DRILL_OK' as result;
