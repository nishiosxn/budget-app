import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import {createAssistantGateway} from "../supabase/functions/smart-assistant/gateway.mjs";
const householdId="11111111-1111-4111-8111-111111111111";
test("app session rejects household or identity changes and never places tokens in navigation", async()=>{
 let household=householdId,user="alice";
 const box={localStorage:{getItem:()=>household},ACTIVE_HOUSEHOLD_KEY:"active",URLSearchParams,location:{search:"?month=2026-11"},cloudClient:{auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:"test-only"}}})}}};
 vm.runInNewContext(fs.readFileSync("assistant/session.js","utf8"),box);
 const api=box.SmartBudgetAssistantSession;
 assert.equal((await api.current()).householdId,householdId);assert.equal(api.context().selectedMonth,"2026-11");
 household="beta";await assert.rejects(api.current(),/changé/);household=householdId;
 user="bob";await assert.rejects(api.current(),/changé/);
});
test("local-only mode never reserves quota and never invokes Gemma",async()=>{
 let calls=0;
 const handle=createAssistantGateway({enabled:true,model:"@cf/google/gemma-4-26b-a4b-it",authorize:async()=>({context:{categories:[]}}),reserve:async()=>{calls++;return true},infer:async()=>{calls++}});
 const r=await handle({token:"t".repeat(32),body:{householdId,context:{},command:"commande ambiguë",localOnly:true}});
 assert.equal(r.body.error,"local_only");assert.equal(r.body.metering.tokens.total,0);assert.equal(calls,0);
});
test("every first-party resource resolves relative to the integrated URL",()=>{
 const html=fs.readFileSync("assistant/index.html","utf8");
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(match[1].startsWith("https:"))continue;
  const url=new URL(match[1],"http://localhost/budget-app/test/assistant/");
  assert.ok(url.pathname.startsWith("/budget-app/test/"));
  assert.ok(fs.existsSync(url.pathname.slice("/budget-app/test/".length)||"."),url.pathname);
 }
});
