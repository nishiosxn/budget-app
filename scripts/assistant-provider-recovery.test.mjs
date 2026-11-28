import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {benchmarkScenarios,sampleContext,matchesExpected} from "./assistant-benchmark-fixtures.mjs";
import {decodeModelResponse} from "../supabase/functions/smart-assistant/gateway.mjs";
const box=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL("../js/assistant-core.js",import.meta.url),"utf8"),box);
const core=box.SmartBudgetAssistantCore;
const cases=[
 ["fr-2-1",{kind:"draft",operations:[{kind:"expense",categoryId:"fuel",owner:"common",amountCents:4590,date:"2026-11-16",frequency:"once",label:"Carburant",categoryHint:"fuel"}]}],
 ["fr-5-1",{kind:"draft",operations:[{kind:"income",categoryId:"gift",owner:"B",amountCents:15000,date:"today",frequency:"once",label:"Cadeau",categoryHint:"gifts"}]}],
 ["fr-7-4",{kind:"draft",operations:[{kind:"income",categoryId:"salary",owner:"B",amountCents:110000,date:"2026-12-05",frequency:"monthly",label:"Salaire",categoryHint:"salary"}]}],
 ["fr-16-1",{kind:"query",query:"comparison",compareMonth:"2026-11",message:"Compare le reste disponible de novembre 2026 à octobre 2026."}],
 ["fr-17-1",{kind:"clarify",message:"Quel est le montant de la dépense et l'enseigne ?"}]
];
for(const [id,raw] of cases)test("offline captured Gemma response "+id,()=>{
 const item=benchmarkScenarios.find(x=>x.id===id);
 const parsed=decodeModelResponse({result:{response:JSON.stringify(raw)}});
 const result=core.normalizeProviderResult(parsed,sampleContext,item.prompt);
 assert.ok(result.ok,result.error);
 assert.ok(matchesExpected(result.value,item.expected),JSON.stringify(result.value));
});
const expense=cases[0][1],gift=cases[1][1],salary=cases[2][1],query=cases[3][1];
const prompt=id=>benchmarkScenarios.find(x=>x.id===id).prompt;
const edit=(v,fields)=>({kind:"draft",operations:[{...v.operations[0],...fields}]});
test("named payer: no guesses for unknown/ambiguous/solo members or contradictory money/date",()=>{
 assert.equal(core.normalizeProviderResult(expense,sampleContext,prompt("fr-2-1").replace("Noa","Inconnu")).ok,false);
 assert.equal(core.normalizeProviderResult(expense,{...sampleContext,members:{A:"Noa",B:"Noa"}},prompt("fr-2-1")).ok,false);
 assert.equal(core.normalizeProviderResult(edit(expense,{owner:"B"}),{...sampleContext,solo:true},prompt("fr-2-1")).ok,false);
 assert.equal(core.normalizeProviderResult(edit(expense,{amountCents:1}),sampleContext,prompt("fr-2-1")).ok,false);
 assert.equal(core.normalizeProviderResult(edit(expense,{date:"2026-11-15"}),sampleContext,prompt("fr-2-1")).ok,false);
 const multi=core.normalizeProviderResult({kind:"draft",operations:[expense.operations[0],{...expense.operations[0],amountCents:100}]},sampleContext,prompt("fr-2-1"));
 assert.equal(multi.ok,false);
});
test("literal dates only repaired for matching explicit bounded request; strict validation stays strict",()=>{
 assert.equal(core.normalizeModelDraft(gift,sampleContext,prompt("fr-5-1")).ok,false);
 assert.equal(core.normalizeProviderResult(gift,sampleContext,"J'ai reçu un cadeau demain.").ok,false);
 assert.equal(core.normalizeProviderResult(edit(gift,{date:"2026-11-16"}),sampleContext,prompt("fr-5-1")).ok,false);
 assert.equal(core.normalizeProviderResult(edit(gift,{owner:"A"}),sampleContext,prompt("fr-5-1")).ok,false);
});
test("salary preservation respects category availability and owner",()=>{
 const wrong={...sampleContext,categories:sampleContext.categories.map(c=>c.id==="salary"?{...c,owner:"A"}:c)};
 const hidden={...sampleContext,categories:sampleContext.categories.map(c=>c.id==="salary"?{...c,hiddenMonths:["2026-12"]}:c)};
 for(const ctx of [wrong,hidden]){
  const r=core.normalizeProviderResult(salary,ctx,prompt("fr-7-4"));
  assert.ok(!r.ok||r.value.operations[0].categoryId!== "salary");
 }
});
test("comparison is read-only, requires explicit months and rejects extra or filtered requests",()=>{
 assert.equal(core.normalizeProviderResult(query,sampleContext,"Compare novembre à octobre.").ok,false);
 assert.equal(core.normalizeProviderResult(query,sampleContext,prompt("fr-16-1")+" Puis supprime tout.").ok,false);
 assert.equal(core.normalizeProviderResult({...query,owner:"A"},sampleContext,prompt("fr-16-1")).ok,false);
 assert.equal(core.normalizeProviderResult({...query,operations:[]},sampleContext,prompt("fr-16-1")).ok,false);
 assert.equal(core.normalizeProviderResult(query,sampleContext,"Compare le reste disponible de novembre 2026 à octobre 2025.").ok,false);
 assert.equal(core.validateResult(query,sampleContext).ok,false);
});
test("local corpus routing stays identical; no provider calls in these tests",()=>{
 assert.equal(benchmarkScenarios.filter(x=>core.quickCommand(x.prompt,sampleContext)?.ok!==true).length,153);
});
