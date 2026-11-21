import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
import {createTransactionCommit} from "../supabase/functions/smart-assistant/commit.mjs";
import {createAssistantGateway} from "../supabase/functions/smart-assistant/gateway.mjs";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore,householdId="11111111-1111-4111-8111-111111111111",requestId="22222222-2222-4222-8222-222222222222",categoryId="33333333-3333-4333-8333-333333333333",incomeId="44444444-4444-4444-8444-444444444444";
const context={today:"2026-11-19",firstMonth:"2026-11",lastMonth:"2028-12",selectedMonth:"2026-11",solo:true,actor:"B",members:{B:"test"},categories:[{id:"groceries",kind:"expense",name:"Courses",owner:"B",createdFrom:"2026-11"},{id:"salary",kind:"income",name:"Salaire",owner:"B",createdFrom:"2026-11"}]};
const expense={kind:"expense",categoryId:"groceries",owner:"B",amountCents:4500,date:"2026-11-19",label:"Lidl",frequency:"once"};
const income={...expense,kind:"income",categoryId:"salary",amountCents:1000,label:"Prime"};
const draft={kind:"draft",operations:[expense,income]},input={token:"authenticated-test-token",householdId,requestId,draft,context};
function setup({lost=false,readFailure=false,insertFailure=false}={}){
 const stored=new Map(),calls=[];
 const run=createTransactionCommit({validateReview:core.validateReview,
 readCategories:async(t,h)=>{assert.equal(h,householdId);assert.equal(t,input.token);return [{id:categoryId,legacy_id:"groceries",type:"expense",is_saving:false},{id:incomeId,legacy_id:"salary",type:"income",is_saving:false}]},
 readRows:async(t,h,ids)=>{assert.equal(h,householdId);assert.equal(ids.length,12);if(readFailure)throw Error("offline");return ids.map(id=>stored.get(id)).filter(Boolean)},
 insertRows:async(t,rows)=>{calls.push(rows);if(insertFailure||rows.some(r=>stored.has(r.id)))throw Error("atomic rejection");for(const row of rows)stored.set(row.id,{...row});if(lost)throw Error("lost response")}
 });
 return {run,stored,calls};
}
test("one POST contains whole validated batch; exact cents and app-compatible metadata",async()=>{
 const {run,stored,calls}=setup();const r=await run(input);assert.equal(r.status,200);assert.equal(r.body.commit.count,2);assert.equal(stored.size,2);assert.equal(calls.length,1);assert.equal(calls[0][0].amount,45);assert.equal(calls[0][0].category_id,categoryId);assert.equal(calls[0][1].metadata.type,"income");
 assert.equal((await run(input)).status,200);assert.equal(calls.length,1);
});
test("lost response verified, replay with changed or shortened batch rejected",async()=>{
 const {run,stored,calls}=setup({lost:true});assert.equal((await run(input)).status,200);
 assert.equal((await run({...input,draft:{kind:"draft",operations:[{...expense,amountCents:4700},income]}})).status,409);
 assert.equal((await run({...input,draft:{kind:"draft",operations:[expense]}})).status,409);assert.equal(stored.size,2);assert.equal(calls.length,1);
});
test("invalid, unauthorized owner, duplicates, future, missing category, monthly and plans are fail-closed",async()=>{
 const {run,calls}=setup();
 for(const o of [{...expense,owner:"A"},{...expense,date:"2026-12-01"},{...expense,amountCents:0},{...expense,categoryId:null},{...expense,frequency:"monthly"},{...expense,kind:"plan",planMode:"increase"}])assert.equal((await run({...input,draft:{kind:"draft",operations:[o]}})).status,422);
 assert.equal((await run({...input,draft:{kind:"draft",operations:[expense,expense]}})).status,422);
 assert.equal((await run({...input,context:{...context,solo:false}})).status,422);assert.equal(calls.length,0);
});
test("read failure never writes, insert failure isn't reported as success",async()=>{
 const a=setup({readFailure:true});assert.equal((await a.run(input)).status,503);assert.equal(a.calls.length,0);
 const b=setup({insertFailure:true});assert.equal((await b.run(input)).status,503);assert.equal(b.stored.size,0);
});
test("gateway authenticates confirmation, never reserves or infers",async()=>{
 const calls=[];const create=authorize=>createAssistantGateway({enabled:true,model:"@cf/google/gemma-4-26b-a4b-it",authorize,reserve:async()=>{throw Error("quota must not run")},infer:async()=>{throw Error("AI must not run")},validate:core.validateResult,commitTransactions:async args=>{calls.push(args);return {status:200,body:{commit:{requestId,count:2}}}}});
 const req={token:input.token,body:{action:"confirm",householdId,requestId,draft}};
 assert.equal((await create(async()=>null)(req)).status,403);assert.equal(calls.length,0);
 assert.equal((await create(async()=>({context}))(req)).status,200);assert.equal(calls.length,1);assert.equal(calls[0].context,context);
 assert.equal((await create(async()=>({context}))({...req,body:{...req.body,evil:true}})).status,400);
});
