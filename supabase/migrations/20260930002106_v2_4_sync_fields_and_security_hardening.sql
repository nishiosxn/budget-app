alter table public.households
  add column if not exists person_b_label text not null default 'Personne 1',
  add column if not exists person_a_label text not null default 'Personne 2';

alter table public.budgets
  add column if not exists scope text not null default 'forward',
  add column if not exists owner_slot text;

alter table public.budgets
  drop constraint if exists budgets_scope_check;
alter table public.budgets
  add constraint budgets_scope_check check (scope in ('month','forward'));

alter table public.budgets
  drop constraint if exists budgets_owner_slot_check;
alter table public.budgets
  add constraint budgets_owner_slot_check check (owner_slot is null or owner_slot in ('B','A'));

alter table public.transactions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.recurrences
  add column if not exists start_day smallint not null default 1,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.recurrences
  drop constraint if exists recurrences_start_day_check;
alter table public.recurrences
  add constraint recurrences_start_day_check check (start_day between 1 and 31);

grant update (person_b_label, person_a_label) on table public.households to authenticated;
grant update (scope, owner_slot) on table public.budgets to authenticated;
grant update (metadata) on table public.transactions to authenticated;
grant update (start_day, metadata) on table public.recurrences to authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists household_invites_household_idx on public.household_invites(household_id);
create index if not exists household_invites_created_by_idx on public.household_invites(created_by);
create index if not exists household_invites_accepted_by_idx on public.household_invites(accepted_by);
create index if not exists households_created_by_idx on public.households(created_by);
create index if not exists categories_owner_user_idx on public.categories(owner_user_id);
create index if not exists transactions_owner_user_idx on public.transactions(owner_user_id);
create index if not exists transactions_recurrence_idx on public.transactions(recurrence_id);
create index if not exists recurrences_owner_user_idx on public.recurrences(owner_user_id);
create index if not exists budgets_category_household_idx on public.budgets(category_id, household_id);
create index if not exists transactions_category_household_idx on public.transactions(category_id, household_id);
create index if not exists recurrences_category_household_idx on public.recurrences(category_id, household_id);
