import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as wait} from "node:timers/promises";
import {connected} from "./harness.mjs";
import {rows,insert,verified} from "./financial-fixture.mjs";

test("actual 31ap client and v30 Edge keep one ledger and receipts across the V3.1 upgrade",async t=>{
 const env=await connected(t,{baseline:true});
 const owner=await env.session(env.users[0]), outsider=await env.session(env.users[2]);
 const h=await verified(owner.rpc("ensure_personal_household",{p_household_name:"Historique pilote",p_display_name:"Alex"}));
 await verified(owner.call("/rest/v1/households?id=eq."+h,{method:"PATCH",body:{household_mode:"solo"}}));
 const [cat]=await insert(owner,"categories",{household_id:h,legacy_id:"groceries",name:"Courses",type:"expense",group_name:"Vie courante",owner_slot:"B",created_from:"2025-01-01"});
 const [restaurant]=await insert(owner,"categories",{household_id:h,legacy_id:"restaurants",name:"Restaurants",type:"expense",group_name:"Vie courante",owner_slot:"B",created_from:"2025-01-01"});
 for(const category of [cat,restaurant])await insert(owner,"budgets",{household_id:h,category_id:category.id,month:"2025-01-01",scope:"forward",owner_slot:"B",planned_amount:100});
 await env.startAssistant(h,[owner.user.id],{legacy:true});
 const command="Augmente mon budget Restaurants de 10 €.";
 const analyze=()=>verified(owner.assistant({householdId:h,command,context:{}}));
 const initial=await analyze();
 assert.equal(initial.metering.tokens.total,0);
 const request={action:"confirm_batch",householdId:h,requestId:randomUUID(),command,draft:initial.result,expectedPlans:initial.planPreviews.map(p=>({index:p.index,beforeCents:p.beforeCents}))};
 const receipt=await verified(owner.assistant(request));
 assert.equal(receipt.commit.created,true);
 const quota=await verified(owner.assistant({action:"usage",householdId:h}));
 const root=process.env.SB_TEST_EDGE30_ROOT;
 assert.ok(root);
 const client=await env.session(env.users[0]);
 const page=await client.openApp(h,"preview/assistant/live/",root,{historicalLogin:true});
 await page.locator("#pilotPassword").fill(client.user.password);
 await page.locator("#pilotSignIn").click();
 try{await page.locator("#pilotAssistant").waitFor({state:"visible",timeout:15000})}
 catch(error){throw Error("Historical pilot login status: "+(await page.locator("#pilotLoginStatus").textContent()),{cause:error})}
 const submit=async text=>{
  await page.locator("#sbAssistantInput").fill(text);
  await page.locator("#send").click();
  await page.getByRole("button",{name:"Confirmer",exact:true}).waitFor({timeout:15000});
  await page.getByRole("button",{name:"Confirmer",exact:true}).click();
  await page.locator("#sbAssistantStatus").filter({hasText:"Enregistré · aucun appel IA."}).waitFor({timeout:15000});
 };
 await submit("J’ai dépensé 28 € chez Lidl.");
 const sorted=items=>items.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const snapshot=async()=>Object.fromEntries(await Promise.all(["categories","budgets","transactions","recurrences","account_opening_balances"].map(async table=>[table,sorted(await rows(owner,table,h))])));
 const before=await snapshot();
 assert.equal(before.transactions.length,1);
 assert.equal(Math.round(Number(before.transactions[0].amount)*100),2800);
 assert.equal((await outsider.assistant(request)).status,403);
 env.upgradeV31();
 // PostgREST reload is asynchronous; wait only for the new RPC to become visible.
 let ready=false;
 for(let i=0;i<50;i++){
  const r=await owner.rpc("budget_builder_setup",{p_household:h,p_action:"status"});
  if(r.ok&&r.data?.status==="unavailable"){ready=true;break}
  await wait(200);
 }
 assert.ok(ready,"V3.1 API contract did not reload");
 assert.deepEqual(await snapshot(),before,"migration modified the historical ledger");
 const replay=await verified(owner.assistant(request));
 assert.equal(replay.commit.requestId,receipt.commit.requestId);
 assert.equal(replay.commit.created,false);
 assert.deepEqual(await snapshot(),before,"historical replay wrote additional rows");
 const after=await analyze();
 assert.equal(after.metering.tokens.total,0);
 assert.equal(after.planPreviews[0].beforeCents,11000);
 assert.equal((await outsider.assistant(request)).status,403);
 // Fresh browser page uses the same historical client and account after migration.
 const next=await env.session(env.users[0]);
 const post=await next.openApp(h,"preview/assistant/live/",root,{historicalLogin:true});
 await post.locator("#pilotPassword").fill(next.user.password);
 await post.locator("#pilotSignIn").click();
 try{await post.locator("#pilotAssistant").waitFor({state:"visible",timeout:15000})}
 catch(error){throw Error("Historical pilot login after upgrade: "+(await post.locator("#pilotLoginStatus").textContent()),{cause:error})}
 await post.locator("#sbAssistantInput").fill("J’ai dépensé 12 € chez Lidl.");
 await post.locator("#send").click();
 await post.getByRole("button",{name:"Confirmer",exact:true}).click({timeout:15000});
 await post.locator("#sbAssistantStatus").filter({hasText:"Enregistré · aucun appel IA."}).waitFor({timeout:15000});
 const final=await snapshot();
 assert.deepEqual(final.transactions.map(r=>Math.round(Number(r.amount)*100)).sort((a,b)=>a-b),[1200,2800]);
 assert.deepEqual(final.budgets,before.budgets);
 assert.deepEqual(await verified(owner.assistant({action:"usage",householdId:h})),quota);
});
