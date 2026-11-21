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
  writeCategory:async a=>{calls.push(a);return impl?impl(a):{status:"created",categoryId,name:a.name}}});
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
test("31af: invalid, duplicate, mixed and category-with-expense requests are rejected before writes",async()=>{
 const {commit,calls}=create();
 const anotherCtx={...ctx,categories:[...ctx.categories,{id:"gundam",name:"Gundam",kind:"expense",owner:"B",createdFrom:"2026-09"}]};
 for(const bad of [
  {...base,context:anotherCtx},
  {...base,context:{...ctx,solo:false}},
  {...base,draft:{...draft,expenseCents:4000}},
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
 const same=create(a=>({status:"same",name:a.name,categoryId}));
 assert.equal((await same.commit(base)).body.commit.created,false);
 const broken=create(()=>({status:"created",name:"Wrong name",categoryId}));
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
 const sql=fs.readFileSync("supabase/migrations/20261121183000_smart_assistant_pilot_category_creation.sql","utf8");
 assert.match(sql,/security definer/i);
 assert.match(sql,/revoke all on function[\s\S]+from public, anon, authenticated/i);
 assert.match(sql,/grant execute on function[\s\S]+to service_role/i);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/status','duplicate/);
 assert.match(sql,/status','conflict/);
 assert.match(sql,/insert into public\.categories/);
 assert.match(sql,/insert into public\.budgets/);
 const server=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");
 assert.match(server,/\/rest\/v1\/rpc\/smart_assistant_create_category_pilot_v1/);
 assert.match(server,/allowlist\.has\(householdId\)/);
 assert.match(server,/allowedUsers\.has\(userId\)/);
});
