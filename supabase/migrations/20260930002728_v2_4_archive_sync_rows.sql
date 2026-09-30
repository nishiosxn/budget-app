alter table public.budgets add column if not exists archived_at timestamptz;
alter table public.transactions add column if not exists archived_at timestamptz;
alter table public.recurrences add column if not exists archived_at timestamptz;

grant update (archived_at) on table public.budgets to authenticated;
grant update (archived_at) on table public.transactions to authenticated;
grant update (archived_at) on table public.recurrences to authenticated;
