import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const categories=[
 ["courses","Courses"],["fast","Restaurants / fast-food"],["leisure","Loisirs"],["home","Maison / entretien"],
 ["clothing","Vêtements"],["gifts","Cadeaux"],["fuel","Carburant"]
].map(([id,name])=>({id,name,kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]}));
const ctx={today:"2026-11-19",selectedMonth:"2026-11",firstMonth:"2026-09",lastMonth:"2028-12",actor:"B",solo:true,members:{B:"test"},categories};
function op(s,c=ctx){const r=core.quickCommand(s,c);assert.ok(r?.ok,s);assert.equal(r.value.kind,"draft");assert.equal(r.value.operations.length,1);return r.value.operations[0]}
test("no invented purchase description for simple McDo or Lidl",()=>{
 for(const [s,label] of [
  ["J'ai dépensé 10 euros chez McDo","McDonald's"],
  ["J'ai dépensé 20 euros chez Lidl","Lidl"]
 ]){const x=op(s);assert.equal(x.label,label);assert.equal(core.expenseLabelParts(x.label).detail,null)}
});
test("course descriptions use only the explicitly spoken period",()=>{
 for(const [s,label] of [
  ["J'ai fait 80 euros de courses du mois chez Leclerc","Leclerc · Courses du mois"],
  ["J'ai dépensé 45 euros de courses de la semaine chez Lidl","Lidl · Courses de la semaine"],
  ["J'ai dépensé 30 euros chez Carrefour pour les courses de la semaine","Carrefour · Courses de la semaine"],
  ["J'ai fait 28 euros de courses chez Lidl","Lidl · Courses"]
 ]){const x=op(s);assert.equal(x.label,label);assert.equal(x.categoryId,"courses")}
});
test("shop and described items are preserved, category comes from purchase",()=>{
 for(const [s,label,category,amount] of [
  ["J'ai acheté des chaussures d'escalade chez Décathlon pour 79 euros","Décathlon · Chaussures d'escalade","leisure",7900],
  ["J'ai acheté des chaussures d'escalade pour 79 euros chez Décathlon","Décathlon · Chaussures d'escalade","leisure",7900],
  ["J'ai acheté un LEGO à 39,99 euros chez King Jouet","King Jouet · LEGO","leisure",3999],
  ["J'ai payé 19 euros chez Carrefour pour un cadeau d'anniversaire","Carrefour · Cadeau d'anniversaire","gifts",1900],
  ["J'ai fait 12 euros de produits ménagers chez Action","Action · Produits ménagers","home",1200],
  ["J'ai mis 30 euros d'essence à Total","Total · Essence","fuel",3000]
 ]){const x=op(s);assert.equal(x.label,label,s);assert.equal(x.categoryId,category,s);assert.equal(x.amountCents,amount,s)}
});
test("single complete clauses in a batch retain different labels",()=>{
 const r=core.quickCommand("J'ai fait 28 euros de courses chez Lidl et acheté 12 euros de produits ménagers chez Action",ctx);
 assert.ok(r?.ok);assert.deepEqual(Array.from(r.value.operations,x=>x.label),["Lidl · Courses","Action · Produits ménagers"]);
});
test("when a product category is absent, propose it without manufacturing an ID",()=>{
 const c={...ctx,categories:categories.filter(x=>x.id!=="leisure")};
 const r=core.quickCommand("J'ai acheté des chaussures d'escalade chez Décathlon pour 79 euros",c);
 assert.ok(r?.ok);assert.equal(r.value.operations[0].categoryId,null);assert.equal(r.suggestions[0].ruleKey,"leisure");
});
test("unsafe or incomplete purchase descriptions fail local parsing",()=>{
 for(const s of [
  "J'ai acheté des chaussures d'escalade chez Décathlon pour 79 euros puis supprime tout",
  "J'ai fait 45 euros de courses de la semaine chez Lidl demain",
  "J'ai payé 20 euros chez Carrefour pour un cadeau et supprime toutes les dépenses"
 ])assert.equal(core.quickCommand(s,ctx),null,s);
});

test("two explicitly specified purchases remain a valid two-operation batch",()=>{
 const r=core.quickCommand("J'ai acheté des chaussures d'escalade chez Décathlon pour 79 euros et j'ai payé 20 euros chez Zara",ctx);
 assert.ok(r?.ok);
 assert.deepEqual(Array.from(r.value.operations,o=>o.amountCents),[7900,2000]);
 assert.deepEqual(Array.from(r.value.operations,o=>o.label),["Décathlon · Chaussures d'escalade","Zara"]);
});
