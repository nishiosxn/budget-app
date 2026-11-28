import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {resolve,sep} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {connected} from "./harness.mjs";
import {completeSetup,rows} from "./financial-fixture.mjs";
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
 await page.goto(new URL("admin/",page.url()).href);
 await page.locator("#adminDeniedView:not([hidden]),#adminLoginView:not([hidden])").first().waitFor({timeout:10000});
 console.log("Exact preview SHA, local-only confirmation, no pre-confirmation write, outsider isolation and admin denial verified.");
});
