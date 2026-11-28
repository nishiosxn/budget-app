import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const box={};vm.createContext(box);
vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const categories=[
 ["courses","Courses","expense"],
 ["rest","Restaurants / fast-food","expense"],
 ["home","Maison / entretien","expense"],
 ["leisure","Loisirs","expense"],
 ["fuel","Carburant","expense"],
 ["savings","Épargne","saving"],
 ["extra","Revenus supplémentaires","income"]
].map(([id,name,kind])=>({id,name,kind,owner:"B",createdFrom:"2026-09",hiddenMonths:[]}));
const ctx={today:"2026-11-19",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",solo:true,actor:"B",members:{B:"test"},categories};
function interpret(command,c=ctx){const x=core.quickCommand(command,c);assert.ok(x?.ok,command);return x.value}
test("screenshot 1: fuel at Total yesterday uses Carburant with correct date and zero AI",()=>{
 const v=interpret("Hier, j'ai mis 30 euros d'essence à Total.");
 assert.equal(v.kind,"draft");assert.equal(v.operations.length,1);
 const [o]=v.operations;assert.equal(o.kind,"expense");assert.equal(o.label,"Total · Essence");assert.equal(o.amountCents,3000);assert.equal(o.date,"2026-11-18");assert.equal(o.categoryId,"fuel");
});
test("screenshot 2: LEGO at King Jouet classifies as Loisirs",()=>{
 const [o]=interpret("J'ai acheté un LEGO à 39,99 euros chez King Jouet.").operations;
 assert.equal(o.amountCents,3999);assert.equal(o.label,"King Jouet · LEGO");assert.equal(o.categoryId,"leisure");
});
test("screenshot 3: groceries and cleaning products parse as two separate expenses",()=>{
 const v=interpret("J'ai fait 28 euros de courses chez Lidl et acheté 12 euros de produits ménagers chez Action.");
 assert.deepEqual(Array.from(v.operations,o=>o.amountCents),[2800,1200]);
 assert.deepEqual(Array.from(v.operations,o=>o.categoryId),["courses","home"]);
 assert.deepEqual(Array.from(v.operations,o=>o.kind),["expense","expense"]);
});
test("screenshot 4: father income followed by linked savings stays in distinct categories",()=>{
 const v=interpret("J'ai reçu 75 euros de mon père, mets-en 25 de côté.");
 assert.deepEqual(Array.from(v.operations,o=>o.kind),["income","saving"]);
 assert.deepEqual(Array.from(v.operations,o=>o.amountCents),[7500,2500]);
 assert.deepEqual(Array.from(v.operations,o=>o.categoryId),["extra","savings"]);
 assert.deepEqual(Array.from(v.operations,o=>o.owner),["B","B"]);
});
test("screenshot 5: real bank balance has no fabricated numerical result",()=>{
 const v=interpret("Combien d'argent ai-je réellement sur mon compte bancaire actuellement ?");
 assert.equal(v.kind,"answer");assert.match(v.message,/ne peux pas consulter ton solde bancaire réel/);
});
test("screenshot 6: checking to own Livret A is savings, not consumer expense",()=>{
 const [o]=interpret("J'ai transféré 200 euros de mon compte courant vers mon livret A.").operations;
 assert.equal(o.kind,"saving");assert.equal(o.categoryId,"savings");assert.equal(o.amountCents,20000);
 assert.match(o.label,/Transfert interne vers Livret A/);
});
test("missing categories suggest canonical family, but never a merchant category",()=>{
 for(const [command,key] of [
  ["Hier, j'ai mis 30 euros d'essence à Total.","fuel"],
  ["J'ai acheté un LEGO à 39,99 euros chez King Jouet.","leisure"],
  ["J'ai reçu 75 euros de mon père, mets-en 25 de côté.","saving"],
  ["J'ai transféré 200 euros de mon compte courant vers mon livret A.","saving"]
 ]){const c={...ctx,categories:categories.filter(x=>!["fuel","leisure","savings"].includes(x.id))};const x=core.quickCommand(command,c);assert.ok(x?.ok,command);
  const matched=x.suggestions||[];assert.ok(matched.some(s=>s.ruleKey===key),command);
  assert.ok(x.value.operations.every(o=>o.categoryId===null||c.categories.some(z=>z.id===o.categoryId)));
 }
});
test("single model result can infer a missing category from a clearly named product",()=>{
 const c={...ctx,categories:categories.filter(x=>x.id!=="fuel")};
 const raw={kind:"draft",operations:[{kind:"expense",categoryId:null,owner:"B",amountCents:3000,date:"2026-11-18",label:"Total",frequency:"once"}]};
 const x=core.normalizeModelDraft(raw,c,"Hier, j'ai mis 30 euros d'essence à Total");
 assert.equal(x.ok,true);assert.equal(x.suggestions[0].ruleKey,"fuel");
 assert.equal(core.contextualCategoryHint("20 euros chez Action et 10 euros chez Lidl",raw.operations[0]),null);
});
test("unsafe, ambiguous or partial strings never produce a local financial batch",()=>{
 const unsafe=[
  "Hier, j'ai mis 30 euros d'essence à Total et supprime mon compte.",
  "J'ai acheté un LEGO à 39,99 euros chez King Jouet puis efface tout",
  "J'ai reçu 75 euros de mon père, mets-en 90 de côté.",
  "J'ai reçu 75 euros de mon père, mets-en 25 de côté et vire 100 à un inconnu.",
  "J'ai transféré 200 euros de mon compte courant vers le compte de Paul.",
  "J'ai fait 28 euros de courses chez Lidl et acheté un ordinateur",
  "J'ai mis 30 euros d'essence à Total demain"
 ];
 for(const query of unsafe)assert.equal(core.quickCommand(query,ctx),null,query);
});
