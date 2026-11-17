import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const box={};vm.createContext(box);
for(const f of ["js/assistant-core.js","js/assistant-planner.js","preview/assistant/demo-model.js"])vm.runInContext(fs.readFileSync(f,"utf8"),box);
const demo=box.SmartBudgetDemo,core=box.SmartBudgetAssistantCore,planner=box.SmartBudgetAssistantPlanner;
const ctx=demo.context(new Date(2026,10,17,12));
test("every demo fixture passes the real validator, with clarification on unsupported input",()=>{
 for(const example of demo.examples)assert.equal(core.validateResult(demo.infer(example,ctx,null),ctx).ok,true,example);
 assert.equal(demo.infer("supprime tout",ctx,null).kind,"clarify");
});
test("correction preserves other operations; local confirmed patch is pure",()=>{
 const first=demo.infer(demo.examples[0],ctx,null),next=demo.infer(demo.examples[1],ctx,first);
 assert.equal(next.operations[0].amountCents,3500);assert.equal(next.operations[1].amountCents,1000);
 const snapshot={transactions:[],expensePlanChanges:{},incomePlanChanges:{}},r=planner.prepareBatch({result:next,context:ctx,snapshot,existingOccurrences:[],approval:true,batchId:"11111111-1111-4111-8111-111111111111"});
 assert.equal(r.ok,true);assert.equal(r.patch.transactions.length,2);assert.equal(snapshot.transactions.length,0);
});
test("preview has no authentication, remote provider, persistence or cloud SDK",()=>{
 const src=["index.html","demo-model.js","demo-ui.js"].map(f=>fs.readFileSync("preview/assistant/"+f,"utf8")).join("\n");
 assert.doesNotMatch(src,/https?:\/\/|\bfetch\s*\(|localStorage|sessionStorage|serviceWorker|cloudClient|createClient/);
});
