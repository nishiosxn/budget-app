import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createAssistantGateway,decodeModelResponse,makeModelRequest,estimateReservation,extractTokenUsage} from "../supabase/functions/smart-assistant/gateway.mjs";
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
test("provider receives only sanitized context and command",()=>{const payload=makeModelRequest("20 euros",ctx);assert.equal(payload.stream,false);assert.equal(payload.max_completion_tokens,1024);assert.deepEqual(JSON.parse(payload.messages[1].content),{command:"20 euros",context:ctx});assert.doesNotMatch(JSON.stringify(payload),/test-token|householdId|service_role/i)});
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
 assert.equal(amount,estimateReservation(seen));assert.ok(Number.isInteger(amount)&&amount>0&&amount<=320);
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

test("Gundam compound request processed without provider or quota",async()=>{const c={...ctx,actor:"B"};const {handler,calls}=setup({authorize:async()=>({context:c}),quickExpense:core.quickCommand});const r=await handler({...request,body:{...request.body,command:"Crée la catégorie budget Gundam. Mets-y un budget de 90 euros et ajoute une dépense de 40 euros."}});assert.equal(r.status,200);assert.equal(r.body.result.kind,"categoryDraft");assert.equal(r.body.result.name,"Gundam");assert.equal(r.body.result.budgetCents-r.body.result.expenseCents,5000);assert.deepEqual(calls,[]);});

test("spoken category bundle uses Smart Engine before the quota and provider",async()=>{const {handler,calls}=setup({quickExpense:core.quickCommand});const r=await handler({...request,body:{...request.body,command:"Créer la catégorie Gundam ajoute y un budget de quatre-vingt-dix euros et une dépense de quarante euros"}});assert.equal(r.status,200);assert.equal(r.body.model,"local-rules");assert.equal(r.body.result.kind,"categoryDraft");assert.equal(r.body.result.budgetCents,9000);assert.equal(r.body.result.expenseCents,4000);assert.deepEqual(calls,["auth"]);});

test("authenticated usage-only requests are read-only and never call quota reservation or AI",async()=>{
 const current={utcDay:"2026-11-19",units:917,requests:6,limit:8000,requestLimit:100};
 let calls=0;const {handler}=setup({getQuota:async()=>{calls++;return current}});
 const r=await handler({...request,body:{householdId:request.body.householdId,action:"usage"}});
 assert.equal(r.status,200);assert.deepEqual(r.body.quota,current);assert.equal(calls,1);
 const other=setup({getQuota:async()=>current,authorize:async()=>null});
 assert.equal((await other.handler({...request,body:{householdId:request.body.householdId,action:"usage"}})).status,403);
 const bad=await handler({...request,body:{householdId:request.body.householdId,action:"usage",evil:true}});assert.equal(bad.status,400);
 const unavailable=setup({getQuota:async()=>{throw Error("offline")}});
 assert.equal((await unavailable.handler({...request,body:{householdId:request.body.householdId,action:"usage"}})).status,503);
});
test("Cloudflare reported token counts are separate from reserved daily neurons",async()=>{
 const metering={prompt_tokens:820,completion_tokens:130,total_tokens:950};
 const {handler}=setup({infer:async()=>({result:{response:valid,usage:metering}})});
 const r=await handler(request);
 assert.equal(r.status,200);assert.equal(r.body.metering.source,"cloudflare");
 assert.equal(r.body.metering.tokens.total,950);
 assert.equal(r.body.metering.tokens.input,820);
 assert.ok(r.body.metering.reservedNeurons>0);
 assert.equal(extractTokenUsage({result:{usage:{prompt_tokens:5,completion_tokens:10,total_tokens:200}}}),null);
 const invalid=setup({infer:async()=>({result:{response:{kind:"invalid"},usage:metering}})});
 const e=await invalid.handler(request);assert.equal(e.status,422);assert.equal(e.body.metering.tokens.total,950);
});
test("deterministic commands consume zero AI tokens and no reserved units",async()=>{
 const {handler,calls}=setup({quickExpense:core.quickCommand});
 const r=await handler({...request,body:{...request.body,command:"Crée une catégorie Lego, mets-y un budget de 60 euros et ajoute-y 20 euros de dépenses."}});
 assert.equal(r.status,200);assert.equal(r.body.metering.source,"local-rules");
 assert.deepEqual(r.body.metering.tokens,{input:0,output:0,total:0});
 assert.equal(r.body.metering.reservedNeurons,0);assert.deepEqual(calls,["auth"]);
});
test("quota-reading RPC uses a server credential, never the caller bearer",()=>{
 const source=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");
 assert.match(source,/\/rest\/v1\/rpc\/smart_assistant_quota_status_v1/);
 assert.match(source,/Authorization:"Bearer "\+key/);
 assert.match(source,/getQuota,commitTransactions,commitCategory,commitBatch,commitMovements,atomicReview\}\);/);
});

test("mixed savings and arbitrary named income bypass quota and Gemma",async()=>{
 const c={...ctx,categories:[...ctx.categories,{id:"savings",name:"Épargne",kind:"saving",owner:"B"},{id:"home",name:"Maison",kind:"expense",owner:"B"},{id:"rest",name:"Restaurants",kind:"expense",owner:"B"},{id:"extra",name:"Revenus supplémentaires",kind:"income",owner:"B"}]};
 const {handler,calls}=setup({authorize:async()=>({context:c}),quickExpense:core.quickCommand});
 const r=await handler({...request,body:{...request.body,command:"J'ai dépensé 20 euros chez Action, 15 euros chez McDo, j'ai reçu 15 euros de Lena et j'ai mis 100 euros en épargne"}});
 assert.equal(r.status,200);assert.equal(r.body.metering.source,"local-rules");assert.equal(r.body.metering.tokens.total,0);assert.deepEqual(Array.from(r.body.result.operations,o=>o.kind),["expense","expense","income","saving"]);assert.deepEqual(calls,[]);
});

test("31ag: expense using the exact named existing category skips AI and quota",async()=>{
 const present={...ctx,solo:true,actor:"B",today:"2026-11-21",selectedMonth:"2026-11",categories:[{id:"gundam",name:"Gundam",kind:"expense",owner:"B",createdFrom:"2026-11"}]};
 let reserved=0,inferred=0;
 const {handler}=setup({
  authorize:async()=>({context:present}),
  quickExpense:core.quickCommand,
  reserve:async()=>{reserved++;return true},
  infer:async()=>{inferred++;throw Error("Gemma must not run")}
 });
 const requestText="ajoute 50 euro de depense en gundam";
 const r=await handler({...request,body:{...request.body,command:requestText}});
 assert.equal(r.status,200);
 assert.equal(r.body.model,"local-rules");
 assert.equal(r.body.result.kind,"draft");
 assert.equal(r.body.result.operations[0].categoryId,"gundam");
 assert.equal(r.body.result.operations[0].amountCents,5000);
 assert.equal(r.body.metering.tokens.total,0);
 assert.equal(r.body.metering.reservedNeurons,0);
 assert.equal(reserved,0);assert.equal(inferred,0);
 const absent=await handler({...request,body:{...request.body,command:requestText},token:request.token});
 assert.equal(absent.status,200);
 assert.equal(reserved,0);
});



test("31ak: exact-category voice expenses bypass provider and quota after authentication",async()=>{
 const personal={...ctx,solo:true,actor:"B",categories:[
  {id:"gundam",name:"Gundam",kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]}
 ]};
 let reserved=0,called=0,authorized=0;
 const handler=createAssistantGateway({enabled:true,model,
  authorize:async()=>{authorized++;return{context:personal}},
  quickExpense:core.quickCommand,validate:core.validateResult,validateReview:core.validateReview,
  reserve:async()=>{reserved++;return true},
  infer:async()=>{called++;throw Error("AI must not be called")}
 });
 for(const command of ["J'ai dépensé 50 euros dans la catégorie Gundam","J'ai payé 50 € en Gundam","50 euros de dépense en Gundam"]){
  const r=await handler({...request,body:{...request.body,command}});
  assert.equal(r.status,200,command);
  assert.equal(r.body.model,"local-rules");
  assert.equal(r.body.result.kind,"draft");
  assert.equal(r.body.result.operations[0].categoryId,"gundam");
  assert.equal(r.body.metering.tokens.total,0);
  assert.equal(r.body.metering.reservedNeurons,0);
 }
 const noCategory=await handler({...request,body:{...request.body,command:"J'ai payé 50 euros en Inconnue"}});
 assert.equal(noCategory.status,200);
 assert.equal(noCategory.body.result.kind,"clarify");
 assert.equal(authorized,4);
 assert.equal(reserved,0);
 assert.equal(called,0);
});



test("31al: screenshot verbatim must not invoke Gemma or reserve a single token",async()=>{
 const personal={...ctx,today:"2026-11-21",solo:true,actor:"B",categories:[
  {id:"gundam",name:"Gundam",kind:"expense",owner:"B",createdFrom:"2026-11",hiddenMonths:[]}
 ]};
 let reservations=0,providerCalls=0,auth=0;
 const handler=createAssistantGateway({enabled:true,model,
  authorize:async()=>{auth++;return{context:personal}},
  quickExpense:core.quickCommand,validate:core.validateResult,validateReview:core.validateReview,
  reserve:async()=>{reservations++;return true},
  infer:async()=>{providerCalls++;throw Error("Gemma should not run")}
 });
 const screenshot="« J’ai payé 50 € en Gundam. »";
 const r=await handler({...request,body:{...request.body,command:screenshot}});
 assert.equal(r.status,200);
 assert.equal(r.body.model,"local-rules");
 assert.equal(r.body.metering.source,"local-rules");
 assert.equal(r.body.metering.tokens.total,0);
 assert.equal(r.body.metering.reservedNeurons,0);
 assert.equal(r.body.result.kind,"draft");
 assert.equal(r.body.result.operations[0].categoryId,"gundam");
 assert.equal(r.body.result.operations[0].amountCents,5000);
 const unknown=await handler({...request,body:{...request.body,command:"« J’ai payé 50 € en Unknown. »"}});
 assert.equal(unknown.status,200);
 assert.equal(unknown.body.result.kind,"clarify");
 assert.equal(auth,2);
 assert.equal(reservations,0);
 assert.equal(providerCalls,0);
});



test("31am: gateway returns a safe sidecar for missing category with zero provider or quota calls",async()=>{
 const c={...ctx,solo:true,actor:"B",today:"2026-11-21",selectedMonth:"2026-11",categories:[{id:"courses",name:"Courses",kind:"expense",owner:"B",createdFrom:"2026-09"}]};
 let quota=0,gemma=0;
 const handler=createAssistantGateway({enabled:true,model,
  authorize:async()=>({context:c,userId:"33333333-3333-4333-8333-333333333333"}),
  quickExpense:core.quickCommand,validate:core.validateResult,validateReview:core.validateReview,
  reserve:async()=>{quota++;return true},infer:async()=>{gemma++;throw Error("Gemma must not execute")}
 });
 const r=await handler({...request,body:{...request.body,command:"« J’ai payé 50 € en Gundam. »"}});
 assert.equal(r.status,200);
 assert.equal(r.body.model,"local-rules");
 assert.equal(r.body.metering.tokens.total,0);
 assert.equal(r.body.result.kind,"clarify");
 assert.equal(r.body.missingCategory.name,"Gundam");
 assert.equal(r.body.missingCategory.amountCents,5000);
 assert.equal(quota,0);assert.equal(gemma,0);
});


test("31ap: exact photographed mixed utterance skips AI and quota after authorization",async()=>{
 const c={...ctx,categories:[
  ...ctx.categories,
  {id:"rest",name:"Restaurants / fast-food",kind:"expense",owner:"common"},
  {id:"extra",name:"Revenus supplémentaires",kind:"income",owner:"B"}
 ]};
 const {handler,calls}=setup({authorize:async()=>({context:c}),quickExpense:core.quickCommand});
 const result=await handler({...request,body:{...request.body,command:"J'ai dépensé 20 euros chez McDo et recu 10 euros de Lena"}});
 assert.equal(result.status,200);
 assert.equal(result.body.model,"local-rules");
 assert.equal(result.body.metering.source,"local-rules");
 assert.equal(result.body.metering.tokens.total,0);
 assert.equal(result.body.metering.reservedNeurons,0);
 assert.deepEqual(Array.from(result.body.result.operations,o=>o.kind),["expense","income"]);
 assert.deepEqual(Array.from(result.body.result.operations,o=>o.amountCents),[2000,1000]);
 assert.deepEqual(calls,[]);
});
