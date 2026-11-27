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
 assert.equal((await rows(resumed,"categories",h)).length,draft.categories.length);

 assert.ok(process.env.SB_TEST_V30_ROOT,"Pinned V3.0 source is required");
 const legacy=await env.session(env.users[0]);
 const old=await legacy.openApp(h,"",process.env.SB_TEST_V30_ROOT);
 assert.match(await old.locator(".settings-version").textContent(),/V3\.0/);
 assert.match(await current.locator(".settings-version").textContent(),/V3\.1/);
 await old.waitForFunction(()=>cloudSyncReady&&activeHouseholdId,null,{timeout:10000});
 await current.waitForFunction(()=>cloudSyncReady&&activeHouseholdId,null,{timeout:10000});
 const id1="coexist-"+randomUUID(),id2="coexist-"+randomUUID();
 async function write(page,id,amount){
  await page.evaluate(async ({id,amount})=>{
   state.transactions.push({id,category:"restaurants",type:"expense",owner:"B",amount,date:"2025-01-07",label:"Coexistence fictive"});
   await cloudPushLocalState({force:true});
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
 assert.deepEqual(ledger.map(r=>Math.round(Number(r.amount)*100)).sort((a,b)=>a-b),[1234,2345]);
 assert.deepEqual(await setup(resumed,h,"commit",req),{status:"complete",requestId:req});
});
