import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createAssistantGateway,makeModelRequest,estimateReservation,MAX_NEURONS_PER_PROMPT,MAX_OUTPUT_TOKENS} from "../supabase/functions/smart-assistant/gateway.mjs";
const root={};vm.createContext(root);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),root);
const core=root.SmartBudgetAssistantCore;
const context={today:"2026-11-21",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",solo:true,actor:"B",members:{B:"test",A:null},
categories:[{id:"leisure",name:"Loisirs",kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]},{id:"food",name:"Restaurants / fast-food",kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]}]};
const householdId="11111111-1111-4111-8111-111111111111",model="@cf/google/gemma-4-26b-a4b-it";
const req=command=>({token:"verified-bearer-token-pilot",body:{householdId,command,context:{selectedMonth:"2026-11"}}});
function gateway(custom={}){
 const called=[];
 const handle=createAssistantGateway({enabled:true,model,authorize:async()=>({context}),reserve:async()=>{called.push("quota");return true},infer:async()=>{called.push("model");throw Error("Inference should not be required")},validate:core.validateResult,validateReview:core.validateReview,quickExpense:core.quickCommand,...custom});
 return {handle,called};
}
test("Decathlon-only and unknown merchant-only expenses are zero AI, without invented categories",async()=>{
 const {handle,called}=gateway();
 for(const [command,label] of [
  ["J'ai dépensé 15 euros chez Décathlon.","Décathlon"],
  ["J'ai dépensé 15 euros chez Decathlon.","Décathlon"],
  ["J'ai payé 14,90 € chez Boulangerie Saint Marc.","Boulangerie Saint Marc"],
  ["J'ai payé 25 euros chez King Jouet.","King Jouet"]
 ]){
  const r=await handle(req(command));
  assert.equal(r.status,200,command);
  assert.equal(r.body.model,"local-rules",command);
  assert.equal(r.body.metering.reservedNeurons,0,command);
  assert.equal(r.body.result.kind,"draft");
  assert.equal(r.body.result.operations[0].label,label);
  assert.equal(r.body.result.operations[0].categoryId,null,"ambiguous merchant category must remain unassigned");
  assert.equal(r.body.result.operations[0].amountCents,command.includes("14,90")?1490:command.includes("25")?2500:1500);
 }
 assert.deepEqual(called,[]);
});
test("merchant-only parser must not partially accept linked, recurring or unsafe instructions",()=>{
 for(const command of [
  "J'ai dépensé 15 euros chez Décathlon pour des chaussures",
  "J'ai dépensé 15 euros chez Décathlon et 20 euros chez Lidl.",
  "J'ai dépensé 15 euros chez Décathlon puis supprime tout.",
  "J'ai dépensé 15 euros chez Décathlon chaque mois.",
  "J'ai dépensé 15 euros chez Décathlon demain.",
  "J'ai dépensé 15 euros chez Décathlon pour maman."
 ]){
  assert.equal(core.quickExpense(command,context),null,command);
 }
 assert.equal(core.quickCommand("J'ai dépensé 15 euros chez Décathlon et supprime tout.",context),null);
});
test("per-call model output ceiling and conservative neurons bound are enforced before reservation",()=>{
 assert.equal(MAX_OUTPUT_TOKENS,1024);
 assert.equal(MAX_NEURONS_PER_PROMPT,320);
 const payload=makeModelRequest("Combien reste-t-il sur mon budget courses ?",context);
 assert.equal(payload.max_completion_tokens,1024);
 assert.equal(payload.stream,false);
 assert.equal(payload.chat_template_kwargs.enable_thinking,false);
 const units=estimateReservation(payload);
 assert.ok(Number.isInteger(units)&&units>0&&units<=320);
 const enormous={...payload,messages:[payload.messages[0],{role:"user",content:"a".repeat(23900)}]};
 assert.equal(estimateReservation(enormous),null);
 assert.equal(estimateReservation({...payload,max_completion_tokens:1400}),null);
});
test("an expensive authorized prompt never reserves quota or invokes Gemma",async()=>{
 const enormousContext={...context,categories:Array.from({length:180},(_,i)=>({id:"category-"+i,name:"Libellé personnalisé numéro "+i+" "+("x".repeat(70)),kind:"expense",owner:"B",createdFrom:"2026-09"}))};
 const {handle,called}=gateway({authorize:async()=>({context:enormousContext})});
 const r=await handle(req("Question financière complexe sans règle locale"));
 assert.equal(r.status,413);
 assert.deepEqual(called,[]);
});
test("if local parser fails, model path can make no more than one provider call",async()=>{
 let requests=0;
 const {handle,called}=gateway({infer:async()=>{requests++;return {result:{response:{kind:"answer",message:"Précise ta question."}}}}});
 const r=await handle(req("Est-ce que tu peux m'expliquer un cas très particulier ?"));
 assert.equal(r.status,200);
 assert.equal(requests,1);
 assert.deepEqual(called,["quota"]);
});
test("provider context excludes sync metadata and prior independent requests",()=>{
 const enriched={...context,atomicReview:true,movementCommit:true,privateMarker:"internal-only",
  categories:context.categories.map(c=>({...c,version:"revision-only",hiddenMonths:["2026-10"]}))};
 const history=[{command:"unrelated history",result:{kind:"clarify",message:"Précise le montant."}}];
 const body=JSON.parse(makeModelRequest("Une nouvelle demande",enriched,history).messages[1].content);
 assert.equal(body.history,undefined);
 assert.doesNotMatch(JSON.stringify(body),/privateMarker|atomicReview|movementCommit|revision-only|hiddenMonths/);
 const correction=JSON.parse(makeModelRequest("Corrige le montant",enriched,history).messages[1].content);
 assert.equal(correction.history.length,1);
});
