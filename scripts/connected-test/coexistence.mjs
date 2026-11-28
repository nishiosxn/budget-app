import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {connected} from "./harness.mjs";
import {provision,setup,payload,rows,verified} from "./financial-fixture.mjs";

test("pinned V3.0 and V3.1 pages share one ledger after interrupted Builder recovery",async t=>{
 const env=await connected(t);
 const actor=await env.session(env.users[0]);
 const h=await provision(actor),req=randomUUID(),draft=payload("solo");
 assert.equal((await setup(actor,h,"stage",req,draft)).status,"staged");
 await actor.context.close();
 env.setBuilderPilot(env.users[0].id,false);
 const withdrawn=await env.session(env.users[0]);
 assert.equal((await withdrawn.rpc("budget_builder_setup",{p_household:h,p_action:"status"})).ok,false);
 assert.deepEqual(await rows(withdrawn,"categories",h),[]);
 assert.equal(await verified(withdrawn.rpc("ensure_personal_household",{p_household_name:"Ancienne version",p_display_name:"Test"})),h);
 const blocked=await withdrawn.call("/rest/v1/categories",{method:"POST",body:{household_id:h,name:"Ancienne saisie",type:"expense",created_from:"2025-01-01",legacy_id:"legacy-blocked"}});
 assert.equal(blocked.data?.code,"55000");
 env.setBuilderPilot(env.users[0].id,true);
 const resumed=await env.session(env.users[0]);
 assert.deepEqual((await setup(resumed,h,"status")).draft,draft);
 const current=await resumed.openApp(h);
 await current.locator(".setup-builder-title h3").filter({hasText:"Votre budget de départ"}).waitFor({timeout:10000});
 const later=current.locator("[data-pwa-later]");
 if(await later.isVisible())await later.click();
 await current.locator('[data-setup-action="next"]').click();
 await current.locator("#setupBuilderBackdrop").waitFor({state:"hidden",timeout:10000});
 assert.deepEqual(await setup(resumed,h,"status"),{status:"complete",requestId:req});
 const catalog=async()=>({
  categories:(await rows(resumed,"categories",h)).sort((a,b)=>a.id.localeCompare(b.id)),
  budgets:(await rows(resumed,"budgets",h)).sort((a,b)=>a.id.localeCompare(b.id))
 });
 const before=await catalog();
 assert.equal(before.categories.filter(c=>!c.archived_at).length,draft.categories.length);
 assert.deepEqual(before.categories.filter(c=>c.archived_at).map(c=>c.legacy_id).sort(),["v31-compat-base-expense","v31-compat-base-income"]);
 assert.equal(before.budgets.length,draft.categories.length);

 assert.ok(process.env.SB_TEST_V30_ROOT,"Pinned V3.0 source is required");
 const legacy=await env.session(env.users[0]);
 const old=await legacy.openApp(h,"",process.env.SB_TEST_V30_ROOT);
 assert.match(await old.locator(".settings-version").textContent(),/V3\.0/);
 assert.match(await current.locator(".settings-version").textContent(),/V3\.1/);
 // The pinned V3.0 may schedule a second bootstrap on INITIAL_SESSION.
 // cloudSyncReady alone stays true while that bootstrap resets its local seed.
 // Observe a settled real session and baseline, without modifying either client.
 for(const [version,page] of [["V3.0",old],["V3.1",current]]){
  await page.waitForFunction(h=>{
   const ready=cloudSyncReady&&activeHouseholdId===h&&!cloudBootstrapPromise&&!cloudPushInProgress&&
    cloudReadSyncBaseline()?.householdId===h&&cloudLastSyncedDigest===cloudSyncDigest()&&
    document.getElementById("cloudGate")?.getAttribute("aria-hidden")==="true";
   if(!ready){globalThis.__testSettledSince=0;return false}
   globalThis.__testSettledSince||=performance.now();
   return performance.now()-globalThis.__testSettledSince>=250;
  },h,{timeout:10000});
  const info=await page.evaluate(async()=>{
   const remote=await cloudFetchRemoteSyncSnapshot();
   return {baseIncome:state.baseIncomeCategories.map(c=>c.id),baseExpense:state.baseExpenseCategories.map(c=>c.id),
    customIncome:state.customIncomeCategories.map(c=>c.id),customExpense:state.customExpenseCategories.map(c=>c.id),
    archivedIncome:state.deletedIncomeCategoriesGlobal,archivedExpense:state.deletedCategoriesGlobal,
    remote:[...remote.tables.categories].map(([key,e])=>[key,e.payload===null]),
    baseline:Object.keys(cloudReadSyncBaseline()?.tables?.categories||{})};
  });
  console.log("Settled synthetic catalogue "+version,JSON.stringify(info));
 }
 const expectedIds=draft.categories.map(c=>c.id).sort();
 for(const [version,page] of [["V3.0",old],["V3.1",current]]){
  // Inspect the genuine client snapshot, before modifying anything.
  const ids=await page.evaluate(()=>[...cloudBuildLocalSnapshot().tables.categories.keys()].sort());
  assert.deepEqual(ids,expectedIds,version+": no default category reinjection");
  const mutations=await page.evaluate(async()=>{
   const p=cloudBuildSyncPlan(cloudBuildLocalSnapshot(),await cloudFetchRemoteSyncSnapshot(),cloudReadSyncBaseline());
   return p.mutations.filter(m=>["categories","budgets"].includes(m.table)).map(m=>[m.table,m.key,m.action]);
  });
  assert.deepEqual(mutations,[],version+": no unsolicited catalogue/budget changes");
 }
 const id1="coexist-"+randomUUID(),id2="coexist-"+randomUUID();
 async function write(page,id,amount){
  await page.evaluate(async ({id,amount})=>{
   state.transactions.push({id,category:"restaurants",type:"expense",owner:"B",amount,date:"2025-01-07",label:"Coexistence fictive"});
   try{await cloudPushLocalState({force:true})}catch(error){
    // Preserve the real guard and failure. Log only keys/counts from this synthetic ledger.
    const local=cloudBuildLocalSnapshot(),remote=await cloudFetchRemoteSyncSnapshot(),baseline=cloudReadSyncBaseline();
    const plan=cloudBuildSyncPlan(local,remote,baseline);
    const summary=Object.fromEntries(Object.keys(local.tables).map(table=>[table,{
     local:[...local.tables[table]].filter(([,entry])=>entry.payload!==null).map(([key])=>key),
     remote:[...remote.tables[table]].filter(([,entry])=>entry.payload!==null).map(([key])=>key),
     baseline:Object.keys(baseline?.tables?.[table]||{}),
     mutations:plan.mutations.filter(x=>x.table===table).map(x=>({key:x.key,action:x.action}))
    }]));
    throw Error(String(error?.message||error)+" ; synthetic sync diagnostics: "+JSON.stringify(summary),{cause:error});
   }
  },{id,amount});
 }
 await write(old,id1,12.34);
 await current.evaluate(()=>cloudLoadState());
 assert.equal(await current.evaluate(id=>state.transactions.find(x=>x.id===id)?.amount,id1),12.34);
 await write(current,id2,23.45);
 await old.evaluate(()=>cloudLoadState());
 assert.equal(await old.evaluate(id=>state.transactions.find(x=>x.id===id)?.amount,id2),23.45);
 const ledger=await rows(resumed,"transactions",h,"&archived_at=is.null");
 assert.equal(ledger.length,2);
 assert.deepEqual(await catalog(),before,"Legacy and V3.1 writes must leave all categories and budgets unchanged");
 assert.deepEqual(ledger.map(r=>Math.round(Number(r.amount)*100)).sort((a,b)=>a-b),[1234,2345]);
 assert.deepEqual(await setup(resumed,h,"commit",req),{status:"complete",requestId:req});
});
