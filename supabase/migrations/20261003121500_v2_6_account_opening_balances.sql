-- V2.6 — soldes d'ouverture mensuels des comptes personnels
create table if not exists public.account_opening_balances (
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  owner_slot text not null check (owner_slot in ('B','A')),
  amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, month, owner_slot)
);

alter table public.account_opening_balances enable row level security;

drop policy if exists "members can read account opening balances" on public.account_opening_balances;
create policy "members can read account opening balances"
on public.account_opening_balances
for select to authenticated
using (private.is_household_member(household_id));

drop policy if exists "members can create account opening balances" on public.account_opening_balances;
create policy "members can create account opening balances"
on public.account_opening_balances
for insert to authenticated
with check (private.is_household_member(household_id));

drop policy if exists "members can update account opening balances" on public.account_opening_balances;
create policy "members can update account opening balances"
on public.account_opening_balances
for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists "members can delete account opening balances" on public.account_opening_balances;
create policy "members can delete account opening balances"
on public.account_opening_balances
for delete to authenticated
using (private.is_household_member(household_id));

revoke all on table public.account_opening_balances from anon;
grant select, insert, update, delete on table public.account_opening_balances to authenticated;
