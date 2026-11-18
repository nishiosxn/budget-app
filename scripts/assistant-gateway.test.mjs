import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createAssistantGateway,decodeModelResponse,makeModelRequest,estimateReservation} from "../supabase/functions/smart-assistant/gateway.mjs";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore, model="@cf/google/gemma-4-26b-a4b-it";
const ctx={today:"2026-11-17",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",solo:false,actor:"B",members:{B:"Membre 1",A:"Membre 2"},categories:[{id:"food",name:"Courses",kind:"expense",owner:"common",createdFrom:"2026-09"}]};
const valid={kind:"draft",operations:[{kind:"expense",categoryId:"food",owner:"B",amountCents:2000,date:"2026-11-17",label:"Achat test",frequency:"once"}]};
const request={token:"test-token-not-a-real-credential",body:{householdId:"11111111-1111-4111-8111-111111111111",command:"20 euros de courses",context:{selectedMonth:"2026-11"}}};
const setup=(opts={})=>{const calls=[];const handler=createAssistantGateway({enabled:true,model,authorize:async()=>{calls.push("auth");return {context:ctx}},reserve:async()=>{calls.push("quota");return true},infer:async()=>{calls.push("infer");return {result:{response:valid}}},validate:core.validateResult,...opts});return {handler,calls}};
test("permitted authenticated request and reservation order",async()=>{const {handler,calls}=setup();const r=await handler(request);assert.equal(r.status,200);assert.equal(r.body.result.operations[0].amountCents,2000);assert.deepEqual(calls,["auth","quota","infer"])});
test("disabled and unauthorized never invoke provider",async()=>{let {handler,calls}=setup({enabled:false});assert.equal((await handler(request)).status,503);assert.deepEqual(calls,[]);({handler,calls}=setup({authorize:async()=>null}));assert.equal((await handler(request)).status,403);assert.deepEqual(calls,[])});
test("missing bearer and malformed body rejected before auth",async()=>{const {handler,calls}=setup();assert.equal((await handler({...request,token:""})).status,401);assert.equal((await handler({...request,body:{...request.body,evil:1}})).status,400);assert.deepEqual(calls,[])});
test("quota failure fails closed",async()=>{for(const reserve of [async()=>false,async()=>{throw Error("unavailable")}]){const {handler,calls}=setup({reserve});assert.equal([429,503].includes((await handler(request)).status),true);assert.equal(calls.includes("infer"),false)}});
test("unknown model cannot run",async()=>{const {handler,calls}=setup({model:"not-approved"});assert.equal((await handler(request)).status,503);assert.equal(calls.length,0)});
test("malicious or malformed outputs cannot become proposals",async()=>{for(const output of [{kind:"delete_all"},{...valid,operations:[{...valid.operations[0],categoryId:"unknown"}]},"not json"]){const {handler}=setup({infer:async()=>({result:{response:output}})});assert.equal([422,502].includes((await handler(request)).status),true)}});
test("supports both REST output variants; rejects extra text",()=>{assert.equal(decodeModelResponse({result:{response:valid}}),valid);assert.equal(decodeModelResponse({result:{choices:[{message:{content:JSON.stringify(valid)}}]}}).kind,"draft");assert.throws(()=>decodeModelResponse({result:{response:"Here is JSON: "+JSON.stringify(valid)}}))});
test("provider receives only sanitized context and command",()=>{const payload=makeModelRequest("20 euros",ctx);assert.equal(payload.stream,false);assert.equal(payload.max_completion_tokens,1400);assert.deepEqual(JSON.parse(payload.messages[1].content),{command:"20 euros",context:ctx});assert.doesNotMatch(JSON.stringify(payload),/test-token|householdId|service_role/i)});
test("shared client and server validator remain identical",()=>{assert.equal(fs.readFileSync("js/assistant-core.js","utf8"),fs.readFileSync("supabase/functions/_shared/smart-assistant-core.js","utf8"))});

test("guarded conversation carries a bounded prior draft and question",async()=>{
 const history=[{command:"20 euros de courses",result:valid},{command:"plutôt hier ?",result:{kind:"clarify",message:"Quel jour ?"}}];
 let payload;const {handler}=setup({infer:async(_model,p)=>{payload=p;return {result:{response:valid}}}});
 const r=await handler({...request,body:{...request.body,command:"le 16 novembre",history}});
 assert.equal(r.status,200);const sent=JSON.parse(payload.messages[1].content);assert.equal(sent.history.length,2);assert.equal(sent.history[0].result.operations[0].amountCents,2000);assert.equal(sent.command,"le 16 novembre");
});
test("malformed, stale, excessive and non-draft history fails before quota or provider",async()=>{
 const entry={command:"courses",result:valid};
 for(const history of [null,[entry,entry,entry],[{...entry,evil:true}],[{...entry,command:" "}],[{...entry,command:"a".repeat(1601)}],[{...entry,result:{kind:"answer",message:"bonjour"}}],[{...entry,result:{...valid,operations:[{...valid.operations[0],categoryId:"retired"}]}}]]){
  const {handler,calls}=setup();const r=await handler({...request,body:{...request.body,history}});assert.equal(r.status,400);assert.deepEqual(calls,["auth"]);
 }
});

test("Gemma pilot reserves the bounded estimate before a real provider call",async()=>{
 let amount=null,seen;const {handler}=setup({reserve:async(_token,_household,units)=>{amount=units;return true},infer:async(_model,payload)=>{seen=payload;return {result:{response:valid}}}});
 assert.equal((await handler(request)).status,200);
 assert.equal(amount,estimateReservation(seen));assert.ok(Number.isInteger(amount)&&amount>0&&amount<=1000);
});
test("oversized context is rejected before quota or provider",async()=>{
 let invoked=false;const tooLarge={...ctx,categories:Array.from({length:280},(_,i)=>({id:"c"+i,name:"é".repeat(120),kind:"expense",owner:"common"}))};
 const {handler}=setup({authorize:async()=>({context:tooLarge}),reserve:async()=>{invoked=true;return true},infer:async()=>{invoked=true;return {result:{response:valid}}}});
 assert.equal((await handler(request)).status,413);assert.equal(invoked,false);
});
test("unpriced alternative disabled during pilot",async()=>{
 const {handler,calls}=setup({model:"@cf/zai-org/glm-4.7-flash"});
 assert.equal((await handler(request)).status,503);assert.equal(calls.length,0);
});

test("server returns only its validated catalog context",async()=>{const {handler}=setup();const result=await handler({...request,body:{...request.body,context:{secret:"untrusted",selectedMonth:"2026-11"}}});assert.equal(result.status,200);assert.deepEqual(result.body.context,ctx);assert.equal(result.body.context.secret,undefined);});

test("one provider call returns all review rows including missing category and relative budget",async()=>{let seen=0;const draft={kind:"draft",operations:[{...valid.operations[0],categoryId:null,label:"Virement maman",amountCents:1500},{...valid.operations[0],kind:"plan",owner:"common",amountCents:1000,planMode:"increase"}]};const {handler}=setup({validateReview:core.validateReview,infer:async()=>{seen++;return {result:{response:draft}}},planPreview:async()=>[{index:1,beforeCents:4500,afterCents:5500}]});const r=await handler(request);assert.equal(r.status,200);assert.equal(seen,1);assert.equal(r.body.result.operations[0].categoryId,null);assert.equal(r.body.planPreviews[0].afterCents,5500);});

test("missing restaurant category remains a valid review preview after provider normalization",async()=>{
 const {handler}=setup({normalizeDraft:core.normalizeModelDraft,validateReview:core.validateReview,infer:async()=>({result:{response:{kind:"draft",operations:[{...valid.operations[0],label:"McDo",categoryId:"fast-food",categoryHint:"food",planMode:null}]}}})});
 const r=await handler(request);assert.equal(r.status,200);assert.equal(r.body.result.operations[0].categoryId,null);assert.equal(r.body.categorySuggestions[0].ruleKey,"food");
});

test("Zara bypasses provider and quota only after authenticated household verification",async()=>{
 const {handler,calls}=setup({quickExpense:core.quickExpense,normalizeDraft:core.normalizeModelDraft,validateReview:core.validateReview});
 const r=await handler({...request,body:{...request.body,command:"J’ai dépensé 20 € chez zara"}});
 assert.equal(r.status,200);assert.equal(r.body.model,"local-rules");assert.equal(r.body.categorySuggestions[0].ruleKey,"clothing");assert.deepEqual(calls,["auth"]);
 const denied=setup({quickExpense:core.quickExpense,authorize:async()=>null});assert.equal((await denied.handler({...request,body:{...request.body,command:"J’ai dépensé 20 € chez zara"}})).status,403);
});

test("budget fast path uses current read-only preview without reserving quota",async()=>{
 const c={...ctx,categories:[{id:"fuel",name:"Carburant",kind:"expense",owner:"B"}]};
 let reads=0;const {handler,calls}=setup({authorize:async()=>({context:c}),quickExpense:core.quickCommand,planPreview:async(_token,_household,draft)=>{reads++;return [{index:0,...core.resolvePlanAmount(draft.operations[0],4500)}]}});
 const r=await handler({...request,body:{...request.body,command:"Ajoute 10 € au budget essence"}});
 assert.equal(r.status,200);assert.equal(r.body.model,"local-rules");assert.equal(r.body.planPreviews[0].afterCents,5500);assert.equal(reads,1);assert.deepEqual(calls,[]);
});

test("explicit grouped category draft and category query avoid provider calls",async()=>{let reads=0;const c={...ctx,actor:"B"};const {handler,calls}=setup({authorize:async()=>({context:c}),quickExpense:core.quickCommand,queryPreview:async()=>{reads++;return {name:"Courses",month:"2026-10",plannedCents:12000,actualCents:8000,remainingCents:4000,recurringCents:0}}});const a=await handler({...request,body:{...request.body,command:"Crée une catégorie Lego, mets-y un budget de 60 euros et ajoute-y 20 euros de dépenses."}});assert.equal(a.status,200);assert.equal(a.body.result.kind,"categoryDraft");const b=await handler({...request,body:{...request.body,command:"De combien était mon budget réel de courses le mois dernier ?"}});assert.equal(b.status,200);assert.equal(b.body.categoryReport.actualCents,8000);assert.equal(reads,1);assert.deepEqual(calls,[]);});
