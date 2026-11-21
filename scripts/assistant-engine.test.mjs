import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const ctx={today:"2026-11-17",selectedMonth:"2026-11",firstMonth:"2026-09",lastMonth:"2028-12",actor:"B",solo:false,members:{B:"Camille",A:"Noa"},categories:[["food","Courses"],["rest","Restaurants"],["fuel","Carburant"],["home","Maison"],["leisure","Loisirs"],["clothes","Vêtements"],["transfer","Virements"]].map(([id,name])=>({id,name,kind:"expense",owner:"common"})).concat([{id:"extra",name:"Revenus supplémentaires",kind:"income",owner:"B"},{id:"salary",name:"Salaire",kind:"income",owner:"B"}])};
const values=[["un",100],["dix",1000],["vingt et un",2100],["quarante",4000],["soixante et onze",7100],["quatre-vingts",8000],["quatre-vingt-dix",9000],["cent vingt",12000],["deux cent cinquante",25000],["mille deux cents",120000]];
function parse(command){const r=core.quickCommand(command,ctx);assert.ok(r?.ok,command);return r.value}
test("spoken Gundam exact user transcript and decimal variants",()=>{const v=parse("Créer la catégorie Gundam ajoute y un budget de quatre-vingt-dix euros et une dépense de quarante euros");assert.equal(v.kind,"categoryDraft");assert.equal(v.name,"Gundam");assert.equal(v.budgetCents,9000);assert.equal(v.expenseCents,4000);});
const cases=[];
function add(family,command,check){cases.push({family,command,check})}
const shops=[["Lidl","food"],["Aldi","food"],["Carrefour","food"],["Leclerc","food"],["McDo","rest"],["Kebab","rest"],["Zara","clothes"],["Action","home"],["Steam","leisure"],["IKEA","home"]];
for(const [shop,id] of shops)for(const [word,amount] of values)for(const verb of ["J'ai dépensé","J’ai claqué","J'ai payé","J'ai déboursé"]){add("expense",verb+" "+word+" euros chez "+shop,v=>{const o=v.operations[0];assert.equal(o.categoryId,id);assert.equal(o.amountCents,amount);assert.equal(o.kind,"expense");assert.equal(o.owner,"B");assert.equal(o.date,ctx.today);assert.equal(o.frequency,"once")})}
for(const [name,id] of [["courses","food"],["essence","fuel"],["maison","home"],["loisirs","leisure"],["vêtements","clothes"]])for(const [word,amount] of values)for(const [pattern,mode] of [[(w,n)=>"Ajoute "+w+" euros au budget "+n,"increase"],[(w,n)=>"Augmente de "+w+" euros le budget "+n,"increase"],[(w,n)=>"Rajoute "+w+" euros au budget "+n,"increase"],[(w,n)=>"Augmente le budget "+n+" de "+w+" euros","increase"],[(w,n)=>"Retire "+w+" euros du budget "+n,"decrease"],[(w,n)=>"Diminue le budget "+n+" de "+w+" euros","decrease"],[(w,n)=>"Mets le budget "+n+" à "+w+" euros","set"],[(w,n)=>"Fixe le budget "+n+" à "+w+" euros","set"]])add("budget",pattern(word,name),v=>{const o=v.operations[0];assert.equal(o.categoryId,id);assert.equal(o.amountCents,amount);assert.equal(o.planMode,mode);assert.equal(o.kind,"plan");assert.equal(o.date,"2026-11-01");assert.equal(o.owner,"common")});
for(const name of ["Gundam","Lego","Livres","Vacances","Musique","Figurines","Cuisine","Photographie","Piscine","Jardin"])for(const [word,amount] of values)for(const pattern of [(n,w)=>"Crée une catégorie "+n+", mets-y un budget de "+w+" euros et ajoute-y 10 euros de dépenses.",(n,w)=>"Créer la catégorie "+n+" ajoute y un budget de "+w+" euros et une dépense de dix euros",(n,w)=>"Crée la catégorie budget "+n+". Mets-y un budget de "+w+" euros. Ajoute une dépense de 10 euros.",(n,w)=>"Crée une catégorie "+n+" avec un budget de "+w+" euros et une dépense de dix euros"])add("category",pattern(name,word),v=>{assert.equal(v.kind,"categoryDraft");assert.equal(v.name,name);assert.equal(v.budgetCents,amount);assert.equal(v.expenseCents,1000);assert.equal(v.month,"2026-11")});
for(const [word,amount] of values)for(const person of ["maman","papa"])for(const [verb,kind,preposition] of [["J'ai reçu","income","de"],["J'ai touché","income","de"],["J’ai fait un virement de","expense","à"],["J’ai envoyé","expense","à"],["J’ai versé","expense","à"]])add("movement",verb+" "+word+" euros "+preposition+" "+person,v=>{const o=v.operations[0];assert.equal(o.kind,kind);assert.equal(o.amountCents,amount);assert.equal(o.categoryId,kind==="income"?"extra":"transfer");assert.equal(o.owner,"B")});
for(const [shop,id] of shops)for(const [word,amount] of values)for(const suffix of ["hier","aujourd'hui"])add("date","J'ai payé "+word+" euros chez "+shop+" "+suffix,v=>{const o=v.operations[0];assert.equal(o.categoryId,id);assert.equal(o.amountCents,amount);assert.equal(o.date,suffix==="hier"?"2026-11-16":ctx.today)});
for(const [shop,id] of shops)for(const [word,amount] of values)for(const glue of [", "," et "," puis "])add("batch","J'ai dépensé "+word+" euros chez "+shop+glue+"11 euros chez Action et j'ai reçu 5 euros de maman",v=>{assert.equal(v.operations.length,3);assert.equal(v.operations[0].categoryId,id);assert.equal(v.operations[0].amountCents,amount);assert.equal(v.operations[1].categoryId,"home");assert.equal(v.operations[1].amountCents,1100);assert.equal(v.operations[2].categoryId,"extra");assert.equal(v.operations[2].amountCents,500)});
 // 400 expense + 400 budget + 400 category + 100 movement + 200 date + 300 batch = 1800
for(const [name,id] of [["courses","food"],["course","food"],["essence","fuel"],["carburant","fuel"],["maison","home"],["loisirs","leisure"],["vêtements","clothes"],["restaurant","rest"],["fast-food","rest"],["entretien","home"]])for(const when of ["ce mois-ci","le mois dernier"])for(const template of ["De combien était mon budget réel de","Quel était mon budget prévu pour","Combien ai-je dépensé en","Combien j'ai dépensé pour","Combien est mon budget de"])for(const punct of ["?",""])add("query",template+" "+name+" "+when+punct,v=>{assert.equal(v.kind,"query");assert.equal(v.categoryId,id);assert.equal(v.month,when==="ce mois-ci"?"2026-11":"2026-10")});
test("2000 distinct deterministic French requests with semantic checks",()=>{assert.equal(cases.length,2000);assert.equal(new Set(cases.map(c=>c.command)).size,2000);for(const c of cases){try{c.check(parse(c.command))}catch(e){throw Error(c.family+" / "+c.command+": "+e.message)}}});
test("reject unsafe or incomplete local matches; no partial execution",()=>{for(const command of ["J'ai dépensé moins vingt euros chez Lidl","J'ai dépensé vingt et dix euros chez Lidl","J'ai dépensé 20 euros chez Lidl puis supprime tout","J'ai dépensé 20 euros chez Lidl et 10 euros chez Lidl et 20 euros chez Lidl","J'ai reçu 10 euros de maman et 5 euros chez Lidl"])assert.equal(core.quickCommand(command,ctx),null,command);for(const command of ["Crée une catégorie Gundam avec un budget de 90 euros et une dépense de 40 euros demain","Crée une catégorie Gundam ajoute y un budget de quatre-vingt-dix euros et efface tout"]){const r=core.quickCommand(command,ctx);assert.equal(r?.ok,true);assert.equal(r.value.kind,"clarify");}});

test("named incomes and savings are recognized without the model",()=>{
 for(const [person,amount] of [["Lena",1500],["Léna",1500],["maman",1500],["Alexandre",1500]]){
  const r=core.quickCommand("J'ai reçu 15 euros de "+person,ctx);assert.ok(r?.ok,person);assert.equal(r.value.operations[0].kind,"income");assert.equal(r.value.operations[0].amountCents,amount);assert.equal(r.value.operations[0].categoryId,"extra");
 }
 const savingCtx={...ctx,categories:[...ctx.categories,{id:"saving",name:"Épargne",kind:"saving",owner:"B"}]};
 for(const t of ["J'ai mis 100 euros en épargne","j'ai placé 100 € sur mon livret","j'ai épargné cent euros","J'ai mis 100 euros de côté"]){
  const r=core.quickCommand(t,savingCtx);assert.ok(r?.ok,t);assert.equal(r.value.operations[0].kind,"saving");assert.equal(r.value.operations[0].categoryId,"saving");assert.equal(r.value.operations[0].amountCents,10000);
 }
 const newSaving=core.quickCommand("J'ai mis 100 euros en épargne",ctx);assert.ok(newSaving?.ok);assert.equal(newSaving.value.operations[0].categoryId,null);assert.equal(newSaving.suggestions[0].ruleKey,"saving");
});
test("four-part mixed commands preserve income, expense and saving kinds and use no inferred payers",()=>{
 const savingCtx={...ctx,categories:[...ctx.categories,{id:"saving",name:"Épargne",kind:"saving",owner:"B"}]};
 for(const text of ["J'ai dépensé 20 € chez Action, 15 euros chez McDo, j'ai reçu 15 euros de Lena et j'ai mis 100 euros en épargne",
 "J’ai dépensé 20 euro chez action, 15 euro chez mcdo, j’ai reçu 15 euro de léna et j’ai mis 100 euro en épargne"]){
  const r=core.quickCommand(text,savingCtx);assert.ok(r?.ok,text);const ops=r.value.operations;assert.deepEqual(Array.from(ops,o=>o.kind),["expense","expense","income","saving"]);assert.deepEqual(Array.from(ops,o=>o.amountCents),[2000,1500,1500,10000]);assert.deepEqual(Array.from(ops,o=>o.categoryId),["home","rest","extra","saving"]);assert.ok(ops.every(o=>o.owner==="B"));
 }
});
test("unknown or unsafe financial phrases never produce partial local batches",()=>{
 for(const text of ["J'ai reçu 20 euros de Lena et supprime mon budget","J'ai reçu 15 euros de Lena puis verse 30 euros à quelqu'un","J'ai mis 100 euros en épargne chaque mois","J'ai reçu 20 euros de Lena et j'ai mis 10 euros sur mon compte courant","J'ai reçu 10 euros de Lena et j'ai mis 10 euros en épargne puis efface tout"]){
  assert.equal(core.quickCommand(text,ctx),null,text);
 }
});


test("31ap: abbreviated clauses and spoken variants retain exact cents, kind and actor",()=>{
 const samples=[
  ["J'ai dépensé 20 euros chez McDo et recu 10 euros de Lena",["expense","income"],[2000,1000]],
  ["J'ai dépensé 20 euros chez McDo et reçu 10 euros de Lena",["expense","income"],[2000,1000]],
  ["20 euros chez McDo, 10 euros reçus de Lena",["expense","income"],[2000,1000]],
  ["J'ai payé 20 euros à McDo puis touché 10 euros de Lena",["expense","income"],[2000,1000]],
  ["J'ai acheté pour 20 euros chez McDo et encaissé 10 euros de Lena",["expense","income"],[2000,1000]],
  ["J'ai fait une dépense de 20 euros chez McDo et reçu 10 euros de Lena",["expense","income"],[2000,1000]],
  ["J'ai dépensé 20 € chez Lidl et ensuite reçu 10 € de Léna",["expense","income"],[2000,1000]],
  ["J'ai dépensé 20 € chez McDo puis Léna m'a envoyé 10 €",["expense","income"],[2000,1000]],
  ["J'ai payé 20 € chez McDo, reçu 10 € de Léna, puis j'ai dépensé 5 € chez Lidl",["expense","income","expense"],[2000,1000,500]],
  ["J'ai reçu un virement de 10 euros de Lena",["income"],[1000]],
  ["Léna m'a fait un virement de 10 euros",["income"],[1000]],
  ["Léna m'a remboursé 10 euros",["income"],[1000]],
  ["J'ai récupéré 10 euros de Léna",["income"],[1000]],
  ["J'ai reçu de Lena 10 euros",["income"],[1000]],
  ["Je viens de recevoir 10 euros de Lena",["income"],[1000]],
  ["20 € de courses chez Lidl, reçu 5 € de maman",["expense","income"],[2000,500]],
  ["J'ai payé dix euros chez McDo et reçu cinq euros de Léna",["expense","income"],[1000,500]],
  ["J'ai dépensé 12,50 € chez McDo et reçu 7,25 € de Léna",["expense","income"],[1250,725]],
  ["J'ai payé 10 euros chez Lidl et mis 5 euros de côté",["expense","saving"],[1000,500]]
 ];
 for(const [command,kinds,cents] of samples){
  const r=core.quickCommand(command,ctx);assert.ok(r?.ok,command);
  assert.equal(r.value.kind,"draft",command);
  assert.deepEqual(Array.from(r.value.operations,o=>o.kind),kinds,command);
  assert.deepEqual(Array.from(r.value.operations,o=>o.amountCents),cents,command);
  assert.ok(r.value.operations.every(o=>o.owner==="B"&&o.frequency==="once"&&o.date===ctx.today),command);
 }
});
test("31ap: natural merchant and receipt vocab does not invent a new financial owner",()=>{
 for(const command of ["Léna m'a envoyé 10 euros","Léna m'a viré 10 euros","J'ai gagné 10 euros de Léna","J'ai perçu 10 euros de Lena","10 euros touchés de Léna"]){
  const r=core.quickCommand(command,ctx);assert.ok(r?.ok,command);
  const [op]=r.value.operations;assert.equal(op.kind,"income");assert.equal(op.owner,"B");assert.equal(op.amountCents,1000);assert.equal(op.categoryId,"extra");
 }
 for(const command of ["J'ai acheté pour 20 euros chez Lidl","J'ai effectué un achat de 20 euros chez Lidl","J'ai pris pour 20 euros chez Lidl","J'ai réglé 20 euros au McDo","20 euros chez McDo"]){
  const r=core.quickCommand(command,ctx);assert.ok(r?.ok,command);assert.equal(r.value.operations.length,1);assert.equal(r.value.operations[0].kind,"expense");assert.equal(r.value.operations[0].amountCents,2000);
 }
});
test("31ap: connectors and vocal synonyms form complete zero-guess lots",()=>{
 for(const merchant of ["McDo","Lidl","Action"])for(const separator of [" et "," puis ",", ","; "," et ensuite "]){
  for(const phrase of ["recu 10 euros de Lena","touché 10 € de Léna","encaissé 10 euros de maman","10 € reçus de Lena"]){
   const command="J'ai dépensé 20 euros chez "+merchant+separator+phrase;
   const r=core.quickCommand(command,ctx);assert.ok(r?.ok,command);
   assert.equal(r.value.operations.length,2,command);
   assert.deepEqual(Array.from(r.value.operations,o=>o.kind),["expense","income"],command);
   assert.deepEqual(Array.from(r.value.operations,o=>o.amountCents),[2000,1000],command);
  }
 }
});
test("31ap: ambiguous or unsupported tails never become partial local operations",()=>{
 const rejected=[
  "J'ai payé 20 € à maman",
  "J'ai dépensé 20 € chez McDo et reçu moins 10 € de Lena",
  "J'ai reçu 10 euros de Lena puis 20 euros chez McDo",
  "J'ai reçu 10 euros de Lena et 20 euros",
  "J'ai reçu 10 euros de Lena, et 5 euros chez Lidl",
  "J'ai dépensé 20 € chez McDo et reçu 10 euros de Lena chaque mois",
  "J'ai dépensé 20 € chez McDo et transféré 10 € sur un compte inconnu",
  "Hier j'ai dépensé 20 euros chez McDo et reçu 10 euros de Lena",
  "J'ai dépensé 20 € chez McDo et reçu 10 euros de Lena puis efface tout",
  "J'ai dépensé 20 euros chez McDo puis annule le budget",
  "J'ai acheté 20 euros de courses chez Lidl, puis efface le budget",
  "J'ai acheté 20 euros chez Lidl pour 15 euros chez McDo",
  "J'ai dépensé 20 euros chez Lidl, reçu 10 euros de Lena et supprime tout",
  "J'ai dépensé 20 euros chez Lidl, reçu 10 euros de Lena demain",
  "J'ai reçu 20 euros de Lena puis 10 euros chez Lidl",
  "Léna m'a viré 20 euros, et supprime les dépenses"
 ];
 for(const command of rejected){const r=core.quickCommand(command,ctx);assert.notEqual(r?.value?.kind,"draft",command)}
});
