import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {resolve,sep} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {connected} from "./harness.mjs";
import {completeSetup,provision,rows} from "./financial-fixture.mjs";
import {allowedPath} from "../prepare-v31-preview.mjs";

const sha=bytes=>createHash("sha256").update(bytes).digest("hex");

test("the exact isolated preview package loads and confirms a local-only expense",async t=>{
 assert.ok(process.env.SB_TEST_PREVIEW_ROOT,"Preview package required");
 const root=await fs.realpath(process.env.SB_TEST_PREVIEW_ROOT);
 assert.ok(root.startsWith(await fs.realpath(process.env.RUNNER_TEMP)+sep),"Expected CI temporary package");
 const report=JSON.parse(await fs.readFile(resolve(root,"preview-source.json"),"utf8"));
 assert.equal(report.sourceSha,execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim());
 assert.equal(report.target,"loopback-fixture-only");
 assert.equal(report.readyForHostedUse,false);
 assert.equal(report.deploy,false);
 assert.equal(report.packageSha256,sha(JSON.stringify(report.files)));
 for(const [path,expected] of Object.entries(report.files)){
  assert.ok(allowedPath(path),path);
  const file=await fs.realpath(resolve(root,path));
  assert.ok(file.startsWith(root+sep));
  assert.equal(sha(await fs.readFile(file)),expected,path);
 }
 for(const file of ["js/supabase-config.js","js/supabase-client.js","preview/assistant/live/config.js"]){
  const config=await fs.readFile(resolve(root,file),"utf8");
  assert.ok(!/https?:\/\/[a-z0-9.-]+\.supabase\.co\b/i.test(config));
  if(file!=="js/supabase-client.js")assert.match(config,/http:\/\/127\.0\.0\.1:54321/);
 }
 const env=await connected(t);
 const owner=await env.session(env.users[0]);
 const outsider=await env.session(env.users[2]);
 const {h}=await completeSetup(owner,"solo");
 await env.startAssistant(h,[owner.user.id]);
 // Exercise the actual Edge CORS policy without the browser bridge removing Origin.
 const edge="http://127.0.0.1:8000";
 const official="https://nishiosxn.github.io";
 const preflight=await fetch(edge,{method:"OPTIONS",headers:{Origin:official,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization, apikey, content-type"},redirect:"error"});
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get("access-control-allow-origin"),official);
 for(const origin of ["https://preview-unapproved.example.test","null","https://nishiosxn.github.io.example.test"]){
  for(const method of ["OPTIONS","POST"]){
   const blocked=await fetch(edge,{method,headers:{Origin:origin},redirect:"error"});
   assert.equal(blocked.status,403);
  }
 }
 const unsigned=await fetch(edge,{method:"POST",headers:{Origin:official,"Content-Type":"application/json"},body:"{}",redirect:"error"});
 assert.equal(unsigned.status,401);
 const page=await owner.openApp(h,"",root);
 await page.waitForFunction(h=>cloudSyncReady&&activeHouseholdId===h&&!cloudBootstrapPromise&&
  cloudReadSyncBaseline()?.householdId===h&&cloudLastSyncedDigest===cloudSyncDigest(),h,{timeout:10000});
 assert.match(await page.locator(".settings-version").textContent(),/V3\.1/);
 const later=page.locator("[data-pwa-later]");
 if(await later.isVisible())await later.click();
 await page.locator('[data-tab="categories"]').click();
 assert.equal(await page.evaluate(()=>[...cloudBuildLocalSnapshot().tables.categories.keys()].length),9);
 await page.locator(".assistant-nav[data-open-assistant]").click();
 await page.locator("#pilotAssistant").waitFor({state:"visible",timeout:10000});
 await page.locator("#sbAssistantInput").fill("J’ai dépensé 28 € chez Lidl.");
 await page.locator("#send").click();
 await page.locator("#sbAssistantStatus").filter({hasText:/0 token IA/}).waitFor({timeout:10000});
 await page.locator(".pilot-op").filter({hasText:/Lidl/}).waitFor({timeout:10000});
 assert.deepEqual(await rows(owner,"transactions",h,"&archived_at=is.null"),[]);
 await page.getByRole("button",{name:"Confirmer",exact:true}).click();
 // Read back through the authorized browser session, not just the UI.
 let saved=[];
 for(let i=0;i<25;i++){
  saved=await rows(owner,"transactions",h,"&archived_at=is.null");
  if(saved.length)break;
  await new Promise(r=>setTimeout(r,200));
 }
 assert.equal(saved.length,1);
 assert.equal(Number(saved[0].amount),28);
 assert.deepEqual(await rows(outsider,"transactions",h),[]);
 // The Assistant is a separate route; resolve admin from the package root.
 await page.goto(env.origin+"/__app/admin/");
 assert.equal(new URL(page.url()).pathname,"/__app/admin/");
 await page.locator("#adminDeniedView:not([hidden]),#adminLoginView:not([hidden])").first().waitFor({timeout:10000});
 console.log("Exact preview SHA, local-only confirmation, no pre-confirmation write, outsider isolation and admin route verified.");
});

test("initial Builder checkpoint resumes in a new real browser session without financial writes",async t=>{
 const env=await connected(t);
 const first=await env.session(env.users[0]);
 const h=await provision(first);
 const root=await fs.realpath(process.env.SB_TEST_PREVIEW_ROOT);
 const page=await first.openApp(h,"",root);
 await page.locator(".setup-builder-title h3").filter({hasText:"Votre foyer"}).waitFor({timeout:10000});
 const later=page.locator("[data-pwa-later]");if(await later.isVisible())await later.click();
 await page.locator('[data-setup-household="name"]').fill("Brouillon de reprise");
 await page.locator('[data-setup-action="next"]').click();
 await page.locator('[data-setup-amount="income:salary-b"]').waitFor();
 await page.locator('[data-setup-amount="income:salary-b"]').fill("1456.01");
 await page.locator('[data-setup-action="next"]').click();
 await page.locator('[data-setup-amount="expense:rent"]').waitFor();
 assert.deepEqual(await rows(first,"categories",h),[]);
 assert.deepEqual(await rows(first,"budgets",h),[]);
 await first.context.close();
 const next=await env.session(env.users[0]);
 const resumed=await next.openApp(h,"",root);
 await resumed.locator('[data-setup-amount="expense:rent"]').waitFor({timeout:10000});
 assert.deepEqual(await resumed.evaluate(()=>({
  step:setupBuilderController.step,name:setupBuilderController.draft.household.name,
  salary:setupBuilderController.draft.income["salary-b"].amount
 })),{step:2,name:"Brouillon de reprise",salary:"1456.01"});
 assert.deepEqual(await rows(next,"categories",h),[]);
 assert.deepEqual(await rows(next,"budgets",h),[]);
 const outsider=await env.session(env.users[2]);
 assert.equal((await outsider.rpc("budget_builder_setup",{p_household:h,p_action:"status"})).ok,false);
});
