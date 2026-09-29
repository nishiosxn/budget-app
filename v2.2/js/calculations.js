// V2.2 — règles métier et calculs mensuels
function planStoreForType(type){return type==="income"?(state.incomePlanChanges=state.incomePlanChanges||{}):(state.expensePlanChanges=state.expensePlanChanges||{})}
function planForCategoryAtKey(c,key,type="expense"){
 const record=planStoreForType(type)[c.id]||{},forward=record.forward||{},month=record.month||{};let budget=Number(c.budget)||0,owner=c.owner||"common";
 const latest=Object.keys(forward).filter(k=>k<=key).sort().pop();if(latest){const v=forward[latest]||{};if(Number.isFinite(Number(v.budget)))budget=Number(v.budget);if(v.owner)owner=v.owner}
 const exact=month[key];if(exact){if(Number.isFinite(Number(exact.budget)))budget=Number(exact.budget);if(exact.owner)owner=exact.owner}
 return {budget,owner}
}
function planForCategory(c,label=state.selectedMonth,type="expense"){return planForCategoryAtKey(c,monthKey(label),type)}
function categoryView(c,type="expense",label=state.selectedMonth){return {...c,...planForCategory(c,label,type)}}
function setCategoryPlan(id,type,budget,owner,scope="forward"){
 const c=(type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).find(x=>x.id===id);if(!c)return;const key=monthKey(state.selectedMonth),store=planStoreForType(type),record=store[id]||(store[id]={forward:{},month:{}});record.forward=record.forward||{};record.month=record.month||{};
 const value={budget:Math.max(0,Math.round((Number(budget)||0)*100)/100),owner:owner||"common"};
 if(scope==="month")record.month[key]=value;else{record.forward[key]=value;delete record.month[key]}
}
function categoryCreatedFrom(id,type="expense"){const c=(type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).find(x=>x.id===id);return c?.createdFrom||"2026-09"}
function isCategoryVisible(id,label=state.selectedMonth,type="expense"){const key=monthKey(label),globalDeleted=type==="income"?(state.deletedIncomeCategoriesGlobal||[]):(state.deletedCategoriesGlobal||[]),monthDeleted=type==="income"?(state.deletedIncomeCategoryMonths?.[key]||[]):(state.deletedCategoryMonths?.[key]||[]);return key>=categoryCreatedFrom(id,type)&&!globalDeleted.includes(id)&&!monthDeleted.includes(id)}
function visibleExpenseCategories(label=state.selectedMonth){return EXPENSE_CATEGORIES.filter(c=>!c.saving&&isCategoryVisible(c.id,label,"expense")).map(c=>categoryView(c,"expense",label))}
function visibleSavingCategories(label=state.selectedMonth){return EXPENSE_CATEGORIES.filter(c=>c.saving&&isCategoryVisible(c.id,label,"expense")).map(c=>categoryView(c,"expense",label))}
function visibleIncomeCategories(label=state.selectedMonth){return INCOME_CATEGORIES.filter(c=>isCategoryVisible(c.id,label,"income")).map(c=>categoryView(c,"income",label))}
function recurringOccurrenceDate(t,key){const raw=String(t.date||"");const day=Math.max(1,Math.min(31,Number(raw.slice(8,10))||1)),[y,m]=key.split("-").map(Number),last=new Date(y,m,0).getDate();return `${key}-${String(Math.min(day,last)).padStart(2,"0")}`}
function previousMonthKey(key){const [y,m]=key.split("-").map(Number),d=new Date(y,m-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function recurringSeriesId(t){return t?.seriesId||t?.id||""}
function recurringRoot(sourceId){return state.transactions.find(t=>t.id===sourceId&&t.scope==="forward")||null}
function recurringSeriesRootsFromSource(sourceId){const root=recurringRoot(sourceId);if(!root)return[];const seriesId=recurringSeriesId(root);return state.transactions.filter(t=>t.scope==="forward"&&recurringSeriesId(t)===seriesId)}
function transactionsForMonthKey(key){return state.transactions.flatMap(t=>{const start=String(t.date||"").slice(0,7);if(t.scope==="forward"){if(!start||start>key||(t.endMonth&&key>t.endMonth)||(t.excludedMonths||[]).includes(key))return[];const override=t.overrides?.[key]||{};return[{...t,...override,id:`${t.id}@${key}`,sourceId:t.id,seriesId:recurringSeriesId(t),date:recurringOccurrenceDate(t,key),recurringOccurrence:true}]}return start===key?[t]:[]})}
function getMonthTransactions(){return transactionsForMonthKey(monthKey(state.selectedMonth))}
const LEGACY_CATEGORY_DEFS={"extra-1":{id:"extra-1",name:"Revenu supplémentaire 1",owner:"common",legacy:true,type:"income"},"extra-2":{id:"extra-2",name:"Revenu supplémentaire 2",owner:"common",legacy:true,type:"income"},"expense-1":{id:"expense-1",name:"Dépense 1",owner:"common",section:"Vie courante",legacy:true,type:"expense"},"expense-2":{id:"expense-2",name:"Dépense 2",owner:"common",section:"Vie courante",legacy:true,type:"expense"},"expense-3":{id:"expense-3",name:"Dépense 3",owner:"common",section:"Vie courante",legacy:true,type:"expense"},"expense-4":{id:"expense-4",name:"Dépense 4",owner:"common",section:"Vie courante",legacy:true,type:"expense"}};
function catById(id,type){return (type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).find(c=>c.id===id)||(LEGACY_CATEGORY_DEFS[id]?.type===type?LEGACY_CATEGORY_DEFS[id]:null)}
function totalsByCategoryAtKey(type,key){const map={};transactionsForMonthKey(key).filter(t=>t.type===type).forEach(t=>map[t.category]=(map[t.category]||0)+(Number(t.amount)||0));return map}
function totalsByCategory(type){return totalsByCategoryAtKey(type,monthKey(state.selectedMonth))}
function sum(list){return list.reduce((a,b)=>a+b,0)}
function shareAmount(owner,amount,person){if(owner==="common")return amount/2;if(owner===person)return amount;return 0}
function transactionOwner(t){if(t.owner)return t.owner;const c=catById(t.category,t.type);if(!c)return "common";return planForCategoryAtKey(c,String(t.date||"").slice(0,7)||monthKey(state.selectedMonth),t.type).owner||"common"}
function actualForCategoryAtMonth(id,key,type="expense"){return Math.round(sum(transactionsForMonthKey(key).filter(t=>t.type===type&&t.category===id).map(t=>Number(t.amount)||0))*100)/100}
function cumulativeCategoryActual(id,type="expense",throughLabel=state.selectedMonth){const through=monthKey(throughLabel);return MONTHS.map(monthKey).filter(key=>key<=through).reduce((total,key)=>total+actualForCategoryAtMonth(id,key,type),0)}
function metricsForMonth(label=state.selectedMonth){
 const key=monthKey(label),tx=transactionsForMonthKey(key),incMap=totalsByCategoryAtKey("income",key),expMap=totalsByCategoryAtKey("expense",key);
 const income=sum(tx.filter(t=>t.type==="income").map(t=>Number(t.amount)||0));
 const expense=sum(tx.filter(t=>t.type==="expense"&&!catById(t.category,"expense")?.saving).map(t=>Number(t.amount)||0));
 const saving=sum(tx.filter(t=>t.type==="expense"&&catById(t.category,"expense")?.saving).map(t=>Number(t.amount)||0));
 const plannedIncome=sum(visibleIncomeCategories(label).map(c=>c.budget)),plannedExpense=sum(visibleExpenseCategories(label).map(c=>c.budget)),plannedSaving=sum(visibleSavingCategories(label).map(c=>c.budget));
 let incomeB=0,incomeA=0,expenseB=0,expenseA=0,savingBShare=0,savingAShare=0;
 tx.forEach(t=>{const owner=transactionOwner(t),amount=Number(t.amount)||0;if(t.type==="income"){incomeB+=shareAmount(owner,amount,"B");incomeA+=shareAmount(owner,amount,"A")}else if(catById(t.category,"expense")?.saving){savingBShare+=shareAmount(owner,amount,"B");savingAShare+=shareAmount(owner,amount,"A")}else{expenseB+=shareAmount(owner,amount,"B");expenseA+=shareAmount(owner,amount,"A")}});
 const savingsBMonth=expMap["saving-b"]||0,savingsAMonth=expMap["saving-a"]||0,savingsB=cumulativeCategoryActual("saving-b","expense",label),savingsA=cumulativeCategoryActual("saving-a","expense",label);
 return {label,key,tx,incMap,expMap,income,expense,saving,plannedIncome,plannedExpense,plannedSaving,balance:income-expense-saving,plannedBalance:plannedIncome-plannedExpense-plannedSaving,incomeB,incomeA,expenseB,expenseA,savingBShare,savingAShare,restB:incomeB-expenseB-savingBShare,restA:incomeA-expenseA-savingAShare,savingsB,savingsA,savingsBMonth,savingsAMonth};
}
function metrics(){return metricsForMonth(state.selectedMonth)}
