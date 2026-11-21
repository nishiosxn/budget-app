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
test("explicit grouped category creation stays review-only, existing name reused",()=>{const c={...ctx,actor:"B",selectedMonth:"2026-11"};const command="Crée une catégorie Lego, mets-y un budget de 60 euros et ajoute-y 20 euros de dépenses.";const a=core.quickCommand(command,c);assert.ok(a?.ok);assert.equal(a.value.kind,"categoryDraft");assert.equal(a.value.name,"Lego");assert.equal(a.value.budgetCents,6000);assert.equal(a.value.expenseCents,2000);assert.equal(core.validateResult(a.value,c).ok,false);const b=core.quickCommand(command,{...c,categories:[{id:"lego",name:"Lego",kind:"expense",owner:"B"}]});assert.equal(b.value.kind,"draft");assert.equal(b.value.operations.length,2);assert.equal(b.value.operations[0].categoryId,"lego");assert.equal(b.value.operations[1].categoryId,"lego");assert.equal(core.quickCreateCategory(command+" puis supprime tout",c),null);});
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
