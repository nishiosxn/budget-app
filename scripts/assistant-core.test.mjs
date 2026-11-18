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
