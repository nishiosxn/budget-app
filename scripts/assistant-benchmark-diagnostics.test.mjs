import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {benchmarkScenarios,sampleContext} from "./assistant-benchmark-fixtures.mjs";
import {diagnoseResponse,fieldDifferences,diagnosticSelection,attemptEligible,diagnosticRetestTag,authRecoveryTag,authRecoveryAllowed} from "./assistant-benchmark-diagnostics.mjs";
const box=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL("../js/assistant-core.js",import.meta.url),"utf8"),box);
const core=box.SmartBudgetAssistantCore;
const item=benchmarkScenarios.find(x=>x.id==="fr-2-1");
const expected=item.expected.operations[0];
const draft=op=>({kind:"draft",operations:[{label:"Carburant",...op}]});
test("diagnoses named payer and relative date without guessing provider output",()=>{
 const raw=draft({...expected,owner:"B",date:"2026-11-17"});
 const checked=core.normalizeModelDraft(raw,sampleContext,item.prompt);
 const d=diagnoseResponse(item,raw,checked);
 assert.equal(d.correct,false);
 assert.equal(d.normalizationAccepted,true);
 assert.deepEqual(d.normalizedDifferences.map(x=>x.path),["operations[0].owner","operations[0].date"]);
 assert.equal(d.normalizationDifferences.length,0);
});
test("distinguishes model category error from normalization repair",()=>{
 const raw=draft({...expected,categoryId:"home"});
 const d=diagnoseResponse(item,raw,core.normalizeModelDraft(raw,sampleContext,item.prompt));
 assert.equal(d.correct,true);
 assert.equal(d.rawDifferences[0].path,"operations[0].categoryId");
 assert.equal(d.normalizedDifferences.length,0);
 assert.equal(d.normalizationDifferences[0].actual,"fuel");
});
test("reports validation failure and missing fields without exposing provider envelope",()=>{
 const raw=draft({...expected,owner:"unknown",extra:"not serialized"});
 const d=diagnoseResponse(item,raw,core.normalizeModelDraft(raw,sampleContext,item.prompt));
 assert.equal(d.normalizationAccepted,false);
 assert.equal(d.normalized,null);
 assert.equal(d.normalizedDifferences,null);
 assert.ok(d.validationError);
 assert.equal(Object.hasOwn(d.model.operations[0],"extra"),false);
 assert.equal(d.correct,false);
});
test("reports missing query fields and ignores order for exact multiaction matches",()=>{
 const q={kind:"query",query:"summary",month:"2026-11",compareMonth:null,categoryId:null,owner:null};
 assert.deepEqual(fieldDifferences(q,{...q,owner:undefined}).map(x=>x.path),["owner"]);
 const ops=[expected,{...expected,amountCents:100,date:"2026-11-17"}];
 assert.deepEqual(fieldDifferences({kind:"draft",operations:ops},{kind:"draft",operations:[...ops].reverse()}),[]);
});
test("diagnostic lot is five fallback intents, one bounded replay, original ledger retained",()=>{
 const fallback=benchmarkScenarios.filter(x=>core.quickCommand(x.prompt,sampleContext)?.ok!==true);
 const selection=diagnosticSelection(fallback);
 assert.deepEqual(selection.map(x=>x.expected.kind),["draft","draft","draft","query","clarify"]);
 assert.equal(new Set(selection.map(x=>x.id.split("-").slice(0,2).join("-"))).size,5);
 const journal=[{corpusHash:"same",id:"fr-2-1"}];
 assert.equal(attemptEligible(journal,"same","fr-2-1"),false);
 assert.equal(attemptEligible([],"same","fr-2-1",true),false);
 assert.equal(attemptEligible(journal,"same","fr-2-1",true),true);
 assert.equal(attemptEligible([...journal,{corpusHash:"same",id:"fr-2-1",retest:diagnosticRetestTag}],"same","fr-2-1",true),false);
 assert.equal(attemptEligible(journal,"same","fr-5-1",true),true);
});
test("audit: euro symbol contextual hint and explicit named payer lookup",()=>{
 assert.equal(core.ownerSlotForName("Noa",sampleContext),"A");
 assert.equal(core.ownerSlotForName("Inconnu",sampleContext),null);
 assert.equal(core.ownerSlotForName("Noa",{...sampleContext,solo:true}),null);
 assert.equal(core.contextualCategoryHint("Noa a dépensé 45,90 € de carburant hier.",{kind:"expense"}),null);
 assert.equal(core.contextualCategoryHint("Noa a dépensé 45,90 euros de carburant hier.",{kind:"expense"}),"fuel");
});

test("401 recovery needs matching one-attempt report and reserves at most once",()=>{
 const model="@cf/google/gemma-4-26b-a4b-it",corpusHash="same",id="fr-2-1",day="2026-11-28";
 const first={corpusHash,id,day,reservedNeurons:123};
 const retest={...first,retest:diagnosticRetestTag};
 const journal=[first,retest];
 const report={model,corpusHash,mode:"diagnostic-lot",utcDay:day,attempted:1,passed:0,reportedTokens:{samples:0},attempts:[{id,retest:diagnosticRetestTag,httpStatus:401,outcome:"provider_http_error",reservedNeurons:123}]};
 assert.equal(authRecoveryAllowed(journal,corpusHash,report,model),true);
 assert.equal(authRecoveryAllowed([first],corpusHash,report,model),false);
 assert.equal(authRecoveryAllowed(journal,corpusHash,{...report,utcDay:"2026-11-27"},model),false);
 assert.equal(authRecoveryAllowed(journal,corpusHash,{...report,attempts:[{...report.attempts[0],httpStatus:200}]},model),false);
 assert.equal(authRecoveryAllowed(journal,corpusHash,{...report,attempts:[{...report.attempts[0],httpStatus:429}]},model),false);
 assert.equal(authRecoveryAllowed(journal,corpusHash,{...report,reportedTokens:{samples:1}},model),false);
 assert.equal(attemptEligible(journal,corpusHash,id,true,false),false);
 assert.equal(attemptEligible(journal,corpusHash,id,true,true),true);
 const recovered=[...journal,{...first,retest:authRecoveryTag}];
 assert.equal(authRecoveryAllowed(recovered,corpusHash,report,model),false);
 assert.equal(attemptEligible(recovered,corpusHash,id,true,true),false);
 assert.equal(attemptEligible(recovered,corpusHash,id,false),false);
 assert.equal(attemptEligible(recovered,corpusHash,"fr-5-1",true,true),true);
});
