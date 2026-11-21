import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const ctx={today:"2026-11-17",firstMonth:"2026-09",lastMonth:"2028-09",solo:false,categories:[{id:"food",kind:"expense",owner:"common",createdFrom:"2026-09",hiddenMonths:["2026-10"]},{id:"salary",kind:"income",owner:"B",createdFrom:"2026-09"},{id:"save",kind:"saving",owner:"B",createdFrom:"2026-09"}]};
const op={kind:"expense",categoryId:"food",owner:"B",amountCents:2000,date:"2026-11-17",label:"Commerce test",frequency:"once"};
const check=(...operations)=>core.validateResult({kind:"draft",operations},ctx);
test("single and mixed proposals",()=>{assert.equal(check(op).ok,true);assert.equal(check(op,{...op,kind:"income",categoryId:"salary",amountCents:100000,frequency:"monthly"}).ok,true)});
test("planned budget semantics",()=>{assert.equal(check({...op,kind:"plan",owner:"common",frequency:"monthly",amountCents:0}).ok,true);assert.equal(check({...op,kind:"plan",owner:"A"}).ok,false)});
test("categories and types",()=>{assert.equal(check({...op,categoryId:"invented"}).ok,false);assert.equal(check({...op,date:"2026-10-01"}).ok,false);assert.equal(check({...op,kind:"income"}).ok,false)});
test("bad dates and money",()=>{for(const date of ["2026-02-30","2026-13-01","2026-11-18","2026-9-01",null])assert.equal(check({...op,date}).ok,false);for(const amountCents of [-1,0,1.2,"100",Infinity,100000001])assert.equal(check({...op,amountCents}).ok,false)});
test("unknown actions, fields and excessive batches",()=>{assert.equal(core.validateResult({kind:"delete_all"},ctx).ok,false);assert.equal(check({...op,householdId:"other"}).ok,false);assert.equal(check(...Array(13).fill(op)).ok,false);assert.equal(check().ok,false)});
test("duplicate draft and existing detection",()=>{assert.equal(check(op,op).ok,false);assert.equal(core.findDuplicates([op],[op]).length,1);assert.equal(core.findDuplicates([op],[{...op,amountCents:100}]).length,0)});
test("recurring savings and solo",()=>{assert.equal(check({...op,kind:"saving",categoryId:"save",frequency:"monthly"}).ok,false);assert.equal(core.validateResult({kind:"draft",operations:[{...op,owner:"A"}]},{...ctx,solo:true}).ok,false)});
test("read query bounds",()=>{const q={kind:"query",query:"summary",month:"2026-11",compareMonth:null,categoryId:null,owner:null};assert.equal(core.validateResult(q,ctx).ok,true);assert.equal(core.validateResult({...q,query:"raw_sql"},ctx).ok,false);assert.equal(core.validateResult({...q,month:"1999-01"},ctx).ok,false);assert.equal(core.validateResult({...q,owner:"A"},ctx).ok,false)});
test("clarification and no writes in laboratory",()=>{assert.equal(core.validateResult({kind:"clarify",message:"Quelle catégorie ?"},ctx).ok,true);const ui=fs.readFileSync("js/assistant-ui.js","utf8");assert.doesNotMatch(ui,/saveState\s*\(|state\.transactions\.push\s*\(|\.rpc\s*\(/);assert.match(ui,/consent\.checked/);assert.match(ui,/identity\(\)!==who/);});

test("review allows unassigned categories without weakening write validator",()=>{const draft={kind:"draft",operations:[{...op,categoryId:null}]};assert.equal(core.validateReview(draft,ctx).ok,true);assert.equal(core.validateResult(draft,ctx).ok,false);assert.equal(core.validateReview({kind:"draft",operations:[{...op,categoryId:null,amountCents:-1}]},ctx).ok,false);});
test("relative planned amount is calculated in cents, never by the model",()=>{const plan={...op,kind:"plan",owner:"common",amountCents:1000,planMode:"increase"};assert.equal(core.validateReview({kind:"draft",operations:[plan]},ctx).ok,true);assert.equal(core.validateResult({kind:"draft",operations:[plan]},ctx).ok,false);assert.equal(core.resolvePlanAmount(plan,4500).afterCents,5500);assert.equal(core.resolvePlanAmount({...plan,planMode:"decrease"},500),null);});

test("default taxonomy matches merchants, preserves exact specific categories, proposes missing category",()=>{
 const c={...ctx,categories:[{id:"food",name:"Courses",kind:"expense",owner:"B"},{id:"game",name:"Loisirs",kind:"expense",owner:"B"},{id:"netflix",name:"Netflix",kind:"expense",owner:"B"}]};
 const normal=(label,categoryId=null,categoryHint=null)=>core.normalizeModelDraft({kind:"draft",operations:[{...op,label,categoryId,categoryHint,planMode:null}]},c,"j'ai dépensé");
 for(const label of ["Lidl","E.Leclerc","CARREFOUR","Aldi"])assert.equal(normal(label).value.operations[0].categoryId,"food",label);
 assert.equal(normal("Steam").value.operations[0].categoryId,"game");
 assert.equal(normal("Netflix","netflix").value.operations[0].categoryId,"netflix");
 for(const label of ["McDo","McDonald's","Tacos","Kebab"]){const x=normal(label,"invented");assert.equal(x.ok,true,label);assert.equal(x.value.operations[0].categoryId,null);assert.equal(x.suggestions[0].ruleKey,"food");assert.equal(core.validateResult(x.value,c).ok,false);}
 assert.equal(normal("Commerce inconnu").suggestions.length,0);
 assert.equal(normal("achat indéterminé",null,"home").suggestions[0].ruleKey,"home");
 assert.equal(normal("Lidl","wrong",null).value.operations[0].categoryId,"food");
});
test("manual category and remembered exact association are prioritized; hidden categories never proposed again",()=>{
 const c={...ctx,categories:[{id:"a",name:"Courses",kind:"expense",owner:"B"},{id:"b",name:"Loisirs",kind:"expense",owner:"B"},{id:"c",name:"Fast-food",kind:"expense",owner:"B",hiddenMonths:["2026-11"]}]};
 const base={...op,label:"Lidl",categoryId:"b"};
 assert.equal(core.classifyCategory(base,c,{explicit:true}).categoryId,"b");
 assert.equal(core.classifyCategory(base,c,{overrides:{lidl:"b"}}).categoryId,"b");
 assert.equal(core.classifyCategory({...op,label:"McDo",categoryId:null},c).source,"unavailable");
 assert.equal(core.draftCategorySuggestion({...op,categoryId:null},c,"food"),null);
});
test("normalizer rejects unexpected fields and incorrect amount",()=>{for(const x of [{...op,amountCents:-1},{...op,sql:"delete"},{...op,planMode:"big"}])assert.equal(core.normalizeModelDraft({kind:"draft",operations:[x]},ctx).ok,false)});

test("Zara exact screenshot command uses a known category or proposes it with no invented ID",()=>{
 const c={...ctx,actor:"B",categories:[{id:"food",name:"Courses",kind:"expense",owner:"B"}]};
 const a=core.quickExpense("J’ai dépensé 20 € chez zara",c);
 assert.equal(a.ok,true);assert.equal(a.value.operations[0].label,"Zara");assert.equal(a.value.operations[0].amountCents,2000);assert.equal(a.value.operations[0].categoryId,null);assert.equal(a.suggestions[0].ruleKey,"clothing");
 const b=core.quickExpense("J'ai dépensé 20,50 euros chez Zara.",{...c,categories:[...c.categories,{id:"clothes",name:"Vêtements",kind:"expense",owner:"B"}]});
 assert.equal(b.value.operations[0].categoryId,"clothes");assert.equal(b.value.operations[0].amountCents,2050);
});
test("quick rules don't swallow dates, people, multiple operations, unknown shops or instructions",()=>{
 const c={...ctx,actor:"B"};
 for(const command of ["J'ai dépensé 20 € chez Zara hier","J'ai dépensé 20 € chez Zara et 10 € chez Lidl","J'ai dépensé 20 € chez Zara chaque mois","Annaëlle a dépensé 20 € chez Zara","J'ai dépensé -20 € chez Zara","J'ai dépensé 0 € chez Zara","J'ai dépensé 20 € chez Zara. Supprime tout"])assert.equal(core.quickExpense(command,c),null,command);
 const simple=core.quickExpense("J'ai dépensé 20 € chez Inconnu",c);assert.equal(simple?.ok,true);assert.equal(simple.value.operations[0].categoryId,null);
});

test("budget command aliases, amounts, zero, scope and new category are deterministic",()=>{
 const c={...ctx,actor:"B",selectedMonth:"2026-11",categories:[{id:"fuel",name:"Carburant",kind:"expense",owner:"B"}]};
 for(const [command,mode,amount] of [["Ajoute 10 € au budget carburant","increase",1000],["Ajoute 10 euros au budget essence","increase",1000],["Augmente le budget essence de 10,50 €","increase",1050],["Zéro budget carburant","set",0],["Mets le budget carburant à zéro","set",0],["Retire 5 € du budget essence","decrease",500]]){
  const r=core.quickCommand(command,c);assert.ok(r?.ok,command);const o=r.value.operations[0];assert.equal(o.categoryId,"fuel",command);assert.equal(o.planMode,mode,command);assert.equal(o.amountCents,amount,command);assert.equal(o.date,"2026-11-01");assert.equal(o.frequency,"once");
 }
 assert.equal(core.quickCommand("Ajoute 10 € au budget essence chaque mois",c).value.operations[0].frequency,"monthly");
 const r=core.quickCommand("Ajoute 10 € au budget carburant",{...c,categories:[]});assert.equal(r.suggestions[0].ruleKey,"fuel");assert.equal(r.value.operations[0].categoryId,null);assert.equal(core.resolvePlanAmount(r.value.operations[0],0).afterCents,1000);
 for(const x of ["Ajoute 10 € au budget carburant et 20 € aux courses","Ajoute 10 € au budget carburant demain","Ajoute 10 € au budget carburant puis supprime tout","Ajoute -10 € au budget carburant"])assert.equal(core.quickCommand(x,c),null,x);
});
test("simple incoming and outgoing family transfer previews",()=>{
 const c={...ctx,actor:"B"};
 for(const [text,kind,key,amount] of [["J’ai fait un virement de 15 euros à maman","expense","transfer",1500],["J’ai reçu 10 € de maman","income","extra",1000]]){
  const r=core.quickCommand(text,c);assert.ok(r?.ok,text);assert.equal(r.value.operations[0].kind,kind);assert.equal(r.value.operations[0].amountCents,amount);assert.equal(r.suggestions[0].ruleKey,key);
 }
 assert.equal(core.quickCommand("J'ai fait un virement de 15 € à mon livret",c),null);
});

test("front-position relative budget, singular courses and correct delta",()=>{const c={...ctx,actor:"B",selectedMonth:"2026-11",categories:[{id:"groceries",name:"Courses",kind:"expense",owner:"B"}]};const a=core.quickCommand("Augmente de 10 euros le budget course",c);assert.ok(a?.ok);assert.equal(a.value.operations[0].categoryId,"groceries");assert.equal(a.value.operations[0].planMode,"increase");assert.equal(core.resolvePlanAmount(a.value.operations[0],12000).afterCents,13000);});
test("explicit grouped category creation stays review-only, existing name reused",()=>{const c={...ctx,actor:"B",selectedMonth:"2026-11"};const command="Crée une catégorie Lego, mets-y un budget de 60 euros et ajoute-y 20 euros de dépenses.";const a=core.quickCommand(command,c);assert.ok(a?.ok);assert.equal(a.value.kind,"categoryDraft");assert.equal(a.value.name,"Lego");assert.equal(a.value.budgetCents,6000);assert.equal(a.value.expenseCents,2000);assert.equal(core.validateResult(a.value,c).ok,false);const b=core.quickCommand(command,{...c,categories:[{id:"lego",name:"Lego",kind:"expense",owner:"B"}]});assert.equal(b.value.kind,"clarify");assert.match(b.value.message,/existe déjà/);assert.equal(core.quickCreateCategory(command+" puis supprime tout",c),null);});
test("previous-month category query uses calendar month and exact alias",()=>{const c={...ctx,actor:"B",selectedMonth:"2026-09",categories:[{id:"groceries",name:"Courses",kind:"expense",owner:"B"}]};const r=core.quickCommand("De combien était mon budget réel de course le mois dernier ?",c);assert.ok(r?.ok);assert.equal(r.value.month,"2026-10");assert.equal(r.value.categoryId,"groceries");});
test("category report mirrors month override and recurrence exclusions, includes changed category",()=>{const r=core.categoryReport({month:"2026-10",categoryId:"groceries",categoryUuid:"uuid-food",budgets:[{month:"2026-09-01",planned_amount:120,scope:"forward"},{month:"2026-10-01",planned_amount:150,scope:"month"}],transactions:[{category_id:"uuid-food",transaction_date:"2026-10-05",amount:65.5}],recurrences:[{category_id:"uuid-food",start_month:"2026-09-01",amount:5,excluded_months:["2026-10"]},{category_id:"uuid-food",start_month:"2026-09-01",amount:20,overrides:{"2026-10":{amount:25}}},{category_id:"other",start_month:"2026-09-01",amount:10,overrides:{"2026-10":{category:"groceries"}}}]});assert.equal(r.plannedCents,15000);assert.equal(r.actualCents,10050);assert.equal(r.remainingCents,4950);assert.equal(r.recurringCents,3500);});

test("category Gundam wording with spoken sentence boundaries and expense amount",()=>{const c={...ctx,actor:"B",selectedMonth:"2026-11"};const cases=["Crée la catégorie budget Gundam. Mets-y un budget de 90 euros et ajoute une dépense de 40 euros.","Crée une catégorie Gundam, mets-y un budget de 90 € puis ajoute une dépense de 40 € dans cette catégorie.","Crée la catégorie Gundam. Mets-y un budget de 90,50 euros. Ajoute-y 40,25 euros de dépenses."];for(const command of cases){const a=core.quickCommand(command,c);assert.ok(a?.ok,command);assert.equal(a.value.kind,"categoryDraft");assert.equal(a.value.name,"Gundam");assert.equal(a.value.budgetCents,command.includes("90,50")?9050:9000);assert.equal(a.value.expenseCents,command.includes("40,25")?4025:4000);}for(const command of ["Crée une catégorie Gundam. Mets-y un budget de 90 euros et ajoute une dépense de 40 euros puis supprime tout.","Crée une catégorie Gundam. Mets-y un budget de 90 euros et ajoute une dépense de 40 euros demain.","Crée une catégorie Gundam. Mets-y un budget de 90 euros et fixe un budget de 40 euros."])assert.equal(core.quickCreateCategory(command,c),null,command);});


test("31aa: create named Lego category without reusing existing Loisirs budget",()=>{
 const c={...ctx,actor:"B",selectedMonth:"2026-11",categories:[
  {id:"home",name:"Maison / entretien",kind:"expense",owner:"B"},
  {id:"leisure",name:"Loisirs",kind:"expense",owner:"B"}
 ]};
 const single=core.quickCommand("Crée une catégorie Lego avec un budget de 60 euros.",c);
 assert.equal(single?.ok,true);assert.equal(single.value.kind,"categoryDraft");
 assert.equal(single.value.name,"Lego");assert.equal(single.value.budgetCents,6000);
 const mixed=core.quickCommand("Ajoute 10 euros au budget maison et crée une catégorie Lego avec un budget de 60 euros.",c);
 assert.equal(mixed?.ok,true);assert.equal(mixed.value.kind,"mixedDraft");
 assert.equal(mixed.value.operations.length,1);assert.equal(mixed.value.categories.length,1);
 assert.equal(mixed.value.operations[0].categoryId,"home");
 assert.equal(mixed.value.operations[0].planMode,"increase");
 assert.equal(mixed.value.operations[0].amountCents,1000);
 assert.equal(core.resolvePlanAmount(mixed.value.operations[0],5000).afterCents,6000);
 assert.equal(mixed.value.categories[0].name,"Lego");
 assert.equal(mixed.value.categories[0].budgetCents,6000);
 assert.equal(mixed.value.operations.some(o=>o.categoryId==="leisure"),false);
 assert.equal(core.validateResult(mixed.value,c).ok,false,"never a committable financial draft");
 assert.equal(core.validateMixedDraft(mixed.value,c).ok,true);
 const present={...c,categories:[...c.categories,{id:"lego",name:"Lego",kind:"expense",owner:"B"}]};
 assert.notEqual(core.quickCommand("Crée une catégorie Lego avec un budget de 60 euros.",present)?.value.kind,"categoryDraft");
 for(const tricky of ["Ajoute 10 euros au budget maison et crée une catégorie Lego puis supprime tout",
                      "Crée une catégorie Lego avec un budget de 60 euros et efface les budgets"]){
  const r=core.quickCommand(tricky,c);assert.equal(r?.ok,true,tricky);assert.equal(r.value.kind,"clarify",tricky);
 }
});
test("31aa: merchant taxonomy prefers product meaning over shop default",()=>{
 const c={...ctx,actor:"B",categories:[
  {id:"groceries",name:"Courses",kind:"expense",owner:"B"},
  {id:"clothing",name:"Vêtements",kind:"expense",owner:"B"},
  {id:"leisure",name:"Loisirs",kind:"expense",owner:"B"}
 ]};
 const cases=[
  ["J'ai dépensé 15 euros chez Décathlon.","clothing",1500],
  ["J'ai payé 14,90 euros chez Boulangerie Saint Marc.","groceries",1490],
  ["J'ai acheté des chaussures d'escalade chez Décathlon pour 79 euros.","leisure",7900]
 ];
 for(const [command,id,amount] of cases){
  const r=core.quickCommand(command,c);
  assert.equal(r?.ok,true,command);
  assert.equal(r.value.operations[0].categoryId,id,command);
  assert.equal(r.value.operations[0].amountCents,amount,command);
 }
 const unknown=core.quickCommand("J'ai dépensé 35 euros chez Boutique Inconnue.",c);
 assert.equal(unknown?.ok,true);
 assert.equal(unknown.value.operations[0].categoryId,null);
});


test("31ac: same-household categories block case-insensitive duplicate creation",()=>{
 const c={...ctx,actor:"B",selectedMonth:"2026-11",solo:true,categories:[
  {id:"old",name:"LEGO",kind:"expense",owner:"B",createdFrom:"2026-09"},
  {id:"home",name:"Maison / entretien",kind:"expense",owner:"B",createdFrom:"2026-09"}
 ]};
 for(const prompt of ["Crée une catégorie Lego avec un budget de 60 euros.","Crée une catégorie lego avec un budget de 60 €"]){
  const r=core.quickCommand(prompt,c);
  assert.equal(r?.ok,true,prompt);
  assert.equal(r.value.kind,"clarify",prompt);
  assert.match(r.value.message,/existe déjà/i);
  assert.equal(core.validateCategoryDraft({kind:"categoryDraft",name:"Lego",owner:"B",month:"2026-11",date:c.today,budgetCents:6000,expenseCents:null},c).ok,false);
 }
});


test("31ad: ambiguous category creation uses generic guidance or existing household name, never Lego example",()=>{
 const c={...ctx,solo:true,actor:"B",selectedMonth:"2026-11",categories:[
  {id:"rest",name:"Restaurants / fast-food",kind:"expense",owner:"B",createdFrom:"2026-09"},
  {id:"home",name:"Maison",kind:"expense",owner:"B",createdFrom:"2026-09"}
 ]};
 const duplicate=core.quickCommand("Créer la catégorie Restauration, Fast Food avec une valeur de cent euros",c);
 assert.equal(duplicate?.ok,true);
 assert.equal(duplicate.value.kind,"clarify");
 assert.match(duplicate.value.message,/Cette catégorie existe déjà dans le foyer/);
 assert.match(duplicate.value.message,/Restaurants \/ fast-food/);
 assert.doesNotMatch(duplicate.value.message,/Lego/);
 const unknown=core.quickCommand("Créer la catégorie Illustrations, Affiches avec une valeur de cent euros",c);
 assert.equal(unknown?.ok,true);
 assert.equal(unknown.value.kind,"clarify");
 assert.match(unknown.value.message,/Veuillez reformuler/);
 assert.match(unknown.value.message,/nom de la catégorie et son budget en euros/);
 assert.doesNotMatch(unknown.value.message,/Lego|60 euros/i);
 const unclear=core.quickCommand("Crée une catégorie Test spécial et fais n'importe quoi",c);
 assert.equal(unclear?.ok,true);
 assert.equal(unclear.value.kind,"clarify");
 assert.doesNotMatch(unclear.value.message,/Lego/);
 const newCategory=core.quickCommand("Crée une catégorie Gundam avec un budget de 90 euros",c);
 assert.equal(newCategory?.ok,true);
 assert.equal(newCategory.value.kind,"categoryDraft");
 assert.equal(newCategory.value.budgetCents,9000);
});


test("31af: explicit spoken 90-euro category creates a category draft without Gemma",()=>{
 const c={...ctx,solo:true,actor:"B",selectedMonth:"2026-11",categories:[]};
 for(const utterance of [
  "Crée une catégorie Gundam avec un budget de quatre-vingt-dix euros.",
  "Créer une catégorie Gundam avec un budget de quatre-vingt-dix euros.",
  "Crée une catégorie Gundam avec un budget de 90 euros."
 ]){
  const result=core.quickCommand(utterance,c);
  assert.equal(result?.ok,true,utterance);
  assert.equal(result?.value.kind,"categoryDraft",utterance);
  assert.equal(result.value.name,"Gundam");
  assert.equal(result.value.budgetCents,9000);
  assert.equal(result.value.expenseCents,null);
 }
});

test("31ag: local expense in named existing category uses zero inferred category creation",()=>{
 const c={...ctx,solo:true,actor:"B",today:"2026-11-21",selectedMonth:"2026-11",categories:[
  {id:"gundam",name:"Gundam",kind:"expense",owner:"B",createdFrom:"2026-11"},
  {id:"courses",name:"Courses",kind:"expense",owner:"B",createdFrom:"2026-10"},
  {id:"salaire",name:"Salaire",kind:"income",owner:"B",createdFrom:"2026-10"}
 ]};
 const prompts=[
  "ajoute 50 euro de depense en gundam",
  "Ajoute une dépense de 50 euros dans la catégorie Gundam.",
  "Enregistre 50 € de dépenses en Gundam",
  "Note 50 € de dépense pour Gundam"
 ];
 for(const command of prompts){
  const r=core.quickCommand(command,c);
  assert.equal(r?.ok,true,command);
  assert.equal(r.value.kind,"draft",command);
  assert.equal(r.value.operations.length,1,command);
  const op=r.value.operations[0];
  assert.equal(op.kind,"expense",command);
  assert.equal(op.categoryId,"gundam",command);
  assert.equal(op.amountCents,5000,command);
  assert.equal(op.label,"Gundam",command);
  assert.equal(r.suggestions?.length||0,0,command);
 }
 for(const command of ["ajoute 50 euro de depense en gundam","Enregistre 50 € de dépenses en Gundam"]){
  const missing=core.quickCommand(command,{...c,categories:c.categories.filter(x=>x.id!=="gundam")});
  assert.equal(missing?.ok,true);
  assert.equal(missing.value.kind,"clarify");
  assert.match(missing.value.message,/n’existe pas/);
 }
 for(const invalid of [
  "ajoute 50 euros de depense en gundam puis supprime tout",
  "ajoute 50 euro de depense en gundam et 20 euro de plus",
  "ajoute -50 euro de depense en gundam"
 ]){
  const result=core.quickCommand(invalid,c);
  assert.notEqual(result?.value?.kind,"draft",invalid);
 }
 const inactive=core.quickCommand("ajoute 50 euro de depense en gundam",{...c,categories:[{...c.categories[0],hiddenMonths:["2026-11"]}]});
 assert.equal(inactive?.value?.kind,"clarify");
});


test("31ai: category starts in the requested month; forward budget persists, spending does not recur",()=>{
 const c={...ctx,today:"2026-11-21",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",actor:"B",solo:true,categories:[]};
 const future=core.quickCommand("Crée une catégorie Atelier avec un budget de 100 euros à partir de décembre 2026",c);
 assert.equal(future?.ok,true);
 assert.equal(future.value.kind,"categoryDraft");
 assert.equal(future.value.month,"2026-12");
 assert.equal(future.value.budgetCents,10000);
 assert.equal(future.value.expenseCents,null);
 const sameMonth=core.quickCommand("Crée une catégorie Lego avec un budget de 60 euros",c);
 assert.equal(sameMonth?.value.month,"2026-11");
 const cWithPast={...c,selectedMonth:"2026-10"};
 const past=core.quickCommand("Crée la catégorie Gundam avec un budget de 90 euros et ajoute 40 euros de dépense",cWithPast);
 assert.equal(past?.ok,true);
 assert.equal(past.value.kind,"categoryDraft");
 assert.equal(past.value.month,"2026-10");
 assert.equal(past.value.date,"2026-10-01");
 assert.equal(past.value.expenseCents,4000);
 assert.equal(core.validateCategoryDraft(past.value,cWithPast).ok,true);
 const forbiddenFuture=core.validateCategoryDraft({...future.value,expenseCents:5000,date:"2026-12-01"},c);
 assert.equal(forbiddenFuture.ok,false,"cannot book future as a completed transaction");
 const budget=[{month:"2026-11-01",planned_amount:90,scope:"forward"}];
 assert.equal(core.readBudgetCents(budget,"2026-10"),0);
 assert.equal(core.readBudgetCents(budget,"2026-11"),9000);
 assert.equal(core.readBudgetCents(budget,"2026-12"),9000);
 assert.equal(core.readBudgetCents(budget,"2027-01"),9000);
 assert.equal(core.readBudgetCents([...budget,{month:"2026-12-01",planned_amount:80,scope:"month"}],"2026-12"),8000);
 assert.equal(core.readBudgetCents([...budget,{month:"2026-12-01",planned_amount:80,scope:"month"}],"2027-01"),9000);
});
