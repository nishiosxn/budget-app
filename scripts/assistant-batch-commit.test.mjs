import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createBatchCommit} from "../supabase/functions/smart-assistant/batch-commit.mjs";
import {createAssistantGateway} from "../supabase/functions/smart-assistant/gateway.mjs";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const householdId="11111111-1111-4111-8111-111111111111",userId="33333333-3333-4333-8333-333333333333";
const requestId="22222222-2222-4222-8222-222222222222";
const homeId="44444444-4444-4444-8444-444444444444";
const leisureId="55555555-5555-4555-8555-555555555555";
const ctx={today:"2026-11-21",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",
 solo:true,actor:"B",members:{B:"Test"},categories:[
  {id:"home",name:"Maison / entretien",kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]},
  {id:"leisure",name:"Loisirs",kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]}
 ]};
const dbCats=[
 {id:homeId,legacy_id:"home",name:"Maison / entretien",type:"expense",is_saving:false,owner_slot:"B"},
 {id:leisureId,legacy_id:"leisure",name:"Loisirs",type:"expense",is_saving:false,owner_slot:"B"}
];
const op=(categoryId,amountCents,planMode="increase",frequency="once")=>({
 kind:"plan",categoryId,owner:"B",amountCents,date:"2026-11-01",label:categoryId==="home"?"Maison / entretien":"Loisirs",frequency,planMode
});
function setup(impl=async a=>({status:"created",count:a.actions.length,categoriesCreated:a.actions.filter(x=>x.kind==="create_category").length})){
 const calls=[];
 const commit=createBatchCommit({validateReview:core.validateReview,validateMixedDraft:core.validateMixedDraft,
  recognize:core.quickCommand,readCategories:async()=>dbCats,writeBatch:async a=>{calls.push(a);return impl(a)}});
 return {commit,calls};
}
const base={token:"authenticated-token-for-testing",householdId,userId,requestId,context:ctx,
 command:"Ajoute 10 euros au budget maison",draft:{kind:"draft",operations:[op("home",1000)]},
 expectedPlans:[{index:0,beforeCents:5000}]};
test("31aj: increase budget turns into a scoped, baseline-bound atomic action",async()=>{
 const {commit,calls}=setup();
 const r=await commit(base);
 assert.equal(r.status,200);assert.equal(r.body.commit.kind,"batch");
 assert.equal(r.body.commit.count,1);assert.equal(r.body.commit.categoriesCreated,0);
 assert.equal(calls.length,1);
 assert.equal(calls[0].requestId,requestId);
 assert.equal(calls[0].householdId,householdId);
 assert.equal(calls[0].userId,userId);
 const a=calls[0].actions[0];
 assert.equal(a.kind,"plan");assert.equal(a.categoryId,homeId);
 assert.equal(a.month,"2026-11");assert.equal(a.beforeCents,5000);
 assert.equal(a.amountCents,1000);assert.equal(a.planMode,"increase");
 assert.equal(a.frequency,"once");
});
test("31aj: forward and fixed monthly changes remain distinct",async()=>{
 const {commit,calls}=setup();
 const r=await commit({...base,command:"Fixe le budget maison à 80 euros chaque mois",
  draft:{kind:"draft",operations:[op("home",8000,"set","monthly")]}});
 assert.equal(r.status,200);
 assert.equal(calls[0].actions[0].frequency,"monthly");
 assert.equal(calls[0].actions[0].planMode,"set");
 assert.equal(calls[0].actions[0].amountCents,8000);
});
test("31aj: two budgets and a transaction use ONE batch and preserve order",async()=>{
 const {commit,calls}=setup();
 const txn={kind:"expense",categoryId:"home",owner:"B",amountCents:1200,date:"2026-11-21",label:"Test 12 €",frequency:"once"};
 const r=await commit({...base,command:"Ajoute 10 euros au budget maison et diminue le budget loisirs de 5 euros, puis enregistre une dépense de 12 euros",
  draft:{kind:"draft",operations:[op("home",1000),op("leisure",500,"decrease"),txn]},
  expectedPlans:[{index:0,beforeCents:5000},{index:1,beforeCents:9000}]});
 assert.equal(r.status,200);
 assert.equal(r.body.commit.count,3);
 assert.deepEqual(calls[0].actions.map(a=>a.kind),["plan","plan","expense"]);
 assert.equal(calls[0].actions[2].label,"Test 12 €");
 assert.equal(calls[0].actions[2].categoryId,homeId);
});
test("31aj: exact mixed creation plus Maison augmentation uses same atomic RPC",async()=>{
 const command="Ajoute 10 euros au budget maison et crée une catégorie Lego avec un budget de 60 euros.";
 const draft=core.quickCommand(command,ctx)?.value;
 assert.equal(draft?.kind,"mixedDraft");
 const {commit,calls}=setup();
 const r=await commit({...base,command,draft});
 assert.equal(r.status,422,"without the expected budget baseline, reject");
 assert.equal(calls.length,0);
 const good=await commit({...base,command,draft,expectedPlans:[{index:0,beforeCents:5000}]});
 assert.equal(good.status,200);
 assert.equal(good.body.commit.categoriesCreated,1);
 assert.deepEqual(calls[0].actions.map(a=>a.kind),["plan","create_category"]);
 assert.equal(calls[0].actions[1].name,"Lego");
 assert.equal(calls[0].actions[1].budgetCents,6000);
 assert.equal(calls[0].actions[1].expenseCents,null);
});
test("31aj: confirmation rejects unsafe categories, missing baseline, and unsupported recurrence",async()=>{
 const {commit,calls}=setup();
 for(const bad of [
  {...base,context:{...ctx,solo:false}},
  {...base,expectedPlans:[]},
  {...base,expectedPlans:[{index:0,beforeCents:-1}]},
  {...base,expectedPlans:[{index:0,beforeCents:5000,admin:true}]},
  {...base,draft:{kind:"draft",operations:[{...op("home",1000),categoryId:null}]}},
  {...base,draft:{kind:"draft",operations:[op("home",1000),op("home",500)]},expectedPlans:[{index:0,beforeCents:5000},{index:1,beforeCents:6000}]},
  {...base,command:"J'ai payé 20 euros chez Lidl"},
  {...base,requestId:"not-uuid"},
  {...base,command:"Ajoute 10 euros au budget maison",draft:{kind:"draft",operations:[{kind:"expense",categoryId:"home",owner:"B",amountCents:2000,date:ctx.today,label:"Lidl",frequency:"once"}]},expectedPlans:[]}
 ]){
  const r=await commit(bad);assert.notEqual(r.status,200,JSON.stringify(bad));
 }
 assert.equal(calls.length,0);
});
test("31aj: a stale or reused conflicting batch is reported, never silently rewritten",async()=>{
 for(const [status,expected] of [["conflict",409],["invalid",422],["unavailable",503],["forbidden",403]]){
  const {commit}=setup(async a=>({status}));
  const r=await commit(base);
  assert.equal(r.status,expected,status);
 }
 const {commit}=setup(async a=>({status:"same",count:a.actions.length,categoriesCreated:0}));
 const r=await commit(base);
 assert.equal(r.status,200);assert.equal(r.body.commit.created,false);
 const fake=setup(async a=>({status:"created",count:999,categoriesCreated:0}));
 assert.equal((await fake.commit(base)).status,503);
});
test("31aj: only authenticated requests with exact payload reach confirm_batch",async()=>{
 const calls=[],authorize=async()=>({userId,context:ctx});
 const create=auth=>createAssistantGateway({
  enabled:true,model:"@cf/google/gemma-4-26b-a4b-it",authorize:auth,
  reserve:async()=>{throw Error("no quota")},infer:async()=>{throw Error("no AI")},
  validate:core.validateResult,validateReview:core.validateReview,
  commitBatch:async a=>{calls.push(a);return {status:200,body:{commit:{kind:"batch",requestId,count:1,categoriesCreated:0}}}}
 });
 const body={action:"confirm_batch",householdId,requestId,command:base.command,draft:base.draft,expectedPlans:base.expectedPlans};
 const r=await create(authorize)({token:base.token,body});
 assert.equal(r.status,200);assert.equal(calls.length,1);
 assert.equal(calls[0].userId,userId);
 assert.equal((await create(async()=>null)({token:base.token,body})).status,403);
 assert.equal((await create(authorize)({token:base.token,body:{...body,secret:true}})).status,400);
 assert.equal((await create(authorize)({token:base.token,body:{...body,expectedPlans:null}})).status,400);
});
test("31aj: SQL transaction and receipt are service-only, atomic and protective",()=>{
 const sql=fs.readFileSync("supabase/migrations/20261121195500_smart_assistant_pilot_atomic_batch.sql","utf8");
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.smart_assistant_pilot_batch_receipts from public, anon, authenticated/i);
 assert.match(sql,/grant execute on function[\s\S]+to service_role/i);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/payload_hash/);
 assert.match(sql,/exception when sqlstate 'P0001'[\s\S]*when sqlstate 'P0002'/i);
 assert.match(sql,/v_current<>v_before/);
 assert.match(sql,/scope=v_scope/);
 assert.match(sql,/insert into public\.transactions/);
 assert.match(sql,/smart_assistant_create_category_pilot_v2/);
 assert.doesNotMatch(sql,/delete from public\.(?:categories|budgets|transactions)/i);
 const server=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");
 assert.match(server,/\/rest\/v1\/rpc\/smart_assistant_commit_batch_pilot_v1/);
 assert.match(server,/allowlist\.has\(householdId\)/);
 assert.match(server,/allowedUsers\.has\(userId\)/);
});
