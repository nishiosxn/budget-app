import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const vmContext={};vm.createContext(vmContext);
for(const f of ["js/assistant-core.js","js/assistant-planner.js"])vm.runInContext(fs.readFileSync(f,"utf8"),vmContext);
const planner=vmContext.SmartBudgetAssistantPlanner;
const ctx={today:"2026-11-17",firstMonth:"2026-09",lastMonth:"2028-12",solo:false,categories:[{id:"food",kind:"expense",owner:"common"},{id:"salary",kind:"income",owner:"B"},{id:"save",kind:"saving",owner:"B"}]};
const base={kind:"expense",categoryId:"food",owner:"B",amountCents:2051,date:"2026-11-17",label:"Exemple",frequency:"once"};
const snapshot={transactions:[{id:"previous",type:"income",amount:10}],incomePlanChanges:{},expensePlanChanges:{food:{month:{"2026-11":{budget:5,owner:"common"}},forward:{}}}};
const make=ops=>({result:{kind:"draft",operations:ops},context:ctx,snapshot,existingOccurrences:[],approval:true,batchId:"bbb11111-1111-4111-8111-111111111111"});
test("pure confirmed mixed plan",()=>{const old=JSON.stringify(snapshot),r=planner.prepareBatch(make([base,{...base,kind:"income",categoryId:"salary",frequency:"monthly",amountCents:120000},{...base,kind:"saving",categoryId:"save",amountCents:5000},{...base,kind:"plan",owner:"common",frequency:"monthly",amountCents:30000}]));assert.equal(r.ok,true);assert.equal(r.patch.transactions[1].amount,20.51);assert.equal(r.patch.transactions[2].scope,"forward");assert.equal(r.patch.transactions[3].type,"expense");assert.equal(r.patch.expensePlanChanges.food.forward["2026-11"].budget,300);assert.equal(r.patch.expensePlanChanges.food.month["2026-11"],undefined);assert.equal(JSON.stringify(snapshot),old)});
test("no approval, invalid id, or invalid category means no patch",()=>{for(const x of [{...make([base]),approval:false},{...make([base]),batchId:"bad"},{...make([{...base,categoryId:"unknown"}])}]){const r=planner.prepareBatch(x);assert.equal(r.ok,false);assert.equal(r.patch,undefined)}});
test("duplicate recurrence occurrence and replay are blocked",()=>{const x=make([base]);assert.equal(planner.prepareBatch({...x,existingOccurrences:[base]}).ok,false);const first=planner.prepareBatch(x);assert.equal(planner.prepareBatch({...x,snapshot:first.patch}).ok,false)});
test("one invalid item blocks entire batch",()=>{const old=JSON.stringify(snapshot),r=planner.prepareBatch(make([base,{...base,amountCents:-1}]));assert.equal(r.ok,false);assert.equal(JSON.stringify(snapshot),old)});

test("monthly proposals are checked across future months, including clamped dates",()=>{
 const series={...base,date:"2026-11-30",frequency:"monthly"};const args=make([series]);
 assert.equal(planner.requiredMonths(args.result,ctx)[0],"2026-11");assert.equal(planner.requiredMonths(args.result,ctx).at(-1),"2028-12");
 const future={...base,date:"2027-02-28"};assert.equal(planner.prepareBatch({...args,existingOccurrences:[future]}).ok,false);
 assert.equal(planner.prepareBatch({...args,existingOccurrences:[{...future,date:"2027-02-27"}]}).ok,true);
});
test("series and one-time proposal overlap blocks entire batch",()=>{
 const earlier={...base,date:"2026-10-17",frequency:"monthly"};const args=make([earlier,base]);
 const result=planner.prepareBatch(args);assert.equal(result.ok,false);assert.equal(result.patch,undefined);
});
