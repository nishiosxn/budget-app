import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {scenarios,benchmarkScenarios,sampleContext,matchesExpected} from "./assistant-benchmark-fixtures.mjs";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
test("200 distinct synthetic French scenarios and contract-compatible expected outcomes",()=>{
 assert.equal(scenarios.length,200);assert.equal(new Set(scenarios.map(x=>x.id)).size,200);
 for(const item of scenarios){
  const answer=item.expected.kind==="draft"?{kind:"draft",operations:item.expected.operations.map(o=>({...o,label:"Exemple"}))}:item.expected.kind==="clarify"?{kind:"clarify",message:"Précise la demande."}:item.expected;
  assert.equal(core.validateResult(answer,sampleContext).ok,true,item.id);
  assert.equal(matchesExpected(answer,item.expected),true,item.id);
 }
});
test("checks exact amounts, owners and recurrence, not just JSON shape",()=>{
 const seed=scenarios[0].expected,op=seed.operations[0];assert.equal(matchesExpected({kind:"draft",operations:[{...op,amountCents:2001}]},seed),false);assert.equal(matchesExpected({kind:"draft",operations:[{...op,owner:"A"}]},seed),false);assert.equal(matchesExpected({kind:"draft",operations:[{...op,frequency:"monthly"}]},seed),false);
});
test("annotated local regression cases match labels, amounts, dates, payers and plan modes",()=>{
 for(const item of benchmarkScenarios.slice(scenarios.length)){
  const proposal=core.quickCommand(item.prompt,sampleContext);
  assert.equal(matchesExpected(proposal?.value,item.expected),true,item.id);
 }
 const expected=benchmarkScenarios.find(s=>s.id==="reg-previous").expected;
 assert.equal(matchesExpected({kind:"draft",operations:[{...expected.operations[0],planMode:"decrease"}]},expected),false);
});
test("named monthly starts are calendar-checked without guessing a missing year",()=>{
 const parse=text=>core.quickCommand(text,sampleContext)?.value;
 const valid=parse("Ajoute mon abonnement Netflix de 13,49 € chaque mois à partir du 10 décembre 2026.");
 assert.equal(valid.operations[0].date,"2026-12-10");
 assert.equal(valid.operations[0].frequency,"monthly");
 assert.equal(parse("Ajoute mon abonnement Netflix de 13,49 € chaque mois à partir du 31 février 2027.")?.kind,undefined);
 assert.equal(parse("Ajoute mon abonnement Netflix de 13,49 € chaque mois à partir du 10 décembre.")?.kind,undefined);
});
