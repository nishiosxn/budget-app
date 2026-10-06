-- V2.7 — alignement du schéma publié et nettoyage des index dupliqués

alter table public.households
  add column if not exists household_mode text not null default 'couple';

alter table public.households
  drop constraint if exists households_household_mode_check;

alter table public.households
  add constraint households_household_mode_check
  check (household_mode in ('solo','couple'));

grant update (household_mode) on table public.households to authenticated;

-- Les index *_uidx sont la définition canonique versionnée depuis V2.5.
drop index if exists public.categories_household_legacy_unique;
drop index if exists public.transactions_household_legacy_unique;
drop index if exists public.recurrences_household_legacy_unique;
