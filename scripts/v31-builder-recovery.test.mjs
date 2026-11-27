import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {randomUUID} from "node:crypto";

function transport(){
 let staged=null,complete=false;
 const api={calls:[],fail:null,commits:0,readbacks:0,preferences:[]};
 api.submitted=()=>structuredClone(staged?.draft);
 const trip=point=>{if(api.fail===point){api.fail=null;throw Error("Connexion interrompue")}};
 api.rpc=async (household,action,request,draft)=>{
  assert.equal(household,"household");
  api.calls.push(action);
  if(complete)return {status:"complete",requestId:staged.requestId};
  if(action==="status")return staged?{status:"staged",...structuredClone(staged)}:{status:"pending"};
  if(action==="stage"){
   trip("before-stage");
   if(staged&&staged.requestId!==request)return {status:"staged",...structuredClone(staged)};
   staged??={requestId:request,draft:structuredClone(draft)};
   trip("after-stage");
   return {status:"staged",requestId:request};
  }
  assert.equal(action,"commit");
  assert.equal(request,staged.requestId);
  trip("during-commit");
  complete=true;
  api.commits++;
  trip("after-commit");
  return {status:"complete",requestId:request};
 };
 api.load=async()=>{assert.ok(complete);trip("readback");api.readbacks++};
 return api;
}

function tab(api,setup={status:"pending"}){
 const events=[],marker=new Map(),classes=new Set();
 const classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
 const box=vm.createContext({
  activeHouseholdId:"household",cloudSession:{user:{id:"creator"}},cloudSyncReady:true,cloudPushInProgress:false,
  navigator:{onLine:true},crypto:{randomUUID},cloudBudgetBuilderSetup:api.rpc,cloudLoadState:api.load,
  document:{documentElement:{classList},getElementById:()=>null,addEventListener(){}},
  window:{addEventListener(){}},clearTimeout(){},
  localStorage:{setItem:(key,value)=>marker.set(key,value)},
  ownerToSlot:owner=>owner==="common"?null:owner,cloudMonthDate:key=>key+"-01",
  normalizeUserAppearance:x=>x,hexToHsv:()=>({}),currentUserAppearance:()=>({color:"purple",customColor:"#5C29D6"}),
  async saveUserAppearance(value){api.preferences.push(value)},
  showUndoToast:message=>events.push(message)
 });
 const run=code=>vm.runInContext(code,box);
 for(const file of ["config","data","storage","cloud-save","setup-builder"]){
  vm.runInContext(fs.readFileSync("js/"+file+".js","utf8"),box,{filename:file+".js"});
 }
 const builder=run("setupBuilderController");
 builder.ensureRoot=()=>builder.root={classList,setAttribute(){}};
 builder.render=()=>{};
 builder.setStatus=message=>events.push(message);
 builder.open(setup);
 return {builder,box,events,marker,run};
}

for(const mode of ["solo","couple"])test("the "+mode+" review matches the atomic submission and keeps stable IDs",async()=>{
 const api=transport(),client=tab(api),b=client.builder;
 b.draft.household={name:"Foyer fictif",personB:"Alex",personA:"Camille",mode};
 b.draft.income["salary-b"].amount="1456.01";
 if(mode==="couple"){
  b.draft.income["salary-a"].selected=true;
  b.draft.income["salary-a"].amount="300.07";
 }
 b.draft.expense.rent.amount="123.45";
 b.draft.expense["saving-b"].selected=true;
 b.draft.expense["saving-b"].amount="10.03";
 Object.assign(b.draft.subscriptions.netflix,{selected:true,period:"annual",amount:"99.99"});
 b.addCustom("envelope");
 b.draft.customExpense[0].amount="5.07";
 const review=b.totals();
 const customId=b.draft.customExpense[0].id;
 const before=client.run("cloudSyncDigest()");
 await Promise.all([b.finish(),b.finish()]);
 const submission=api.submitted();
 const rows=submission.categories;
 const sum=type=>rows.filter(x=>x.type===type).reduce((n,x)=>n+x.amountCents,0)/100;
 assert.equal(sum("income"),review.income);
 assert.equal(sum("expense"),review.expense);
 assert.equal(rows.length,review.count);
 assert.equal(rows.find(x=>x.id==="setup-sub-netflix").amountCents,833);
 assert.equal(rows.find(x=>x.id==="saving-b").saving,true);
 assert.equal(rows.some(x=>x.id===customId),true);
 assert.equal(rows.some(x=>x.owner==="A"),mode==="couple");
 assert.equal(submission.personA,"Camille");
 assert.equal(client.run("cloudSyncDigest()"),before);
 assert.deepEqual(api.calls,["stage","commit"]);
 assert.equal(api.commits,1);
 assert.equal(api.readbacks,1);
 assert.equal(api.preferences[0].color,"purple");
 assert.deepEqual([...client.marker.values()],["complete"]);
});

test("offline and unacknowledged staging never mark the household complete",async()=>{
 const api=transport(),client=tab(api);
 client.box.navigator.onLine=false;
 await client.builder.finish();
 assert.deepEqual(api.calls,[]);
 client.box.navigator.onLine=true;
 api.fail="before-stage";
 await client.builder.finish();
 assert.equal(client.marker.size,0);
 assert.equal(api.commits,0);
 const request=client.builder.requestId;
 await client.builder.finish();
 assert.equal(client.builder.requestId,request);
 assert.equal(api.commits,1);
});

for(const failure of ["after-stage","during-commit"])test("a new browser session resumes the server draft after "+failure,async()=>{
 const api=transport(),first=tab(api);
 first.builder.draft.household.name="Foyer à reprendre";
 first.builder.addCustom("subscription");
 first.builder.draft.customSubscriptions[0].amount="120";
 first.builder.draft.customSubscriptions[0].period="annual";
 api.fail=failure;
 await first.builder.finish();
 assert.equal(first.marker.size,0);
 assert.equal(api.commits,0);
 const pending=await api.rpc("household","status");
 const next=tab(api,pending);
 assert.equal(next.builder.step,6);
 assert.equal(next.builder.prepared,true);
 assert.equal(next.builder.stagedMonthlyLines().subscriptions[0].cents,1000);
 await next.builder.finish();
 assert.equal(api.commits,1);
 assert.equal(api.readbacks,1);
 assert.equal(api.submitted().name,"Foyer à reprendre");
 assert.equal(next.builder.requestId,first.builder.requestId);
});

for(const failure of ["after-commit","readback"])test("retry reads a committed setup without reapplying it after "+failure,async()=>{
 const api=transport(),client=tab(api);
 api.fail=failure;
 await client.builder.finish();
 assert.equal(api.commits,1);
 assert.equal(client.marker.size,0);
 const status=await api.rpc("household","status");
 assert.equal(status.status,"complete");
 await client.builder.finish();
 assert.equal(api.commits,1);
 assert.equal(api.readbacks,1);
 assert.equal(api.calls.filter(x=>x==="commit").length,1);
});

test("a concurrent tab needs to review the first staged draft and a changed session cannot commit it",async()=>{
 const api=transport(),first=tab(api),second=tab(api);
 first.builder.draft.household.name="Brouillon original";
 api.fail="after-stage";
 await first.builder.finish();
 await second.builder.finish();
 assert.equal(api.commits,0);
 assert.equal(second.builder.initialPayload.name,"Brouillon original");
 second.box.saveUserAppearance=async()=>{second.box.cloudSession={user:{id:"another-account"}}};
 await second.builder.finish();
 assert.equal(api.commits,0);
 assert.equal(second.marker.size,0);
});

test("authoritative cloud readback preserves empty category groups and opening balances",async()=>{
 const client=tab(transport());
 const records={
  households:{id:"household",name:"Foyer initial",household_mode:"solo",person_b_label:"Alex"},
  categories:[{id:"custom-id",legacy_id:"setup-sub-example",name:"Abonnement fictif",type:"expense",
   is_custom:true,group_name:"Abonnements",created_from:"2026-11-01",owner_slot:"B"}],
  budgets:[{category_id:"custom-id",planned_amount:8.33,month:"2026-11-01",scope:"forward",owner_slot:"B"}],
  transactions:[],recurrences:[],account_opening_balances:[{household_id:"household",amount:34.56}]
 };
 const chain=table=>({
  select(){return this},eq(){return this},
  single:async()=>({data:records[table]}),order:async()=>({data:records[table]})
 });
 let balances;
 Object.assign(client.box,{cloudClient:{from:chain},cloudHouseholds:[],cloudApplyingRemote:false,
  setCloudStatus(){},reloadUiFromState(){},updateCloudHouseholdUi(){},
  loadAccountOpeningBalanceRows:rows=>{balances=rows},slotToOwner:slot=>slot||"common"});
 for(const name of ["cloud-state-core","cloud-load"]){
  vm.runInContext(fs.readFileSync("js/"+name+".js","utf8"),client.box);
 }
 await client.run("cloudLoadState()");
 assert.equal(client.run("state.baseIncomeCategories.length+state.baseExpenseCategories.length"),0);
 assert.equal(client.run("state.customExpenseCategories[0].id"),"setup-sub-example");
 assert.equal(client.run('state.expensePlanChanges["setup-sub-example"].forward["2026-11"].budget'),8.33);
 assert.equal(client.run("state.transactions.length"),0);
 assert.deepEqual(balances,records.account_opening_balances);
});

test("only a changed, unreceived draft requires a navigation warning; closing clears it",async()=>{
 const api=transport(),client=tab(api);
 assert.equal(client.builder.hasUnreceivedDraft(),false);
 client.builder.draft.household.name="Foyer fictif à garder";
 assert.equal(client.builder.hasUnreceivedDraft(),true);
 api.fail="before-stage";
 await client.builder.finish();
 assert.equal(client.builder.hasUnreceivedDraft(),true);
 client.builder.close();
 assert.equal(client.builder.hasUnreceivedDraft(),false);
 assert.equal(client.builder.initialPayload,null);
 assert.equal(client.builder.draft,null);
});
