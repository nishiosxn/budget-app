\set ON_ERROR_STOP on
-- Only the local synthetic baseline can be upgraded by this fixture.
do $guard$
begin
 if inet_server_port()<>5432 or current_database()<>'postgres'
 or to_regclass('public.households') is null
 or to_regclass('private.budget_builder_setup') is not null
 or not exists(select from auth.users where id='90ce62fb-4c40-4f08-9d41-2e2847e67809' and email='preexisting@example.test')
 then raise exception 'Expected synthetic V3.0 baseline'; end if;
end
$guard$;
begin;
create temporary view preexisting_ledger as
 select jsonb_build_array(to_jsonb(h),to_jsonb(m),to_jsonb(c),to_jsonb(b),to_jsonb(t),to_jsonb(r),to_jsonb(a)) as snapshot
 from public.households h join public.household_members m on m.household_id=h.id
 join public.categories c on c.household_id=h.id join public.budgets b on b.category_id=c.id
 join public.transactions t on t.category_id=c.id join public.recurrences r on r.category_id=c.id
 join public.account_opening_balances a on a.household_id=h.id
 where h.id='90ce62fb-4c40-4f08-9d41-2e2847e67810';
create temporary table preexisting_before as table preexisting_ledger;

\ir ../../supabase/migrations/20261127190000_assistant_household_rules.sql
\ir ../../supabase/migrations/20261127193000_assistant_confirm_movements.sql
\ir ../../supabase/migrations/20261127210000_budget_builder_atomic.sql
\ir ../../supabase/migrations/20261127220000_assistant_atomic_review.sql
do $$ begin
 assert (select count(*) from preexisting_before)=1;
 assert (select count(*) from preexisting_ledger)=1;
 assert (select snapshot from preexisting_before)=(select snapshot from preexisting_ledger);
end $$;
notify pgrst, 'reload schema';

commit;
