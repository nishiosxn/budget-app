import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root="supabase/migrations/";
const source=fs.readFileSync(root+"20261116025347_v2_9_private_rolling_snapshots.sql","utf8");
const preview=fs.readFileSync(root+"20261116025548_v2_9_restore_preview.sql","utf8");
const schedule=fs.readFileSync(root+"20261116025626_v2_9_schedule_private_backups.sql","utf8");

test("snapshot covers every financial and membership table including archives",()=>{
 for(const table of ["households","household_members","household_invites","categories","budgets","transactions","recurrences","account_opening_balances"]){
  assert.ok(source.includes("from public."+table+" t"),table);
 }
 assert.match(source,/union all/i);
 assert.match(source,/jsonb_agg\(to_jsonb\(t\)/);
 assert.doesNotMatch(source,/where\s+archived_at\s+is\s+null/i);
});
test("private backups cannot be invoked from browser roles",()=>{
 assert.match(source,/revoke all on schema smart_budget_backups from public,anon,authenticated,service_role/i);
 assert.match(source,/revoke all on function smart_budget_backups\.capture_snapshot\(text\) from public,anon,authenticated,service_role/i);
 assert.match(preview,/revoke all on function smart_budget_backups\.compare_snapshot\(bigint\) from public,anon,authenticated,service_role/i);
 assert.match(source,/current_user<>'postgres'/);
 assert.match(preview,/current_user<>'postgres'/);
 assert.doesNotMatch(source,/security definer/i);
});
test("retention affects scheduled snapshots only; manual and emergency copies untouched",()=>{
 assert.match(source,/where reason='scheduled'/);
 assert.match(source,/interval '30 days'/);
 assert.match(source,/pre_restore/);
 assert.doesNotMatch(source,/delete from public\./i);
});
test("recurring task runs every six hours and uses private function only",()=>{
 assert.match(schedule,/17 \*\/6 \* \* \*/);
 assert.match(schedule,/smart_budget_backups\.capture_snapshot/);
 assert.match(schedule,/cron\.schedule/);
 assert.doesNotMatch(schedule,/truncate|drop table|delete from public\./i);
});
test("restore preview only reports differences, no financial writes",()=>{
 assert.match(preview,/returns table/i);
 assert.match(preview,/added_since|missing_since|changed_since/);
 assert.doesNotMatch(preview,/\b(update|delete from|truncate|insert into)\s+public\./i);
});
