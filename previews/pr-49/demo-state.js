/* PR49 offline test data, never a Supabase or account context.
 * This file creates the exact globals used by the production category UI.
 * Data and editing changes exist in memory only; refresh resets the demo.
 */
"use strict";
const MONTHS={"Octobre 2026":"2026-10","Novembre 2026":"2026-11","Décembre 2026":"2026-12"};
const DEFAULT_MONTH="Novembre 2026";
const state={
 selectedMonth:DEFAULT_MONTH,createdMonth:"2026-09",
 household:{name:"Foyer fictif",mode:"couple",personB:"Personne 1",personA:"Personne 2"},
 transactions:[],customIncomeCategories:[],customExpenseCategories:[],
 categoryBudgets:{},incomeBudgets:{},categoryOwners:{},incomeCategoryOwners:{},
 categoryNames:{},incomeCategoryNames:{},planOverrides:[],
 deletedIncomeCategoriesGlobal:[],deletedCategoriesGlobal:[],
 deletedIncomeCategoryMonths:{},deletedCategoryMonths:{}
};
const INCOME_CATEGORIES=[
 {id:"salary",name:"Salaire",owner:"B",budget:1700},
 {id:"benefits",name:"Aides",owner:"common",budget:200}
];
const EXPENSE_CATEGORIES=[
 {id:"rent",name:"Loyer",section:"Obligatoires",owner:"common",budget:530},
 {id:"insurance",name:"Assurance",section:"Obligatoires",owner:"B",budget:75},
 {id:"internet",name:"Internet",section:"Abonnements",owner:"common",budget:40},
 {id:"music",name:"Musique",section:"Abonnements",owner:"B",budget:12},
 {id:"groceries",name:"Courses",section:"Vie courante",owner:"common",budget:250},
 {id:"car",name:"Carburant",section:"Vie courante",owner:"B",budget:120},
 {id:"health",name:"Santé",section:"Vie courante",owner:"common",budget:0},
 {id:"reserve",name:"Épargne de précaution",section:"Obligatoires",owner:"B",budget:100,saving:true},
 {id:"projects",name:"Projets",section:"Obligatoires",owner:"common",budget:40,saving:true}
];
const LEGACY_CATEGORY_DEFS={};
const baseline={
 "2026-10":{expense:{rent:530,insurance:75,internet:40,music:12,groceries:210,car:120,health:0,reserve:100,projects:30},income:{salary:1700,benefits:200}},
 "2026-11":{expense:{rent:530,insurance:75,internet:40,music:12,groceries:250,car:120,health:0,reserve:100,projects:40},income:{salary:1700,benefits:200}},
 "2026-12":{expense:{rent:530,insurance:75,internet:40,music:12,groceries:280,car:90,health:0,reserve:120,projects:40},income:{salary:1750,benefits:200}}
};
let uidNumber=1;
function uid(){return "demo-"+String(uidNumber++)}
function monthKey(value){return MONTHS[value]||String(value).slice(0,7)}
function previousMonthKey(value){const [year,month]=monthKey(value).split("-").map(Number);return new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7)}
function euro(amount){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(amount)||0)}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function sum(values){return [...values].reduce((total,n)=>total+(Number(n)||0),0)}
function cloneData(value){return JSON.parse(JSON.stringify(value))}
function householdIsSolo(){return state.household.mode==="solo"}
function personName(owner){return owner==="B"?state.household.personB:owner==="A"?state.household.personA:"À deux"}
function ownerLabel(owner){return owner==="common"?(householdIsSolo()?personName("B"):"À deux"):personName(owner)}
function transactionOwner(tx){return tx.owner||"common"}
function transactionDateForSelectedMonth(){return monthKey(state.selectedMonth)+"-22"}
function categoryCreatedFrom(id,type){
 const c=(type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).find(x=>x.id===id);
 return c?.createdFrom||"2026-09";
}
function planForCategory(c,month=state.selectedMonth,type="expense"){
 const key=monthKey(month),kind=type==="income"?"income":"expense";
 const plan={...c,budget:baseline[key]?.[kind]?.[c.id]??c.budget??0};
 for(const update of state.planOverrides){
  if(update.type!==kind||update.id!==c.id)continue;
  if(update.scope==="month"?update.month===key:update.month<=key){
   plan.budget=update.amount;plan.owner=update.owner;
  }
 }
 return plan;
}
function categoryView(c,type){
 const plan=planForCategory(c,state.selectedMonth,type);
 const names=type==="income"?state.incomeCategoryNames:state.categoryNames;
 return {...plan,name:names?.[c.id]||plan.name};
}
function isCategoryVisible(id,month=state.selectedMonth,type="expense"){
 const key=monthKey(month),globalKey=type==="income"?"deletedIncomeCategoriesGlobal":"deletedCategoriesGlobal";
 const perKey=type==="income"?"deletedIncomeCategoryMonths":"deletedCategoryMonths";
 return !state[globalKey]?.includes(id)&&!state[perKey]?.[key]?.includes(id)&&key>=categoryCreatedFrom(id,type);
}
function visibleIncomeCategories(month=state.selectedMonth){
 return INCOME_CATEGORIES.filter(c=>isCategoryVisible(c.id,month,"income")).map(c=>{
  const p=planForCategory(c,month,"income");return {...p,name:state.incomeCategoryNames?.[c.id]||p.name};
 });
}
function visibleExpenseCategories(month=state.selectedMonth){
 return EXPENSE_CATEGORIES.filter(c=>!c.saving&&isCategoryVisible(c.id,month,"expense")).map(c=>{
  const p=planForCategory(c,month,"expense");return {...p,name:state.categoryNames?.[c.id]||p.name};
 });
}
function visibleSavingCategories(month=state.selectedMonth){
 return EXPENSE_CATEGORIES.filter(c=>c.saving&&isCategoryVisible(c.id,month,"expense")).map(c=>{
  const p=planForCategory(c,month,"expense");return {...p,name:state.categoryNames?.[c.id]||p.name};
 });
}
function catById(id,type="expense"){return (type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).find(c=>c.id===id)||null}
function setCategoryPlan(id,type,amount,owner,scope="forward"){
 state.planOverrides.push({id,type,amount:Math.round(amount*100)/100,owner,scope,month:monthKey(state.selectedMonth)});
}
function metrics(){
 const key=monthKey(state.selectedMonth),tx=state.transactions.filter(t=>String(t.date).slice(0,7)===key);
 const incMap={},expMap={};
 for(const t of tx){const map=t.type==="income"?incMap:expMap;map[t.category]=(map[t.category]||0)+Number(t.amount||0)}
 return {tx,incMap,expMap,income:sum(Object.values(incMap)),
  saving:sum(EXPENSE_CATEGORIES.filter(c=>c.saving).map(c=>expMap[c.id]||0)),
  expense:sum(EXPENSE_CATEGORIES.filter(c=>!c.saving).map(c=>expMap[c.id]||0))};
}
function totalsByCategory(type){const m=metrics();return type==="income"?m.incMap:m.expMap}
function saveState(){} // no network, no localStorage, no persistence
function closeCustomSelects(){}
function selectCreatedTransactionCategory(){}
let undoTimeout;
function showUndoToast(message,onUndo=null){
 const el=document.getElementById("demoToast");
 if(!el)return;
 clearTimeout(undoTimeout);
 el.innerHTML="<span>"+escapeHtml(message)+"</span>"+(onUndo?'<button type="button" data-demo-undo>Annuler</button>':"");
 el.hidden=false;
 el.querySelector("[data-demo-undo]")?.addEventListener("click",()=>{onUndo();el.hidden=true},{once:true});
 undoTimeout=setTimeout(()=>{el.hidden=true},6500);
}
function render(){
 globalThis.SmartBudgetCategoryDistribution?.render();
 renderCategories(metrics());
}
const record=(type,category,amount,owner,date,label)=>({id:uid(),type,category,amount,owner,date,label:label||"",seed:false});
state.transactions.push(
 record("income","salary",1700,"B","2026-11-03","Salaire de novembre"),
 record("income","benefits",200,"common","2026-11-06","Aides"),
 record("expense","rent",530,"common","2026-11-05","Loyer"),
 record("expense","internet",40,"common","2026-11-07","Internet"),
 record("expense","groceries",96,"common","2026-11-13","Courses Lidl"),
 record("expense","groceries",90,"common","2026-11-17","Courses"),
 record("expense","car",54,"B","2026-11-15","Carburant"),
 record("expense","reserve",60,"B","2026-11-18","Épargne"),
 record("expense","projects",20,"common","2026-11-19","Projets"),
 record("income","salary",1700,"B","2026-10-04","Salaire d'octobre"),
 record("income","benefits",200,"common","2026-10-06","Aides"),
 record("expense","rent",530,"common","2026-10-06","Loyer"),
 record("expense","groceries",198,"common","2026-10-15","Courses"),
 record("expense","car",105,"B","2026-10-20","Carburant"),
 record("expense","reserve",80,"B","2026-10-21","Épargne"),
 // Scenario accessible in December: moderate and major overspending.
 record("expense","car",102,"B","2026-12-09","Carburant"),
 record("expense","music",22,"B","2026-12-10","Musique")
);
