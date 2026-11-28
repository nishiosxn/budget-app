-- Loaded within the existing disposable transaction after the RLS tests.
reset role;
create role service_role;
alter table public.households add household_mode text not null default 'couple';
alter table public.household_members add slot text;
update public.household_members set slot=case when user_id::text like '%0002' then 'A' else 'B' end;
alter table public.categories add type text, add is_saving boolean, add created_from date default date '2024-01-01', add excluded_months jsonb default '[]';
create table public.transactions(household_id uuid,category_id uuid,legacy_id text,owner_slot text,amount numeric,transaction_date date,label text,metadata jsonb);
create table public.recurrences(household_id uuid,category_id uuid,legacy_id text,owner_slot text,amount numeric,start_month date,start_day int,label text,metadata jsonb);
create table public.smart_assistant_pilot_batch_receipts(household_id uuid,request_id uuid,payload_hash text,result jsonb,primary key(household_id,request_id));
insert into public.categories(id,household_id,legacy_id,type,is_saving) values
 ('30000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','rent','expense',false),
 ('30000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','saving','expense',true),
 ('30000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','salary','income',false);
\ir ../supabase/migrations/20261127193000_assistant_confirm_movements.sql
do $$
declare
 h uuid:='10000000-0000-4000-8000-000000000001'; a uuid:='20000000-0000-4000-8000-000000000002'; b uuid:='20000000-0000-4000-8000-000000000001';
 req uuid:=gen_random_uuid();ops jsonb;changed jsonb;r jsonb;
begin
 ops:='[{"kind":"expense","categoryId":"rent","owner":"common","amountCents":1234,"frequency":"monthly","date":"2025-01-31","label":"Loyer"},
        {"kind":"saving","categoryId":"saving","owner":"A","amountCents":405,"frequency":"once","date":"2025-01-30","label":"Épargne"},
        {"kind":"income","categoryId":"salary","owner":"B","amountCents":99999,"frequency":"once","date":"2025-02-01","label":"Revenu"}]';
 r:=public.smart_assistant_confirm_movements(h,a,array[a,b],req,ops);assert r->>'status'='created',r::text;
 assert (select count(*)=1 from public.recurrences where start_day=31 and start_month='2025-01-01' and amount=12.34 and owner_slot is null);
 assert (select sum(amount)=1004.04 from public.transactions);
 assert (select count(*)=1 from public.transactions where owner_slot='A' and metadata->>'type'='expense');
 assert (public.smart_assistant_confirm_movements(h,a,array[b,a],req,ops)->>'status')='same';
 assert (public.smart_assistant_confirm_movements(h,b,array[b,a],req,ops)->>'status')='conflict';
 changed:=jsonb_set(ops,'{1,categoryId}','"private-other"');
 assert (public.smart_assistant_confirm_movements(h,a,array[b,a],gen_random_uuid(),changed)->>'status')='invalid';
 assert (public.smart_assistant_confirm_movements(h,a,array[a],gen_random_uuid(),ops)->>'status')='forbidden';
 assert (select count(*)=1 from public.recurrences);
 assert (select count(*)=2 from public.transactions);
 assert (select count(*)=1 from public.smart_assistant_pilot_batch_receipts);
 assert not has_function_privilege('authenticated','public.smart_assistant_confirm_movements(uuid,uuid,uuid[],uuid,jsonb)','execute');
end $$;
