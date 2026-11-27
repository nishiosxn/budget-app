import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {connected} from "./harness.mjs";
import {setup,completeSetup,provision,payload,invite,rows,insert,verified} from "./financial-fixture.mjs";
import {appState} from "./app-state.mjs";

test("Builder results survive lost HTTP responses and are visible to the invited member",async t=>{
 const env=await connected(t);
 const [owner,partner,outsider]=await Promise.all(env.users.map(u=>env.session(u)));
 const h=await provision(owner),req=randomUUID(),draft=payload("couple");
 const appearance={color:"purple",font:"current",customColor:"#5C29D6"};
 await verified(owner.call("/auth/v1/user",{method:"PUT",body:{data:{budget_appearance:appearance}}}));
 const device=await env.session(env.users[0]);
 assert.equal(await provision(device),h);
 await owner.context.setOffline(true);
 await assert.rejects(setup(owner,h,"stage",req,draft));
 await owner.context.setOffline(false);
 assert.equal((await setup(device,h,"status")).status,"pending");

 await owner.page.route("**/rpc/budget_builder_setup",async route=>{
  const request=route.request().postDataJSON();
  if(request.p_action!=="stage")return route.fallback();
  const remote=await route.fetch();
  assert.ok(remote.ok());
  await route.abort("connectionreset");
 },{times:1});
 await assert.rejects(setup(owner,h,"stage",req,draft));
 await owner.context.close();
 const resumed=await env.session(env.users[0]);
 assert.deepEqual((await verified(resumed.call("/auth/v1/user"))).user_metadata.budget_appearance,appearance);
 assert.deepEqual((await setup(resumed,h,"status")).draft,draft);
 assert.equal((await rows(device,"categories",h)).length,0);

 await resumed.page.route("**/rpc/budget_builder_setup",async route=>{
  const remote=await route.fetch();
  assert.ok(remote.ok());
  await route.abort("connectionreset");
 },{times:1});
 await assert.rejects(setup(resumed,h,"commit",req));
 const receipt=await setup(device,h,"status");
 assert.deepEqual(receipt,{status:"complete",requestId:req});
 assert.deepEqual(await setup(device,h,"commit",req),receipt);
 await invite(device,partner,h);

 const categories=await rows(partner,"categories",h),budgets=await rows(partner,"budgets",h);
 assert.equal(categories.length,draft.categories.length);
 assert.equal(budgets.length,categories.length);
 const actual=categories.map(c=>{
  const b=budgets.find(row=>row.category_id===c.id);
  return [c.legacy_id,Math.round(Number(b.planned_amount)*100),c.owner_slot,c.is_saving];
 }).sort();
 assert.deepEqual(actual,draft.categories.map(c=>[c.id,c.amountCents,c.owner,c.saving]).sort());
 assert.equal((await rows(partner,"household_members",h)).length,2);
 assert.deepEqual(await rows(outsider,"categories",h),[]);
 assert.equal((await outsider.rpc("budget_builder_setup",{p_household:h,p_action:"status"})).ok,false);
 const solo=await completeSetup(outsider,"solo");
 assert.notEqual(solo.h,h);
 const legacyStatus=await verified(outsider.rpc("ensure_personal_household",{p_household_name:"Ancienne version",p_display_name:"Test"}));
 assert.equal(legacyStatus,solo.h);
 assert.equal((await rows(outsider,"categories",solo.h)).length,solo.draft.categories.length);
});

test("two sessions sync adjustments, opening balances, transactions and recurring subscriptions",async t=>{
 const env=await connected(t);
 const [a,b]=await Promise.all(env.users.slice(0,2).map(u=>env.session(u)));
 const {h}=await completeSetup(a,"couple");
 const {h:personalHousehold}=await completeSetup(b,"solo");
 await invite(a,b,h);
 const categoryRows=await rows(a,"categories",h),id=name=>categoryRows.find(c=>c.legacy_id===name).id;
 await insert(a,"account_opening_balances",{household_id:h,owner_slot:"B",month:"2025-01-01",amount:34.56});
 await insert(b,"recurrences",{household_id:h,category_id:id("sub"),legacy_id:"test-subscription",
  owner_slot:"A",start_month:"2025-01-01",start_day:31,amount:12.01,label:"Abonnement test",metadata:{type:"expense"}});
 await insert(b,"transactions",{household_id:h,category_id:id("restaurants"),legacy_id:"original-receipt",
  owner_slot:"A",transaction_date:"2025-01-05",amount:15.02,label:"Reçu test",metadata:{type:"expense"}});
 const aa=appState(a,h,"owner"),bb=appState(b,h,"member");
 aa.month("Janvier 2025");bb.month("Janvier 2025");
 await Promise.all([aa.pull(),bb.pull()]);
 const amount=(client,id,month="2025-01")=>client.run("actualForCategoryAtMonth("+JSON.stringify(id)+","+JSON.stringify(month)+")");
 assert.equal(amount(bb,"restaurants"),15.02);
 aa.run('prototypeBulkActual("expense","Vie courante","fill-empty")');
 await aa.push();
 await bb.pull();
 assert.equal(amount(bb,"restaurants"),15.02);
 assert.equal(amount(bb,"groceries"),240);
 assert.equal(bb.run("metrics().expense"),aa.run("metrics().expense"));
 assert.equal(bb.run("SmartBudgetCategoryDistribution.buildModel({expenses:visibleExpenseCategories()}).total"),
              bb.run("Math.round(metrics().plannedExpense*100)"));
 aa.month("Février 2025");
 aa.undo();await aa.push();await bb.pull();
 assert.equal(amount(bb,"groceries"),0);
 assert.equal(amount(bb,"sub","2025-02"),12.01);

 bb.run('prototypeBulkActual("expense","Abonnements","clear")');
 await bb.push();
 await aa.pull();
 assert.equal(amount(aa,"sub"),0);
 assert.equal(amount(aa,"sub","2025-02"),12.01);
 bb.undo();await bb.push();await aa.pull();
 assert.equal(amount(aa,"sub"),12.01);
 assert.equal((await rows(a,"recurrences",h,"&archived_at=is.null")).length,1);
 assert.equal((await rows(a,"transactions",h,"&archived_at=is.null")).length,1);
 assert.equal(Number((await rows(b,"account_opening_balances",h))[0].amount),34.56);

 aa.month("Janvier 2025");
 aa.run('setCategoryPlan("groceries","expense",255,"B","month")');
 bb.run('setCategoryPlan("groceries","expense",245,"B","month")');
 await aa.push();
 await assert.rejects(bb.push(),error=>error.code==="CLOUD_SYNC_CONFLICT");
 assert.equal(Number((await rows(b,"budgets",h,"&category_id=eq."+id("groceries")))[0].planned_amount),255);

 await bb.pull();
 aa.run('state.transactions.push({id:"concurrent-device-one",category:"restaurants",type:"expense",owner:"B",amount:1.23,date:"2025-01-07"})');
 bb.run('state.transactions.push({id:"concurrent-device-two",category:"restaurants",type:"expense",owner:"A",amount:2.34,date:"2025-01-07"})');
 await Promise.all([aa.push(),bb.push()]);
 await aa.pull();await bb.pull();
 assert.equal(amount(aa,"restaurants"),18.59);
 assert.equal(amount(bb,"restaurants"),18.59);
 await bb.switchHousehold(personalHousehold,"owner");
 assert.equal(amount(bb,"restaurants"),0);
 await bb.switchHousehold(h,"member");
 assert.equal(amount(bb,"restaurants"),18.59);
});

test("historical write guards reject absent and obsolete headers on all six tables",async t=>{
 const env=await connected(t);
 const owner=await env.session(env.users[0]);
 const {h}=await completeSetup(owner,"solo");
 const cat=(await rows(owner,"categories",h)).find(c=>c.legacy_id==="restaurants");
 const budget=(await rows(owner,"budgets",h)).find(b=>b.category_id===cat.id);
 const [tx]=await insert(owner,"transactions",{household_id:h,category_id:cat.id,legacy_id:"guard-tx",owner_slot:"B",amount:10,transaction_date:"2025-01-05",label:"Avant"});
 const [rec]=await insert(owner,"recurrences",{household_id:h,category_id:cat.id,legacy_id:"guard-rec",owner_slot:"B",amount:12,start_month:"2025-01-01",start_day:5,label:"Avant"});
 await insert(owner,"account_opening_balances",{household_id:h,month:"2025-01-01",owner_slot:"B",amount:20});
 const targets=[
  ["households","id=eq."+h,{name:"Après"}],
  ["categories","id=eq."+cat.id,{name:"Restaurants test"}],
  ["budgets","id=eq."+budget.id,{planned_amount:101.23}],
  ["transactions","id=eq."+tx.id,{amount:11.23}],
  ["recurrences","id=eq."+rec.id,{amount:13.23}],
  ["account_opening_balances","household_id=eq."+h+"&month=eq.2025-01-01&owner_slot=eq.B",{amount:21.23}]
 ];
 for(const [table,filter,body] of targets){
  const path="/rest/v1/"+table+"?"+filter;
  const before=await verified(owner.call(path));
  assert.equal(before.length,1,table);
  for(const headers of [{}, {"x-smart-budget-sync-version":"obsolete"}]){
   const rejected=await owner.call(path,{method:"PATCH",omitSyncVersion:true,headers,body});
   assert.equal(rejected.ok,false,table);
   assert.equal(rejected.data?.code,"P0001",table);
   assert.deepEqual(await verified(owner.call(path)),before,table);
  }
  const written=await verified(owner.call(path,{method:"PATCH",headers:{Prefer:"return=representation"},body}),table);
  assert.equal(written.length,1,table);
  for(const [key,value] of Object.entries(body))assert.equal(written[0][key],value,table+"."+key);
 }
});
