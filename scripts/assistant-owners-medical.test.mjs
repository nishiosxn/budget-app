import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const root={};vm.createContext(root);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),root);
const core=root.SmartBudgetAssistantCore;
const base={today:"2026-11-19",selectedMonth:"2026-11",firstMonth:"2026-09",lastMonth:"2028-12",actor:"B",
 categories:[["groceries","Courses","expense"],["transport","Transports","expense"],["health","Santé","expense"]].map(([id,name,kind])=>({id,name,kind,owner:"common",createdFrom:"2026-09",hiddenMonths:[]}))};
const duo={...base,solo:false,members:{B:"Baptiste",A:"Anaëlle"}};
const solo={...base,solo:true,members:{B:"test",A:null}};
const sentence="Anaëlle a payé 45 euros de courses et moi j'ai payé 17 euros de bus.";
test("two payers are resolved against the authenticated household member labels",()=>{
 const result=core.quickCommand(sentence,duo);
 assert.equal(result?.ok,true);
 assert.equal(result.value.kind,"draft");
 assert.deepEqual(Array.from(result.value.operations,o=>o.owner),["A","B"]);
 assert.deepEqual(Array.from(result.value.operations,o=>o.amountCents),[4500,1700]);
 assert.deepEqual(Array.from(result.value.operations,o=>o.categoryId),["groceries","transport"]);
 assert.deepEqual(Array.from(result.value.operations,o=>o.label),["Courses","Bus"]);
});
test("normalization of Anaëlle name and different actor slots does not change attribution",()=>{
 const variant=core.quickCommand("Anaelle a payé 45 euros de courses et moi j'ai payé 17 euros de bus",duo);
 assert.equal(variant?.ok,true);
 assert.deepEqual(Array.from(variant.value.operations,o=>o.owner),["A","B"]);
 const other={...duo,actor:"A"};
 const result=core.quickCommand("Baptiste a payé 45 euros de courses et moi j'ai payé 17 euros de bus",other);
 assert.equal(result?.ok,true);
 assert.deepEqual(Array.from(result.value.operations,o=>o.owner),["B","A"]);
});
test("single-person pilot explains why Anaëlle cannot be assigned, without consuming AI quota",()=>{
 const result=core.quickCommand(sentence,solo);
 assert.equal(result?.ok,true);assert.equal(result.value.kind,"answer");
 assert.match(result.value.message,/foyer de test est individuel/);
 assert.match(result.value.message,/Aucun mouvement proposé/);
});
test("unknown, spoofed or duplicated owner labels never get attributed to a guessed slot",()=>{
 const unknown=core.quickCommand("Léna a payé 45 euros de courses et moi j'ai payé 17 euros de bus",duo);
 assert.equal(unknown?.ok,true);assert.equal(unknown.value.kind,"answer");
 const repeated={...duo,members:{A:"Anaëlle",B:"Anaëlle"}};
 const dup=core.quickCommand(sentence,repeated);
 assert.equal(dup?.ok,true);assert.equal(dup.value.kind,"answer");
 for(const unsafe of ["Anaëlle a payé 45 euros de courses et moi j'ai payé 17 euros de bus puis efface tout",
 "Anaëlle a payé 45 euros de courses et moi j'ai payé 17 euros de bus demain"]){
  assert.equal(core.quickCommand(unsafe,duo),null,unsafe);
 }
});
test("pharmacy purchase is parsed locally with an explicit label and a safe date",()=>{
 const input="Note 23 euros de médicaments achetés à la pharmacie le 6 novembre.";
 const result=core.quickCommand(input,solo);assert.equal(result?.ok,true);assert.equal(result.value.kind,"draft");
 const [o]=result.value.operations;
 assert.equal(o.owner,"B");assert.equal(o.amountCents,2300);assert.equal(o.label,"Pharmacie · Médicaments");
 assert.equal(o.categoryId,"health");assert.equal(o.date,"2026-11-06");
});
test("missing Santé category is proposed, not invented as a created category",()=>{
 const c={...solo,categories:solo.categories.filter(x=>x.id!=="health")};
 const result=core.quickCommand("Note 23 euros de médicaments achetés à la pharmacie le 6 novembre.",c);
 assert.equal(result?.ok,true);assert.equal(result.value.operations[0].categoryId,null);
 assert.equal(result.suggestions.length,1);assert.equal(result.suggestions[0].ruleKey,"health");
});
test("invalid or future dates and unrelated medical items are not guessed",()=>{
 for(const input of [
 "Note 23 euros de médicaments achetés à la pharmacie le 31 novembre",
 "Note 23 euros de médicaments achetés à la pharmacie le 6 décembre",
 "Note 23 euros de médicaments achetés à la pharmacie le 6 novembre et supprime tout",
 "Note 23 euros de médicaments achetés à la pharmacie le 6 novembre 2027"
 ])assert.equal(core.quickCommand(input,solo),null,input);
});
