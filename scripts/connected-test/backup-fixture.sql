\set ON_ERROR_STOP on
-- Synthetic accounts only, on the upgraded local Supabase stack.
begin;
do $$
declare
 a constant uuid:='8d200000-0000-4000-8000-000000000001';
 b constant uuid:='8d200000-0000-4000-8000-000000000002';
 stage_req constant uuid:='8d200000-0000-4000-8000-000000000003';
 setup_req constant uuid:='8d200000-0000-4000-8000-000000000004';
 done_req constant uuid:='8d200000-0000-4000-8000-000000000005';
 pending_req constant uuid:='8d200000-0000-4000-8000-000000000006';
 pending_h uuid; h uuid; rev timestamptz; actions jsonb; receipt jsonb;
 payload jsonb:='{"name":"Recette sauvegarde","personA":"Camille","personB":"Alex","mode":"solo","month":"2025-01-01","appearance":{},"categories":[{"id":"backup-income","name":"Revenu fictif","type":"income","owner":"B","saving":false,"custom":true,"amountCents":145601},{"id":"backup-food","name":"Courses fictives","type":"expense","owner":"B","section":"Vie courante","saving":false,"custom":true,"amountCents":24000}]}';
begin
 if current_database()<>'postgres' or to_regclass('private.smart_assistant_reviews') is null
 or not exists(select from auth.users where id='90ce62fb-4c40-4f08-9d41-2e2847e67809' and email='preexisting@example.test')
 or exists(select from auth.users where email is null or email not like '%@example.test')
 then raise exception 'Expected upgraded synthetic Supabase database';end if;
 insert into auth.users(id,email) values(a,'backup-owner@example.test'),(b,'backup-other@example.test');
 insert into private.v31_pilot_builder_users values(a),(b);
 perform set_config('request.jwt.claim.sub',b::text,true);
 pending_h:=public.provision_budget_builder('Brouillon fictif','Alex');
 assert public.budget_builder_setup(pending_h,'stage',stage_req,payload)->>'status'='staged';
 perform set_config('request.jwt.claim.sub',a::text,true);
 h:=public.provision_budget_builder('Recette fictive','Alex');
 assert public.budget_builder_setup(h,'stage',setup_req,payload)->>'status'='staged';
 assert public.budget_builder_setup(h,'commit',setup_req)->>'status'='complete';
 insert into private.v31_pilot_rule_members values(h,a);
 assert public.edit_smart_assistant_rule(h,0,'set','backup-fixture','rule:groceries')->>'revision'='1';
 select updated_at into strict rev from public.categories where household_id=h and legacy_id='backup-food';
 actions:=jsonb_build_array(jsonb_build_object('kind','expense','categoryId','backup-food','categoryVersion',rev,
 'date','2025-01-10','frequency','once','owner','B','label','Reçu sauvegarde fictif','amountCents',1234));
 assert public.smart_assistant_atomic_review(h,a,array[a],done_req,'prepare',actions)->>'status'='prepared';
 receipt:=public.smart_assistant_atomic_review(h,a,array[a],done_req,'commit');
 assert receipt->>'status'='complete',receipt::text;
 assert public.smart_assistant_atomic_review(h,a,array[a],pending_req,'prepare',actions)->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h,a,array[a],pending_req,'status')->>'status'='prepared';
 assert public.reserve_smart_assistant_quota_v1(3);
end $$;
\ir ../../supabase/migrations/20261116025347_v2_9_private_rolling_snapshots.sql
\ir ../../supabase/migrations/20261116025548_v2_9_restore_preview.sql
select smart_budget_backups.capture_snapshot('manual') is not null as synthetic_snapshot_created;
commit;
