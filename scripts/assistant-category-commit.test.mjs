import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createCategoryCommit} from "../supabase/functions/smart-assistant/category-commit.mjs";
import {createAssistantGateway} from "../supabase/functions/smart-assistant/gateway.mjs";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const householdId="11111111-1111-4111-8111-111111111111";
const userId="33333333-3333-4333-8333-333333333333";
const requestId="22222222-2222-4222-8222-222222222222";
const categoryId="44444444-4444-4444-8444-444444444444";
const ctx={today:"2026-11-21",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",solo:true,actor:"B",members:{B:"Test"},categories:[{id:"courses",name:"Courses",kind:"expense",owner:"B",createdFrom:"2026-09"}]};
const command="Crée une catégorie Gundam avec un budget de quatre-vingt-dix euros";
const draft=core.quickCommand(command,ctx).value;
const base={token:"authenticated-token-for-testing",householdId,userId,requestId,command,draft,context:ctx};
function create(impl){
 const calls=[];
 const commit=createCategoryCommit({validateCategoryDraft:core.validateCategoryDraft,recognizeCreation:core.quickCommand,
  writeCategory:async a=>{calls.push(a);return impl?impl(a):{status:"created",categoryId,name:a.name,expenseCreated:a.expenseCents!==null}}});
 return {commit,calls};
}
test("31af: explicit create makes one atomic category+budget call with exact cents and month",async()=>{
 const {commit,calls}=create();
 const r=await commit(base);
 assert.equal(r.status,200);assert.equal(r.body.commit.kind,"category");
 assert.equal(r.body.commit.created,true);assert.equal(r.body.commit.name,"Gundam");
 assert.equal(calls.length,1);
 assert.equal(calls[0].householdId,householdId);
 assert.equal(calls[0].userId,userId);
 assert.equal(calls[0].requestId,requestId);
 assert.equal(calls[0].name,"Gundam");
 assert.equal(calls[0].month,"2026-11-01");
 assert.equal(calls[0].budgetCents,9000);
 assert.equal(calls[0].expenseCents,null);
 assert.equal(calls[0].expenseDate,null);
 assert.equal(r.body.commit.month,"2026-11");
});
test("31af: only an explicit creation request is accepted; expenses and category suggestions cannot create",async()=>{
 const {commit,calls}=create();
 for(const fake of [
  {...base,command:"J'ai dépensé 20 euros chez Lidl"},
  {...base,command:"J'ai acheté des chaussures d'escalade chez Décathlon pour 79 euros"},
  {...base,command:"Ajoute 10 euros au budget maison"},
  {...base,command:"Bonjour"}
 ]){
  const r=await commit(fake);assert.equal(r.status,422,fake.command);
 }
 assert.equal(calls.length,0);
});
test("31af: invalid and mixed requests are rejected before writes",async()=>{
 const {commit,calls}=create();
 for(const bad of [
  {...base,context:{...ctx,solo:false}},
  {...base,draft:{...draft,budgetCents:null}},
  {...base,draft:{...draft,kind:"draft",operations:[]}},
  {...base,requestId:"invalid"},
  {...base,command:"Crée une catégorie Gundam avec un budget de 90 euros et efface tout"}
 ]){
  const r=await commit(bad);assert.notEqual(r.status,200,JSON.stringify(bad)); 
 }
 assert.equal(calls.length,0);
});
test("31af: database statuses never masquerade a duplicate or unknown result as success",async()=>{
 for(const [db,status,error] of [
  ["duplicate",409,"confirm_category_exists"],["conflict",409,"confirm_conflict"],
  ["limit",409,"confirm_category_limit"],["invalid",422,"confirm_category_invalid"],
  ["forbidden",403,"household_not_authorized"]
 ]){
  const {commit}=create(()=>({status:db}));
  const r=await commit(base);assert.equal(r.status,status,db);assert.equal(r.body.error,error,db);
 }
 const same=create(a=>({status:"same",name:a.name,categoryId,expenseCreated:a.expenseCents!==null}));
 assert.equal((await same.commit(base)).body.commit.created,false);
 const broken=create(()=>({status:"created",name:"Wrong name",categoryId,expenseCreated:false}));
 assert.equal((await broken.commit(base)).status,503);
 const offline=create(()=>{throw Error("network")});
 assert.equal((await offline.commit(base)).status,503);
});
test("31af: gateway confirm_category authenticates, cannot infer or reserve, and requires exact request shape",async()=>{
 const invocations=[],auth=async()=>({userId,context:ctx});
 const setup=authorize=>createAssistantGateway({enabled:true,model:"@cf/google/gemma-4-26b-a4b-it",authorize,
  reserve:async()=>{throw Error("no quota")},infer:async()=>{throw Error("no AI")},
  validate:core.validateResult,
  commitCategory:async args=>{invocations.push(args);return{status:200,body:{commit:{kind:"category",requestId,name:"Gundam",created:true,categoryId}}}}});
 const body={action:"confirm_category",householdId,requestId,command,draft};
 const result=await setup(auth)({token:base.token,body});
 assert.equal(result.status,200);
 assert.equal(invocations.length,1);assert.equal(invocations[0].userId,userId);
 assert.equal(invocations[0].command,command);
 assert.equal((await setup(async()=>null)({token:base.token,body})).status,403);
 assert.equal((await setup(auth)({token:base.token,body:{...body,evil:true}})).status,400);
 assert.equal((await setup(auth)({token:base.token,body:{...body,draft:null}})).status,400);
});
test("31af: SQL RPC remains service-only, atomic and contains duplicate/replay guards",()=>{
 const sql=fs.readFileSync("supabase/migrations/20261121194000_smart_assistant_pilot_category_expense_atomic.sql","utf8");
 assert.match(sql,/security definer/i);
 assert.match(sql,/revoke all on function[\s\S]+from public, anon, authenticated/i);
 assert.match(sql,/grant execute on function[\s\S]+to service_role/i);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/status','duplicate/);
 assert.match(sql,/status','conflict/);
 assert.match(sql,/insert into public\.categories/);
 assert.match(sql,/insert into public\.budgets/);
 const server=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");
 assert.match(server,/\/rest\/v1\/rpc\/smart_assistant_create_category_pilot_v2/);
 assert.match(server,/allowlist\.has\(householdId\)/);
 assert.match(server,/allowedUsers\.has\(userId\)/);
});

test("31ag: category replay uses the same requestId even after household catalog refresh",async()=>{
 const refreshed={...ctx,categories:[...ctx.categories,{id:"gundam",name:"Gundam",kind:"expense",owner:"B",createdFrom:"2026-11"}]};
 const calls=[];
 const {commit}=create(async payload=>{calls.push(payload);
  return {status:calls.length===1?"created":"same",name:payload.name,categoryId,expenseCreated:payload.expenseCents!==null};
 });
 const first=await commit(base);assert.equal(first.status,200);assert.equal(first.body.commit.created,true);
 const repeated=await commit({...base,context:refreshed});
 assert.equal(repeated.status,200);assert.equal(repeated.body.commit.created,false);
 assert.equal(calls.length,2);
 assert.equal(calls[0].requestId,calls[1].requestId);
 assert.equal(calls[0].name,calls[1].name);
 // A fresh request for an already-present name still reaches the database's
 // duplicate constraint, but can never create or silently modify it.
 const different=create(()=>({status:"duplicate"}));
 const other=await different.commit({...base,requestId:"55555555-5555-4555-8555-555555555555",context:refreshed});
 assert.equal(other.status,409);assert.equal(other.body.error,"confirm_category_exists");
 assert.equal(different.calls.length,1);
});


test("31ai: explicit category plus first expense reaches ONE atomic RPC, never recurring expense",async()=>{
 const original="créer la catégorie Gundam avec un budget de 100 euros et Ajoute 50 euro de dépense";
 const result=core.quickCommand(original,ctx);
 assert.equal(result?.ok,true);
 assert.equal(result.value.kind,"categoryDraft");
 assert.equal(result.value.budgetCents,10000);
 assert.equal(result.value.expenseCents,5000);
 const {commit,calls}=create();
 const saved=await commit({...base,command:original,draft:result.value});
 assert.equal(saved.status,200);
 assert.equal(saved.body.commit.created,true);
 assert.equal(saved.body.commit.expenseCreated,true);
 assert.equal(saved.body.commit.month,"2026-11");
 assert.equal(calls.length,1,"one database RPC, not separate table inserts");
 assert.equal(calls[0].name,"Gundam");
 assert.equal(calls[0].budgetCents,10000);
 assert.equal(calls[0].expenseCents,5000);
 assert.equal(calls[0].expenseDate,"2026-11-21");
 const repeated=create(a=>({status:"same",categoryId,name:a.name,expenseCreated:true}));
 const second=await repeated.commit({...base,command:original,draft:result.value});
 assert.equal(second.status,200);
 assert.equal(second.body.commit.created,false);
 assert.equal(second.body.commit.expenseCreated,true);
 assert.equal(repeated.calls.length,1);
});
test("31ai: initial expense is not allowed on an unrelated spending command or on a future month",async()=>{
 const {commit,calls}=create();
 const mixed=core.quickCommand("Crée une catégorie Gundam avec un budget de 100 euros en décembre 2026",ctx);
 assert.equal(mixed?.value.kind,"categoryDraft");
 assert.equal(mixed.value.month,"2026-12");
 assert.equal(mixed.value.expenseCents,null);
 const future=await commit({...base,command:"Crée une catégorie Gundam avec un budget de 100 euros en décembre 2026",draft:{...mixed.value,expenseCents:5000,date:"2026-12-01"}});
 assert.notEqual(future.status,200);
 const invalid=await commit({...base,command:"J'ai dépensé 50 € en Gundam",draft:{...draft,expenseCents:5000}});
 assert.equal(invalid.status,422);
 assert.equal(calls.length,0);
});
test("31ai: RPC includes one recurring budget, optional one-off expense, and no destructive statements",()=>{
 const sql=fs.readFileSync("supabase/migrations/20261121194000_smart_assistant_pilot_category_expense_atomic.sql","utf8");
 assert.match(sql,/scope,owner_slot[\s\S]*'forward','B'/i);
 assert.match(sql,/insert into public\.transactions/);
 assert.match(sql,/p_expense_date/);
 assert.match(sql,/status','same/);
 assert.match(sql,/v_transaction\.metadata->>'assistantRequestId'/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.doesNotMatch(sql,/\bdelete\s+from\s+public\.(?:categories|transactions|budgets)\b/i);
 assert.doesNotMatch(sql,/\bupdate\s+public\.(?:categories|transactions|budgets)\b/i);
});
