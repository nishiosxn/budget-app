// V2.5 — cache local V5 isolé et reprise non destructive
function neutralBaseCategories(template,createdFrom){
 return template.map(c=>({...cloneData(c),createdFrom:c.createdFrom||createdFrom}));
}
function seedState(){
 const selectedMonth=currentMonthLabel(),createdFrom=monthKey(selectedMonth);
 return {
  schemaVersion:5,
  onboardingComplete:false,
  household:cloneData(DEFAULT_HOUSEHOLD),
  selectedMonth,
  createdMonth:createdFrom,
  transactions:[],
  baseIncomeCategories:neutralBaseCategories(NEUTRAL_INCOME_TEMPLATE,createdFrom),
  baseExpenseCategories:neutralBaseCategories(NEUTRAL_EXPENSE_TEMPLATE,createdFrom),
  categoryBudgets:{},incomeBudgets:{},
  categoryOwners:{},incomeCategoryOwners:{},
  categoryNames:{},incomeCategoryNames:{},
  customExpenseCategories:[],customIncomeCategories:[],
  expensePlanChanges:{},incomePlanChanges:{},
  actualAdjustments:{},incomeActualAdjustments:{},
  deletedCategoryMonths:{},deletedCategoriesGlobal:[],
  deletedIncomeCategoryMonths:{},deletedIncomeCategoriesGlobal:[]
 };
}
function normalizeHousehold(value){
 const v=value&&typeof value==="object"?value:{};
 return {
  name:String(v.name||DEFAULT_HOUSEHOLD.name).trim()||DEFAULT_HOUSEHOLD.name,
  personB:String(v.personB||DEFAULT_HOUSEHOLD.personB).trim()||DEFAULT_HOUSEHOLD.personB,
  personA:String(v.personA||DEFAULT_HOUSEHOLD.personA).trim()||DEFAULT_HOUSEHOLD.personA
 };
}
function normalizeState(x){
 if(!x||typeof x!=="object")return seedState();
 const fallback=seedState();
 x.schemaVersion=5;
 x.onboardingComplete=!!x.onboardingComplete;
 x.household=normalizeHousehold(x.household);
 x.selectedMonth=typeof x.selectedMonth==="string"?x.selectedMonth:fallback.selectedMonth;
 x.createdMonth=typeof x.createdMonth==="string"?x.createdMonth:monthKey(x.selectedMonth);
 x.transactions=Array.isArray(x.transactions)?x.transactions:[];
 x.baseIncomeCategories=Array.isArray(x.baseIncomeCategories)&&x.baseIncomeCategories.length?x.baseIncomeCategories:fallback.baseIncomeCategories;
 x.baseExpenseCategories=Array.isArray(x.baseExpenseCategories)&&x.baseExpenseCategories.length?x.baseExpenseCategories:fallback.baseExpenseCategories;
 x.categoryBudgets=x.categoryBudgets&&typeof x.categoryBudgets==="object"?x.categoryBudgets:{};
 x.incomeBudgets=x.incomeBudgets&&typeof x.incomeBudgets==="object"?x.incomeBudgets:{};
 x.categoryOwners=x.categoryOwners&&typeof x.categoryOwners==="object"?x.categoryOwners:{};
 x.incomeCategoryOwners=x.incomeCategoryOwners&&typeof x.incomeCategoryOwners==="object"?x.incomeCategoryOwners:{};
 x.categoryNames=x.categoryNames&&typeof x.categoryNames==="object"?x.categoryNames:{};
 x.incomeCategoryNames=x.incomeCategoryNames&&typeof x.incomeCategoryNames==="object"?x.incomeCategoryNames:{};
 x.customExpenseCategories=Array.isArray(x.customExpenseCategories)?x.customExpenseCategories:[];
 x.customIncomeCategories=Array.isArray(x.customIncomeCategories)?x.customIncomeCategories:[];
 const creationFallback=(category,type)=>{const keys=x.transactions.filter(t=>t.type===type&&t.category===category).map(t=>String(t.date||"").slice(0,7)).filter(Boolean).sort();return keys[0]||x.createdMonth};
 x.customExpenseCategories=x.customExpenseCategories.map(c=>({...c,createdFrom:c.createdFrom||creationFallback(c.id,"expense")}));
 x.customIncomeCategories=x.customIncomeCategories.map(c=>({...c,createdFrom:c.createdFrom||creationFallback(c.id,"income")}));
 x.expensePlanChanges=x.expensePlanChanges&&typeof x.expensePlanChanges==="object"?x.expensePlanChanges:{};
 x.incomePlanChanges=x.incomePlanChanges&&typeof x.incomePlanChanges==="object"?x.incomePlanChanges:{};
 x.deletedCategoryMonths=x.deletedCategoryMonths&&typeof x.deletedCategoryMonths==="object"?x.deletedCategoryMonths:{};
 x.deletedCategoriesGlobal=Array.isArray(x.deletedCategoriesGlobal)?x.deletedCategoriesGlobal:[];
 x.deletedIncomeCategoryMonths=x.deletedIncomeCategoryMonths&&typeof x.deletedIncomeCategoryMonths==="object"?x.deletedIncomeCategoryMonths:{};
 x.deletedIncomeCategoriesGlobal=Array.isArray(x.deletedIncomeCategoriesGlobal)?x.deletedIncomeCategoriesGlobal:[];
 let migrated=false;
 x.transactions.forEach(t=>{if(t?.scope==="forward"){if(!t.seriesId){t.seriesId=t.id;migrated=true}if(!Array.isArray(t.excludedMonths)){t.excludedMonths=[];migrated=true}if(!t.overrides||typeof t.overrides!=="object"||Array.isArray(t.overrides)){t.overrides={};migrated=true}}});
 [["expense","actualAdjustments"],["income","incomeActualAdjustments"]].forEach(([type,prop])=>{
  const source=x[prop]&&typeof x[prop]==="object"?x[prop]:{};
  Object.entries(source).forEach(([key,items])=>{Object.entries(items||{}).forEach(([category,delta])=>{
   delta=Math.round((Number(delta)||0)*100)/100;if(Math.abs(delta)<.005)return;
   const ownerMap=type==="income"?x.incomeCategoryOwners:x.categoryOwners;
   const baseList=type==="income"?x.baseIncomeCategories:x.baseExpenseCategories;
   const customList=type==="income"?x.customIncomeCategories:x.customExpenseCategories;
   const owner=ownerMap?.[category]||baseList.find(c=>c.id===category)?.owner||customList.find(c=>c.id===category)?.owner||"common";
   x.transactions.push({id:`migration-${type}-${key}-${category}-${uid()}`,type,category,owner,amount:delta,date:`${key}-01`,seed:false,adjustment:true,adjustmentLabel:"Ajustement migré"});migrated=true;
  })});x[prop]={};
 });
 return x;
}
function householdStorageKey(householdId){
 return householdId?`${STORAGE_KEY}:household:${householdId}`:STORAGE_KEY;
}
function preferredHouseholdId(){
 const runtimeId=typeof activeHouseholdId!=="undefined"?activeHouseholdId:null;
 if(runtimeId)return runtimeId;
 const current=localStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
 if(current)return current;
 for(const key of PREVIOUS_ACTIVE_HOUSEHOLD_KEYS||[]){
  const previous=localStorage.getItem(key);
  if(previous){
   localStorage.setItem(ACTIVE_HOUSEHOLD_KEY,previous);
   return previous;
  }
 }
 return null;
}
function currentStorageKey(){
 return householdStorageKey(preferredHouseholdId());
}
function previousHouseholdStorageKeys(householdId){
 return (PREVIOUS_STORAGE_KEYS||[]).map(key=>householdId?key+":household:"+householdId:key);
}
function loadState(){
 try{
  const targetKey=currentStorageKey();
  let raw=localStorage.getItem(targetKey);
  if(!raw){
   const householdId=preferredHouseholdId();
   for(const key of previousHouseholdStorageKeys(householdId)){
    const previous=localStorage.getItem(key);
    if(!previous)continue;
    raw=previous;
    localStorage.setItem(targetKey,previous);
    break;
   }
  }
  if(!raw){
   for(const key of ["budget-foyer-v2.3","budget-foyer-v2.3-preview"]){
    const previous=localStorage.getItem(key);
    if(!previous)continue;
    const migrated=normalizeState(JSON.parse(previous));
    localStorage.setItem(targetKey,JSON.stringify(migrated));
    return migrated;
   }
   return seedState();
  }
  return normalizeState(JSON.parse(raw));
 }catch{return seedState()}
}
function switchHouseholdCache(householdId){
 const key=householdStorageKey(householdId);
 let raw=localStorage.getItem(key);
 if(!raw){
  for(const previousKey of previousHouseholdStorageKeys(householdId)){
   const previous=localStorage.getItem(previousKey);
   if(!previous)continue;
   raw=previous;
   localStorage.setItem(key,previous);
   break;
  }
 }
 state=raw?normalizeState(JSON.parse(raw)):seedState();
 applyCategoryState();
 return !!raw;
}
function applyCategoryState(){
 const baseIncome=Array.isArray(state.baseIncomeCategories)?state.baseIncomeCategories:[];
 INCOME_CATEGORIES.splice(0,INCOME_CATEGORIES.length,...baseIncome.map(c=>({
  ...cloneData(c),
  name:state.incomeCategoryNames?.[c.id]||c.name,
  budget:Object.prototype.hasOwnProperty.call(state.incomeBudgets,c.id)?Number(state.incomeBudgets[c.id]):Number(c.budget)||0,
  owner:state.incomeCategoryOwners?.[c.id]||c.owner||"common"
 })));
 state.customIncomeCategories.forEach(c=>{if(!c||!c.id||!c.name)return;INCOME_CATEGORIES.push({...cloneData(c),name:state.incomeCategoryNames?.[c.id]||c.name,budget:Object.prototype.hasOwnProperty.call(state.incomeBudgets,c.id)?Number(state.incomeBudgets[c.id]):Number(c.budget)||0,owner:state.incomeCategoryOwners?.[c.id]||c.owner||"common",custom:true})});
 const baseExpense=Array.isArray(state.baseExpenseCategories)?state.baseExpenseCategories:[];
 EXPENSE_CATEGORIES.splice(0,EXPENSE_CATEGORIES.length,...baseExpense.map(c=>({
  ...cloneData(c),
  name:state.categoryNames?.[c.id]||c.name,
  budget:Object.prototype.hasOwnProperty.call(state.categoryBudgets,c.id)?Number(state.categoryBudgets[c.id]):Number(c.budget)||0,
  owner:state.categoryOwners?.[c.id]||c.owner||"common"
 })));
 state.customExpenseCategories.forEach(c=>{if(!c||!c.id||!c.name||!["Obligatoires","Abonnements","Vie courante"].includes(c.section))return;EXPENSE_CATEGORIES.push({...cloneData(c),name:state.categoryNames?.[c.id]||c.name,budget:Object.prototype.hasOwnProperty.call(state.categoryBudgets,c.id)?Number(state.categoryBudgets[c.id]):Number(c.budget)||0,owner:state.categoryOwners?.[c.id]||c.owner||"common",custom:true})});
}
let state=loadState();
applyCategoryState();
function saveState(){
 state.schemaVersion=5;
 localStorage.setItem(currentStorageKey(),JSON.stringify(state));
 if(typeof queueCloudSync==="function"&&!(typeof cloudApplyingRemote!=="undefined"&&cloudApplyingRemote))queueCloudSync();
}
