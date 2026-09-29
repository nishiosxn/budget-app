// V2.2 — état local, chargement, migrations et sauvegarde
function seedState(){
 const transactions=[]; let order=1;
 Object.entries(SEPTEMBER_ACTUAL.income).forEach(([category,amount])=>{if(amount>0)transactions.push({id:"seed-i-"+order++,type:"income",category,amount,date:"2026-09-01",seed:true})});
 Object.entries(SEPTEMBER_ACTUAL.expense).forEach(([category,amount])=>{if(amount>0)transactions.push({id:"seed-e-"+order++,type:"expense",category,amount,date:"2026-09-01",seed:true})});
 return {schemaVersion:4,selectedMonth:"Septembre 2026",transactions,categoryBudgets:{},incomeBudgets:{},categoryOwners:{},incomeCategoryOwners:{},categoryNames:{},incomeCategoryNames:{},customExpenseCategories:[],customIncomeCategories:[],expensePlanChanges:{},incomePlanChanges:{},actualAdjustments:{},incomeActualAdjustments:{},deletedCategoryMonths:{},deletedCategoriesGlobal:[],deletedIncomeCategoryMonths:{},deletedIncomeCategoriesGlobal:[]};
}
function loadState(){
 try{
  const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!(x&&Array.isArray(x.transactions)))return seedState();
  x.categoryBudgets=x.categoryBudgets||{};x.incomeBudgets=x.incomeBudgets||{};x.categoryOwners=x.categoryOwners&&typeof x.categoryOwners==="object"?x.categoryOwners:{};x.incomeCategoryOwners=x.incomeCategoryOwners&&typeof x.incomeCategoryOwners==="object"?x.incomeCategoryOwners:{};x.categoryNames=x.categoryNames&&typeof x.categoryNames==="object"?x.categoryNames:{};x.incomeCategoryNames=x.incomeCategoryNames&&typeof x.incomeCategoryNames==="object"?x.incomeCategoryNames:{};
  x.customExpenseCategories=Array.isArray(x.customExpenseCategories)?x.customExpenseCategories:[];x.customIncomeCategories=Array.isArray(x.customIncomeCategories)?x.customIncomeCategories:[];
  const creationFallback=(category,type)=>{const keys=x.transactions.filter(t=>t.type===type&&t.category===category).map(t=>String(t.date||"").slice(0,7)).filter(Boolean).sort();return keys[0]||monthKey(x.selectedMonth||"Septembre 2026")};
  x.customExpenseCategories=x.customExpenseCategories.map(c=>({...c,createdFrom:c.createdFrom||creationFallback(c.id,"expense")}));x.customIncomeCategories=x.customIncomeCategories.map(c=>({...c,createdFrom:c.createdFrom||creationFallback(c.id,"income")}));
  x.expensePlanChanges=x.expensePlanChanges&&typeof x.expensePlanChanges==="object"?x.expensePlanChanges:{};x.incomePlanChanges=x.incomePlanChanges&&typeof x.incomePlanChanges==="object"?x.incomePlanChanges:{};
  x.deletedCategoryMonths=x.deletedCategoryMonths&&typeof x.deletedCategoryMonths==="object"?x.deletedCategoryMonths:{};x.deletedCategoriesGlobal=Array.isArray(x.deletedCategoriesGlobal)?x.deletedCategoriesGlobal:[];x.deletedIncomeCategoryMonths=x.deletedIncomeCategoryMonths&&typeof x.deletedIncomeCategoryMonths==="object"?x.deletedIncomeCategoryMonths:{};x.deletedIncomeCategoriesGlobal=Array.isArray(x.deletedIncomeCategoriesGlobal)?x.deletedIncomeCategoriesGlobal:[];
  let migrated=false;
  x.transactions.forEach(t=>{if(t?.scope==="forward"){if(!t.seriesId){t.seriesId=t.id;migrated=true}if(!Array.isArray(t.excludedMonths)){t.excludedMonths=[];migrated=true}if(!t.overrides||typeof t.overrides!=="object"||Array.isArray(t.overrides)){t.overrides={};migrated=true}}});
  [["expense","actualAdjustments"],["income","incomeActualAdjustments"]].forEach(([type,prop])=>{const source=x[prop]&&typeof x[prop]==="object"?x[prop]:{};Object.entries(source).forEach(([key,items])=>{Object.entries(items||{}).forEach(([category,delta])=>{delta=Math.round((Number(delta)||0)*100)/100;if(Math.abs(delta)<.005)return;const ownerMap=type==="income"?x.incomeCategoryOwners:x.categoryOwners,baseList=type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES,customList=type==="income"?x.customIncomeCategories:x.customExpenseCategories,owner=ownerMap?.[category]||baseList.find(c=>c.id===category)?.owner||customList.find(c=>c.id===category)?.owner||"common";x.transactions.push({id:`migration-${type}-${key}-${category}-${uid()}`,type,category,owner,amount:delta,date:`${key}-01`,seed:false,adjustment:true,adjustmentLabel:"Ajustement migré"});migrated=true})});x[prop]={}});
  if(migrated)localStorage.setItem(STORAGE_KEY,JSON.stringify(x));
  x.schemaVersion=4;
  return x;
 }catch{return seedState()}
}
function applyCategoryState(){
 INCOME_CATEGORIES.splice(BASE_INCOME_COUNT);
 INCOME_CATEGORIES.forEach(c=>{c.name=state.incomeCategoryNames?.[c.id]||BASE_INCOME_NAMES[c.id]||c.name;c.budget=Object.prototype.hasOwnProperty.call(state.incomeBudgets,c.id)?Number(state.incomeBudgets[c.id]):BASE_INCOME_BUDGETS[c.id];c.owner=state.incomeCategoryOwners[c.id]||BASE_INCOME_OWNERS[c.id]||"common"});
 state.customIncomeCategories.forEach(c=>{if(!c||!c.id||!c.name)return;INCOME_CATEGORIES.push({...c,name:state.incomeCategoryNames?.[c.id]||c.name,budget:Object.prototype.hasOwnProperty.call(state.incomeBudgets,c.id)?Number(state.incomeBudgets[c.id]):Number(c.budget)||0,owner:state.incomeCategoryOwners[c.id]||c.owner||"common",custom:true})});
 EXPENSE_CATEGORIES.splice(BASE_EXPENSE_COUNT);
 EXPENSE_CATEGORIES.forEach(c=>{c.name=state.categoryNames?.[c.id]||BASE_EXPENSE_NAMES[c.id]||c.name;c.budget=Object.prototype.hasOwnProperty.call(state.categoryBudgets,c.id)?Number(state.categoryBudgets[c.id]):BASE_EXPENSE_BUDGETS[c.id];c.owner=state.categoryOwners[c.id]||BASE_EXPENSE_OWNERS[c.id]||"common"});
 state.customExpenseCategories.forEach(c=>{if(!c||!c.id||!c.name||!["Obligatoires","Abonnements","Vie courante"].includes(c.section))return;EXPENSE_CATEGORIES.push({...c,name:state.categoryNames?.[c.id]||c.name,budget:Object.prototype.hasOwnProperty.call(state.categoryBudgets,c.id)?Number(state.categoryBudgets[c.id]):Number(c.budget)||0,owner:state.categoryOwners[c.id]||c.owner||"common",custom:true})});
}
let state=loadState();
applyCategoryState();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
