-- Shared merchant associations. All financial tables remain read-only in this function.
create table public.smart_assistant_household_rules (
 household_id uuid primary key references public.households(id) on delete cascade,
 revision bigint not null default 0 check (revision >= 0),
 rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules)='object')
);
alter table public.smart_assistant_household_rules enable row level security;
revoke all on public.smart_assistant_household_rules from public, anon, authenticated;
grant select on public.smart_assistant_household_rules to authenticated;
create policy household_members_read_rules on public.smart_assistant_household_rules
 for select to authenticated using (private.is_household_member(household_id));

create function public.edit_smart_assistant_rule(
 p_household_id uuid, p_revision bigint, p_operation text, p_term text, p_target text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 snapshot public.smart_assistant_household_rules%rowtype;
 next_rules jsonb;
begin
 perform 1 from public.household_members m where m.household_id=p_household_id
   and m.user_id=(select auth.uid()) for share;
 if not found then raise insufficient_privilege; end if;
 if p_revision is null or p_revision<0 or p_operation is null or p_operation not in ('set','remove','clear')
    or (p_operation in ('set','remove') and (p_term is null or p_term<>trim(p_term) or length(p_term) not between 1 and 80 or p_term ~ '[[:cntrl:]]'))
    or (p_operation='clear' and p_term is not null)
    or (p_operation<>'set' and p_target is not null) then raise invalid_parameter_value; end if;
 if p_operation='set' then
  if p_target is null or length(p_target)>123 then raise invalid_parameter_value; end if;
  if left(p_target,3)='id:' then
   perform 1 from public.categories c where c.household_id=p_household_id and c.archived_at is null
    and coalesce(c.legacy_id,c.id::text)=substr(p_target,4) for share;
   if not found then raise invalid_parameter_value; end if;
  elsif p_target not in ('rule:groceries','rule:food','rule:home','rule:leisure','rule:transfer','rule:extra','rule:salary','rule:benefits','rule:fuel','rule:transport','rule:health','rule:clothing','rule:subscriptions','rule:gifts','rule:phone','rule:insurance','rule:rent','rule:energy','rule:saving','rule:internet') then raise invalid_parameter_value;
  end if;
 end if;
 insert into public.smart_assistant_household_rules(household_id) values(p_household_id) on conflict do nothing;
 select * into strict snapshot from public.smart_assistant_household_rules where household_id=p_household_id for update;
 if snapshot.revision<>p_revision then
  return jsonb_build_object('status','conflict','rules',snapshot.rules,'revision',snapshot.revision);
 end if;
 next_rules:=case p_operation when 'set' then jsonb_set(snapshot.rules,array[p_term],to_jsonb(p_target))
                when 'remove' then snapshot.rules-p_term else '{}'::jsonb end;
 if (select count(*) from jsonb_object_keys(next_rules))>200 then raise invalid_parameter_value;end if;
 if next_rules<>snapshot.rules then
  update public.smart_assistant_household_rules set rules=next_rules, revision=revision+1 where household_id=p_household_id returning * into snapshot;
 end if;
 return jsonb_build_object('status','ok','rules',snapshot.rules,'revision',snapshot.revision);
end $$;
revoke all on function public.edit_smart_assistant_rule(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.edit_smart_assistant_rule(uuid,bigint,text,text,text) to authenticated;
