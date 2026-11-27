-- Loaded only by v31-rules-db.sql inside a disposable PostgreSQL transaction.
-- auth.users and synthetic membership identities are already loaded by v31-rules-db.sql.
alter table public.categories alter column id set default gen_random_uuid(),
 add column name text, add column group_name text, add column owner_slot text,
 add column is_custom boolean, add column sort_order int, add column updated_at timestamptz not null default now();
alter table public.budgets alter column id set default gen_random_uuid(),
 add column household_id uuid,add column category_id uuid,add column month date,add column planned_amount numeric,
 add column scope text,add column owner_slot text,add column archived_at timestamptz,
 add column updated_at timestamptz not null default now(),add unique(category_id,month);
alter table public.budgets add constraint fixture_budget_failure check(planned_amount<>91);
alter table public.transactions add constraint fixture_transaction_failure check(amount<>43);
\ir ../supabase/migrations/20261127220000_assistant_atomic_review.sql

do $$
declare
 h constant uuid:='10000000-0000-4000-8000-000000000001';
 h2 constant uuid:='10000000-0000-4000-8000-000000000002';
 a constant uuid:='20000000-0000-4000-8000-000000000002';
 b constant uuid:='20000000-0000-4000-8000-000000000001';
 outsider constant uuid:='20000000-0000-4000-8000-000000000003';
 rent constant uuid:='30000000-0000-4000-8000-000000000010';
 req uuid:=gen_random_uuid();
 budget_version timestamptz;
 category_version timestamptz;
 actions jsonb;
 creation jsonb:='{"kind":"create_category","name":"Gundam","owner":"A","month":"2025-01","date":"2025-01-10","budgetCents":9000,"expenseCents":4000}';
 plan jsonb;
 debit jsonb;
 receipt jsonb;
begin
 insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
 values(h,rent,'2025-01-01',100,'forward',null) returning updated_at into budget_version;
 select updated_at into category_version from public.categories where id=rent;
 plan:=jsonb_build_object('kind','plan','categoryId','rent','categoryVersion',category_version,
  'date','2025-01-01','frequency','once','planMode','increase','amountCents',1000,'beforeCents',10000,'budgetVersion',budget_version);
 debit:=jsonb_build_object('kind','expense','categoryId','rent','categoryVersion',category_version,
  'date','2025-01-20','frequency','once','owner','B','label','Faux reçu','amountCents',2000);

 actions:=jsonb_build_array(jsonb_set(creation,'{budgetCents}','9100'),plan,debit);
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',actions)->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'status')->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h,b,array[a,b],req,'status')->>'status'='forbidden';
 assert public.smart_assistant_atomic_review(h,outsider,array[a,b],req,'status')->>'status'='forbidden';
 assert public.smart_assistant_atomic_review(h2,a,array[a],req,'commit')->>'status'='forbidden';
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit')->>'status'='rejected';
 assert not exists(select from public.categories where name='Gundam');
 assert (select planned_amount=100 from public.budgets where category_id=rent);

 req:=gen_random_uuid();
 actions:=jsonb_build_array(creation,plan,jsonb_set(debit,'{amountCents}','4300'));
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',actions)->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit')->>'status'='rejected';
 assert (select count(*)=1 from public.budgets);
 assert (select count(*)=2 from public.transactions);
 assert not exists(select from public.categories where name='Gundam');
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'status')->>'status'='rejected';

 req:=gen_random_uuid();
 actions:=jsonb_build_array(creation,plan,debit,jsonb_set(jsonb_set(debit,'{frequency}','"monthly"'),'{date}','"2025-02-12"'));
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',actions)->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',jsonb_build_array(plan))->>'status'='conflict';
 receipt:=public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit');
 assert receipt->>'status'='complete' and receipt->>'count'='4' and receipt->>'categoriesCreated'='1',receipt::text;
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit')=receipt;
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'status')=receipt;
 assert (select count(*)=1 from public.categories where name='Gundam' and owner_slot='A');
 assert (select amount=40 and owner_slot='A' from public.transactions where label='Gundam');
 assert (select amount=20 and owner_slot='B' from public.transactions where label='Faux reçu');
 assert (select start_day=12 and start_month='2025-02-01' from public.recurrences where label='Faux reçu');
 assert (select planned_amount=110 and scope='month' and owner_slot is null from public.budgets where category_id=rent and month='2025-01-01');
 assert (select planned_amount=100 and scope='forward' from public.budgets where category_id=rent and month='2025-02-01');

 req:=gen_random_uuid();
 plan:=jsonb_set(jsonb_set(plan,'{planMode}','"set"'),'{beforeCents}','11000');
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',jsonb_build_array(plan,debit))->>'status'='prepared';
 update public.budgets set planned_amount=111 where category_id=rent and month='2025-01-01';
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit')->>'status'='rejected';
 assert (select count(*)=4 from public.transactions);
 assert (select planned_amount=111 from public.budgets where category_id=rent and month='2025-01-01');

 req:=gen_random_uuid();
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',jsonb_build_array(debit))->>'status'='prepared';
 update public.categories set updated_at=now()+interval '1 second' where id=rent;
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit')->>'status'='rejected';
 assert (select count(*)=4 from public.transactions);
 req:=gen_random_uuid();
 select updated_at into category_version from public.categories where id=rent;
 debit:=jsonb_set(debit,'{categoryVersion}',to_jsonb(category_version));
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'prepare',jsonb_build_array(debit))->>'status'='prepared';
 update public.categories set archived_at=now() where id=rent;
 assert public.smart_assistant_atomic_review(h,a,array[a,b],req,'commit')->>'status'='rejected';
 assert (select count(*)=4 from public.transactions);

 -- Solo, two month-only plans on the same category, with the old forward rule preserved.
 update public.households set household_mode='solo' where id=h2;
 select updated_at into category_version from public.categories where household_id=h2;
 update public.categories set type='expense',owner_slot='B',is_saving=false where household_id=h2;
 insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
 select h2,id,'2025-01-01',50,'forward','B' from public.categories where household_id=h2
 returning updated_at into budget_version;
 plan:=jsonb_build_object('kind','plan','categoryId','private-other','categoryVersion',category_version,
  'date','2025-01-01','frequency','once','planMode','decrease','amountCents',2000,'beforeCents',5000,'budgetVersion',budget_version);
 actions:=jsonb_build_array(plan,plan||'{"date":"2025-02-01","planMode":"set","amountCents":0}'::jsonb);
 req:=gen_random_uuid();
 assert public.smart_assistant_atomic_review(h2,outsider,array[outsider],req,'prepare',actions)->>'status'='prepared';
 receipt:=public.smart_assistant_atomic_review(h2,outsider,array[outsider],req,'commit');
 assert receipt->>'status'='complete' and receipt->>'count'='2',receipt::text;
 assert (select planned_amount=30 and scope='month' from public.budgets where household_id=h2 and month='2025-01-01');
 assert (select planned_amount=0 and scope='month' from public.budgets where household_id=h2 and month='2025-02-01');
 assert (select planned_amount=50 and scope='forward' from public.budgets where household_id=h2 and month='2025-03-01');

 insert into public.categories(household_id,legacy_id,type,owner_slot)
 select h2,'mass-'||i,'expense','B' from generate_series(1,5) i;
 insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
 select h2,id,'2025-01-01',20,'month','B' from public.categories where household_id=h2 and legacy_id like 'mass-%';
 select jsonb_agg(jsonb_build_object('kind','plan','categoryId',c.legacy_id,'categoryVersion',c.updated_at,
  'date','2025-01-01','frequency','once','planMode','set','amountCents',0,'beforeCents',2000,'budgetVersion',p.updated_at))
 into actions from public.categories c join public.budgets p on p.category_id=c.id where c.household_id=h2 and c.legacy_id like 'mass-%';
 req:=gen_random_uuid();
 assert public.smart_assistant_atomic_review(h2,outsider,array[outsider],req,'prepare',actions)->>'status'='prepared';
 assert public.smart_assistant_atomic_review(h2,outsider,array[outsider],req,'commit')->>'status'='rejected';
 assert (select count(*)=5 from public.budgets p join public.categories c on c.id=p.category_id
  where c.household_id=h2 and c.legacy_id like 'mass-%' and p.planned_amount=20);
 assert not has_function_privilege('authenticated','public.smart_assistant_atomic_review(uuid,uuid,uuid[],uuid,text,jsonb)','execute');
 assert not has_table_privilege('authenticated','private.smart_assistant_reviews','select');
end $$;
