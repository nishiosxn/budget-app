-- V2.5 — déduplication des écritures concurrentes par identifiant local stable
create unique index if not exists categories_household_legacy_uidx
  on public.categories(household_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists transactions_household_legacy_uidx
  on public.transactions(household_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists recurrences_household_legacy_uidx
  on public.recurrences(household_id, legacy_id)
  where legacy_id is not null;
