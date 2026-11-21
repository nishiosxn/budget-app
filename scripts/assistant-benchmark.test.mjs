import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {scenarios,sampleContext,matchesExpected} from "./assistant-benchmark-fixtures.mjs";
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
