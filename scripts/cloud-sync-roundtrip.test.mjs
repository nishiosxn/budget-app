import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function makeContext(){
 const context=vm.createContext({
  console,
  window:{addEventListener(){}},
  activeHouseholdId:"test-household",
  cloneData:value=>structuredClone(value),
  normalizeHousehold:value=>({
   name:value?.name||"Foyer test",
   personB:value?.personB||"Personne 1",
   personA:value?.personA||"Personne 2",
   mode:value?.mode||"couple"
  }),
  ownerToSlot:owner=>owner==="B"?"B":owner==="A"?"A":null,
  slotToOwner:slot=>slot==="B"?"B":slot==="A"?"A":"common",
  cloudMonthDate:value=>{
   const key=String(value||"").slice(0,7);
   return /^\d{4}-\d{2}$/.test(key)?key+"-01":null;
  },
  monthKey:value=>String(value).slice(0,7)
 });
 for(const name of ["js/cloud-state-core.js","js/cloud-save.js","js/cloud-sync-v25.js"]){
  vm.runInContext(fs.readFileSync(name,"utf8"),context,{filename:name});
 }
 return context;
}
function fixture(){
 const date="2026-09-01";
 const categories=Array.from({length:43},(_,i)=>({
  id:"cat-uuid-"+i,
  legacy_id:"expense-"+i,
  name:"Catégorie "+i,
  household_id:"test-household",
  type:"expense",
  group_name:i%2?"Abonnements":"Vie courante",
  owner_slot:i%3===0?"B":null,
  is_saving:false,
  created_from:date,
  excluded_months:[],
  is_custom:false,
  sort_order:i*3,
  archived_at:i>=38?"2026-10-01T01:00:00Z":null,
  updated_at:"2026-11-16T00:00:00Z"
 }));
 const budgets=categories.filter(row=>!row.archived_at).map((row,i)=>({
  id:"budget-uuid-"+i,category_id:row.id,month:date,
  planned_amount:i%4===0?12:0,scope:"forward",
  owner_slot:row.owner_slot,archived_at:null,updated_at:"2026-11-16T00:00:00Z"
 }));
 const household={
  id:"test-household",name:"Foyer test",person_b_label:"Personne 1",
  person_a_label:"Personne 2",household_mode:"couple",
  updated_at:"2026-11-16T00:00:00Z"
 };
 return {categories,budgets,household,transactions:[],recurrences:[]};
}
function build(ctx,rows){
 ctx.rows=rows;
 vm.runInContext([
  "var next={",
  "household:{name:rows.household.name,personB:rows.household.person_b_label,personA:rows.household.person_a_label,mode:rows.household.household_mode},",
  "selectedMonth:'2026-11',createdMonth:'2026-09',",
  "baseIncomeCategories:[],customIncomeCategories:[],baseExpenseCategories:[],customExpenseCategories:[],",
  "deletedIncomeCategoriesGlobal:[],deletedCategoriesGlobal:[],",
  "deletedIncomeCategoryMonths:{},deletedCategoryMonths:{},",
  "incomeBudgets:{},categoryBudgets:{},incomeCategoryOwners:{},categoryOwners:{},",
  "incomeCategoryNames:{},categoryNames:{},incomePlanChanges:{},expensePlanChanges:{},transactions:[]",
  "};",
  "var idMap=cloudCategoriesToLocal(rows.categories,next);",
  "applyCloudBudgets(rows.budgets,idMap,next);",
  "var local=cloudBuildLocalSnapshot(next);",
  "var remote=cloudBuildRemoteSnapshot(rows);",
  "var baseline=cloudBaselineFromRemote(remote);",
  "var plan=cloudBuildSyncPlan(local,remote,baseline);"
 ].join("\n"),ctx);
 return vm.runInContext("plan",ctx);
}
test("l'ordre des catégories est conservé sans modifications cloud fantômes",()=>{
 const ctx=makeContext();
 const plan=build(ctx,fixture());
 assert.deepEqual(Array.from(plan.mutations),[]);
 assert.deepEqual(Array.from(plan.conflicts),[]);
 assert.equal(vm.runInContext("next.baseExpenseCategories[7].sortOrder",ctx),21);
 assert.ok(vm.runInContext("next.deletedCategoriesGlobal.length",ctx)>0);
});
test("l'ajout d'une opération ne prépare qu'un insert",()=>{
 const ctx=makeContext();
 build(ctx,fixture());
 vm.runInContext([
  "next.transactions.push({id:'expense-new',type:'expense',category:'expense-1',owner:'common',amount:19.5,date:'2026-11-16',seed:false});",
  "var changed=cloudBuildLocalSnapshot(next);",
  "var diff=cloudBuildSyncPlan(changed,remote,baseline);"
 ].join("\n"),ctx);
 const result=vm.runInContext("diff",ctx);
 assert.equal(result.mutations.length,1);
 assert.equal(result.mutations[0].table,"transactions");
 assert.equal(result.mutations[0].action,"insert");
 assert.equal(result.conflicts.length,0);
});
test("une suppression massive volontaire reste détectable par le garde-fou",()=>{
 const ctx=makeContext();
 build(ctx,fixture());
 vm.runInContext([
  "next.deletedCategoriesGlobal.push(...next.baseExpenseCategories.filter(c=>!next.deletedCategoriesGlobal.includes(c.id)).slice(0,18).map(c=>c.id));",
  "var changed=cloudBuildLocalSnapshot(next);",
  "var unsafePlan=cloudBuildSyncPlan(changed,remote,baseline);"
 ].join("\n"),ctx);
 const result=vm.runInContext("unsafePlan",ctx);
 assert.equal(result.mutations.filter(m=>m.action==="archive"&&m.table==="categories").length,18);
});
