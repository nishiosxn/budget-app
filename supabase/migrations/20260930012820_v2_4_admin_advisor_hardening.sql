create index if not exists app_admins_created_by_idx on public.app_admins(created_by);
create index if not exists admin_audit_log_actor_user_idx on public.admin_audit_log(actor_user_id);
create index if not exists admin_audit_log_target_user_idx on public.admin_audit_log(target_user_id);
create index if not exists admin_audit_log_target_household_idx on public.admin_audit_log(target_household_id);

drop policy if exists "service role can manage app admins" on public.app_admins;
create policy "service role can manage app admins"
on public.app_admins for all to service_role
using (true) with check (true);

drop policy if exists "service role can manage admin audit log" on public.admin_audit_log;
create policy "service role can manage admin audit log"
on public.admin_audit_log for all to service_role
using (true) with check (true);
