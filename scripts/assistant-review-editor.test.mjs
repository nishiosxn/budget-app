import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import vm from "node:vm";
const root={};vm.createContext(root);for(const p of ["js/assistant-core.js","preview/assistant/live/review-editor.js"])vm.runInContext(fs.readFileSync(p,"utf8"),root);
const e=root.SmartBudgetReviewEditor;
const ctx={today:"2026-11-19",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",solo:false,actor:"B",members:{A:"Anaëlle",B:"Baptiste"},categories:[
 {id:"food",name:"Courses",kind:"expense",owner:"common",createdFrom:"2026-09",hiddenMonths:[]},
 {id:"rest",name:"Restaurants / fast-food",kind:"expense",owner:"B",createdFrom:"2026-09",hiddenMonths:[]},
 {id:"income",name:"Salaire",kind:"income",owner:"B",createdFrom:"2026-09",hiddenMonths:[]},
 {id:"save",name:"Épargne",kind:"saving",owner:"B",createdFrom:"2026-09",hiddenMonths:[]}
]};
const entry={op:{kind:"expense",categoryId:"food",owner:"B",amountCents:2000,date:"2026-11-19",label:"Lidl",frequency:"once"},ruleKey:null,baseline:null};
const fields={name:"Carrefour",detail:"Courses du mois",category:"id:food",owner:"A",amount:"27,50",date:"2026-11-18",frequency:"monthly"};
test("edit amount, label, category, date, owner and frequency without mutating original",()=>{
 const r=e.fromFields(entry,fields,ctx);assert.equal(r.ok,true);assert.equal(r.entry.op.amountCents,2750);assert.equal(r.entry.op.owner,"A");assert.equal(r.entry.op.label,"Carrefour · Courses du mois");assert.equal(r.entry.op.date,"2026-11-18");assert.equal(r.entry.op.frequency,"monthly");assert.equal(entry.op.amountCents,2000);
});
test("validate malformed amounts, incompatible category, future dates and solo owner",()=>{
 for(const patch of [{amount:"1e3"},{amount:"20,999"},{amount:"-2"},{amount:"0"},{category:"id:income"},{date:"2026-11-31"},{date:"2026-12-01",frequency:"once"},{name:""},{detail:"bad · label"}])assert.equal(e.fromFields(entry,{...fields,...patch},ctx).ok,false,JSON.stringify(patch));
 assert.equal(e.fromFields(entry,fields,{...ctx,solo:true}).ok,false);
});
test("category choice includes missing canonical categories and never creates existing family",()=>{
 const r=e.fromFields(entry,{...fields,category:"rule:leisure"},ctx);assert.equal(r.ok,true);assert.equal(r.entry.op.categoryId,null);assert.equal(r.entry.ruleKey,"leisure");assert.equal(e.validate([r.entry],ctx).ok,true);
 assert.equal(e.fromFields(entry,{...fields,category:"rule:groceries"},ctx).ok,false);
});
test("budget delta recomputes against the correct baseline and changing month or category clears it",()=>{
 const plan={op:{...entry.op,kind:"plan",owner:"common",label:"Courses",date:"2026-11-01",amountCents:1000,planMode:"increase"},ruleKey:null,baseline:{key:"food|2026-11",beforeCents:12000}};
 const pf={name:"Courses",detail:"",category:"id:food",owner:"common",amount:"30",date:"2026-11-01",frequency:"once",planMode:"increase"};
 const a=e.fromFields(plan,pf,ctx);assert.equal(a.ok,true);assert.equal(e.planPreview(a.entry).afterCents,15000);
 const b=e.fromFields(plan,{...pf,planMode:"decrease",amount:"130"},ctx);assert.equal(e.planPreview(b.entry),null);
 const changed=e.fromFields(plan,{...pf,date:"2026-12-01"},ctx);assert.equal(changed.ok,true);assert.equal(changed.entry.baseline,null);assert.equal(e.validate([changed.entry],ctx).ok,false);
 const switched=e.fromFields(plan,{...pf,category:"id:rest"},ctx);assert.equal(switched.entry.op.owner,"B");assert.equal(switched.entry.baseline,null);
 const newPlan=e.fromFields(plan,{...pf,category:"rule:leisure",planMode:"set"},ctx);assert.equal(e.planPreview(newPlan.entry).afterCents,3000);
});
test("totals update after removal and distinguish saving from spending",()=>{
 const list=[entry,{op:{...entry.op,kind:"income",categoryId:"income",amountCents:7500}},{op:{...entry.op,kind:"saving",categoryId:"save",amountCents:2500}},{op:{...entry.op,frequency:"monthly",amountCents:1000}}];
 const first=e.totals(list);assert.equal(first.net,5500);assert.equal(first.saving,2500);assert.equal(first.available,3000);
 list.splice(0,1);assert.equal(e.totals(list).available,5000);
 assert.equal(e.validate([entry,entry],ctx).ok,false);
});
test("edit a grouped new category budget and expense without allowing duplicate names",()=>{
 const v={kind:"categoryDraft",name:"Gundam",owner:"B",month:"2026-11",date:"2026-11-19",budgetCents:9000,expenseCents:4000};
 const r=e.categoryFromFields(v,{name:"Lego",month:"2026-11",budget:"120",expense:"35"},ctx);assert.equal(r.ok,true);assert.equal(r.value.budgetCents-r.value.expenseCents,8500);
 assert.equal(e.categoryFromFields(v,{name:"Courses",month:"2026-11",budget:"120",expense:"35"},ctx).ok,false);
 assert.equal(e.categoryFromFields(v,{name:"Lego",month:"2026-12",budget:"120",expense:"35"},ctx).ok,false);
});
