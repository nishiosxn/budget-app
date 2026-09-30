// V2.4 — conversion des données Supabase vers l'état local
function cloudCategoriesToLocal(rows,next){
 const idMap=new Map(),ib=[],ic=[],eb=[],ec=[];
 for(const row of rows){
  const localId=row.legacy_id||row.id;
  idMap.set(row.id,localId);
  const c={id:localId,name:row.name,budget:0,owner:slotToOwner(row.owner_slot),createdFrom:String(row.created_from).slice(0,7)};
  if(row.type==="expense"){c.section=row.group_name||"Vie courante";c.saving=!!row.is_saving}
  if(row.is_custom)c.custom=true;
  if(row.type==="income")(row.is_custom?ic:ib).push(c);else(row.is_custom?ec:eb).push(c);
  if(row.archived_at)(row.type==="income"?next.deletedIncomeCategoriesGlobal:next.deletedCategoriesGlobal).push(localId);
  for(const key of row.excluded_months||[]){
   const store=row.type==="income"?next.deletedIncomeCategoryMonths:next.deletedCategoryMonths;
   store[key]=Array.isArray(store[key])?store[key]:[];
   if(!store[key].includes(localId))store[key].push(localId);
  }
 }
 next.baseIncomeCategories=ib;next.customIncomeCategories=ic;
 next.baseExpenseCategories=eb;next.customExpenseCategories=ec;
 return idMap;
}
function applyCloudBudgets(rows,idMap,next){
 const incomeIds=new Set([...next.baseIncomeCategories,...next.customIncomeCategories].map(c=>c.id));
 for(const row of rows.slice().sort((a,b)=>String(a.month).localeCompare(String(b.month)))){
  const localId=idMap.get(row.category_id);if(!localId)continue;
  const store=incomeIds.has(localId)?next.incomePlanChanges:next.expensePlanChanges;
  const rec=store[localId]||(store[localId]={forward:{},month:{}});
  const scope=row.scope==="month"?"month":"forward",key=String(row.month).slice(0,7);
  rec[scope][key]={budget:Number(row.planned_amount)||0,owner:slotToOwner(row.owner_slot)};
 }
}
function cloudTransactionsToLocal(rows,idMap){
 return (rows||[]).map(row=>({
  id:row.legacy_id||row.id,
  type:row.metadata?.type||"expense",
  category:idMap.get(row.category_id)||row.category_id,
  owner:slotToOwner(row.owner_slot),
  amount:Number(row.amount)||0,
  date:String(row.transaction_date).slice(0,10),
  ...(row.label?{label:row.label}:{}),
  ...(row.is_adjustment?{adjustment:true}:{}),
  ...(row.adjustment_label?{adjustmentLabel:row.adjustment_label}:{}),
  ...(row.metadata&&typeof row.metadata==="object"?row.metadata:{})
 }));
}
function cloudRecurrencesToLocal(rows,idMap){
 return (rows||[]).map(row=>{
  const id=row.legacy_id||row.id,key=String(row.start_month).slice(0,7),day=String(Number(row.start_day)||1).padStart(2,"0");
  return {
   id,type:row.metadata?.type||"expense",
   category:idMap.get(row.category_id)||row.category_id,
   owner:slotToOwner(row.owner_slot),amount:Number(row.amount)||0,
   date:key+"-"+day,scope:"forward",seriesId:row.metadata?.seriesId||id,
   excludedMonths:Array.isArray(row.excluded_months)?row.excluded_months:[],
   overrides:row.overrides&&typeof row.overrides==="object"?row.overrides:{},
   ...(row.end_month?{endMonth:String(row.end_month).slice(0,7)}:{}),
   ...(row.label?{label:row.label}:{})
  };
 });
}
