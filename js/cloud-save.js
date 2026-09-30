// V2.5 — sauvegarde locale et délégation au moteur de fusion optimiste
let cloudLastSyncedDigest="";
let cloudPushRequested=false;

function cloudSyncDigest(source=state){
 const snapshot=cloneData(source);
 delete snapshot.selectedMonth;
 return JSON.stringify(snapshot);
}
function cloudPendingKey(){return "budget-foyer-v2.5-cloud-pending:"+(activeHouseholdId||"none")}
function setCloudSyncedBaseline(digest=cloudSyncDigest()){
 cloudLastSyncedDigest=digest;
 if(!activeHouseholdId)return;
 if(cloudSyncDigest()===digest)localStorage.removeItem(cloudPendingKey());
 else localStorage.setItem(cloudPendingKey(),"1");
}
function queueCloudSync(){
 if(!cloudSession||!activeHouseholdId||!cloudSyncReady)return;
 const digest=cloudSyncDigest();
 if(digest===cloudLastSyncedDigest)return;
 localStorage.setItem(cloudPendingKey(),"1");
 clearTimeout(cloudPushTimer);
 if(typeof cloudSyncConflict!=="undefined"&&cloudSyncConflict){
  setCloudStatus("Conflit de synchronisation · action requise","error");
  return;
 }
 setCloudStatus(navigator.onLine?"Modification en attente…":"Hors ligne · modification conservée","offline");
 cloudPushTimer=setTimeout(()=>cloudPushLocalState().catch(error=>{
  if(error?.code!=="CLOUD_SYNC_CONFLICT")console.error("Cloud push",error);
 }),650);
}
function cloudLocalCategories(source=state){
 const rows=[];
 const collect=(list,type,isCustom)=>list.forEach((category,index)=>{
  const names=type==="income"?source.incomeCategoryNames:source.categoryNames;
  const owners=type==="income"?source.incomeCategoryOwners:source.categoryOwners;
  const monthDeletes=type==="income"?source.deletedIncomeCategoryMonths:source.deletedCategoryMonths;
  const globalDeletes=type==="income"?source.deletedIncomeCategoriesGlobal:source.deletedCategoriesGlobal;
  const excluded=Object.entries(monthDeletes||{}).filter(([,ids])=>Array.isArray(ids)&&ids.includes(category.id)).map(([key])=>key).sort();
  rows.push({
   local_id:category.id,
   name:names?.[category.id]||category.name,
   type,
   group_name:type==="expense"?(category.section||"Vie courante"):null,
   owner_slot:ownerToSlot(owners?.[category.id]||category.owner),
   is_saving:type==="expense"&&!!category.saving,
   created_from:cloudMonthDate(category.createdFrom||source.createdMonth||monthKey(source.selectedMonth)),
   excluded_months:excluded,
   is_custom:!!isCustom,
   sort_order:index,
   archived:globalDeletes?.includes(category.id)||false,
   category
  });
 });
 collect(source.baseIncomeCategories||[],"income",false);
 collect(source.customIncomeCategories||[],"income",true);
 collect(source.baseExpenseCategories||[],"expense",false);
 collect(source.customExpenseCategories||[],"expense",true);
 return rows;
}
function cloudRequireCategoryId(idMap,localId){
 const id=idMap.get(localId);
 if(!id)throw new Error(`Catégorie cloud introuvable : ${localId}`);
 return id;
}
async function cloudSyncCategories(source=state){
 const desired=cloudLocalCategories(source);
 const existingRes=await cloudClient.from("categories").select("id,legacy_id,archived_at").eq("household_id",activeHouseholdId);
 if(existingRes.error)throw existingRes.error;
 const existing=existingRes.data||[],byLocal=new Map(existing.map(row=>[row.legacy_id||row.id,row]));
 const now=new Date().toISOString(),updates=[],inserts=[];
 for(const item of desired){
  const old=byLocal.get(item.local_id);
  const row={
   household_id:activeHouseholdId,legacy_id:item.local_id,name:item.name,type:item.type,
   group_name:item.group_name,owner_user_id:null,owner_slot:item.owner_slot,
   is_saving:item.is_saving,created_from:item.created_from,excluded_months:item.excluded_months,
   is_custom:item.is_custom,sort_order:item.sort_order,archived_at:item.archived?(old?.archived_at||now):null
  };
  if(old){
   const {household_id,legacy_id,created_from,...mutable}=row;
   updates.push({id:old.id,values:mutable});
  }else inserts.push(row);
 }
 if(updates.length){
  const results=await Promise.all(updates.map(item=>cloudClient.from("categories").update(item.values).eq("id",item.id)));
  const failed=results.find(result=>result.error);if(failed)throw failed.error;
 }
 if(inserts.length){const res=await cloudClient.from("categories").insert(inserts);if(res.error)throw res.error}
 const desiredIds=new Set(desired.map(item=>item.local_id));
 const obsolete=existing.filter(row=>!desiredIds.has(row.legacy_id||row.id)&&!row.archived_at).map(row=>row.id);
 if(obsolete.length){const res=await cloudClient.from("categories").update({archived_at:now}).in("id",obsolete);if(res.error)throw res.error}
 const refreshed=await cloudClient.from("categories").select("id,legacy_id").eq("household_id",activeHouseholdId);
 if(refreshed.error)throw refreshed.error;
 return new Map((refreshed.data||[]).map(row=>[row.legacy_id||row.id,row.id]));
}
function cloudBudgetRows(idMap,source=state){
 const result=new Map();
 for(const item of cloudLocalCategories(source)){
  const category=item.category,type=item.type;
  const budgetMap=type==="income"?source.incomeBudgets:source.categoryBudgets;
  const ownerMap=type==="income"?source.incomeCategoryOwners:source.categoryOwners;
  const plans=type==="income"?source.incomePlanChanges:source.expensePlanChanges;
  const baseline={
   household_id:activeHouseholdId,category_id:cloudRequireCategoryId(idMap,item.local_id),
   month:item.created_from,planned_amount:Number(Object.prototype.hasOwnProperty.call(budgetMap||{},item.local_id)?budgetMap[item.local_id]:category.budget)||0,
   scope:"forward",owner_slot:ownerToSlot(ownerMap?.[item.local_id]||category.owner),archived_at:null
  };
  result.set(`${item.local_id}|${item.created_from}`,baseline);
  const record=plans?.[item.local_id]||{};
  for(const [scope,values] of [["forward",record.forward||{}],["month",record.month||{}]])for(const [key,value] of Object.entries(values)){
   const month=cloudMonthDate(key);if(!month)continue;
   result.set(`${item.local_id}|${month}`,{
    household_id:activeHouseholdId,category_id:baseline.category_id,month,
    planned_amount:Math.max(0,Number(value?.budget)||0),scope,
    owner_slot:ownerToSlot(value?.owner),archived_at:null
   });
  }
 }
 return [...result.values()];
}
async function cloudSyncBudgets(idMap,source=state){
 const desired=cloudBudgetRows(idMap,source),existingRes=await cloudClient.from("budgets").select("id,category_id,month,archived_at").eq("household_id",activeHouseholdId);
 if(existingRes.error)throw existingRes.error;
 const existing=existingRes.data||[],byKey=new Map(existing.map(row=>[`${row.category_id}|${String(row.month).slice(0,10)}`,row]));
 const inserts=[],updates=[];
 for(const row of desired){
  const key=`${row.category_id}|${String(row.month).slice(0,10)}`,old=byKey.get(key);
  if(old)updates.push({id:old.id,values:{planned_amount:row.planned_amount,scope:row.scope,owner_slot:row.owner_slot,archived_at:null}});
  else inserts.push(row);
 }
 if(inserts.length){const res=await cloudClient.from("budgets").insert(inserts);if(res.error)throw res.error}
 if(updates.length){
  const results=await Promise.all(updates.map(item=>cloudClient.from("budgets").update(item.values).eq("id",item.id)));
  const failed=results.find(result=>result.error);if(failed)throw failed.error;
 }
 const keys=new Set(desired.map(row=>`${row.category_id}|${String(row.month).slice(0,10)}`));
 const obsolete=existing.filter(row=>!keys.has(`${row.category_id}|${String(row.month).slice(0,10)}`)&&!row.archived_at).map(row=>row.id);
 if(obsolete.length){const res=await cloudClient.from("budgets").update({archived_at:new Date().toISOString()}).in("id",obsolete);if(res.error)throw res.error}
}
function cloudMetadata(item,excluded){
 const metadata={};
 for(const [key,value] of Object.entries(item))if(!excluded.has(key)&&value!==undefined)metadata[key]=cloneData(value);
 metadata.type=item.type;
 return metadata;
}
async function cloudSyncLegacyRows(table,items,buildRow){
 const existingRes=await cloudClient.from(table).select("id,legacy_id,archived_at").eq("household_id",activeHouseholdId);
 if(existingRes.error)throw existingRes.error;
 const existing=existingRes.data||[],byLocal=new Map(existing.map(row=>[row.legacy_id||row.id,row]));
 const updates=[],inserts=[];
 for(const item of items){
  const old=byLocal.get(item.id),row=buildRow(item);
  if(old){const {household_id,legacy_id,...mutable}=row;updates.push({id:old.id,values:mutable})}
  else inserts.push(row);
 }
 if(updates.length){
  const results=await Promise.all(updates.map(item=>cloudClient.from(table).update(item.values).eq("id",item.id)));
  const failed=results.find(result=>result.error);if(failed)throw failed.error;
 }
 if(inserts.length){const res=await cloudClient.from(table).insert(inserts);if(res.error)throw res.error}
 const desiredIds=new Set(items.map(item=>item.id));
 const obsolete=existing.filter(row=>!desiredIds.has(row.legacy_id||row.id)&&!row.archived_at).map(row=>row.id);
 if(obsolete.length){const res=await cloudClient.from(table).update({archived_at:new Date().toISOString()}).in("id",obsolete);if(res.error)throw res.error}
}
async function cloudSyncRecurrences(idMap,source=state){
 const items=(source.transactions||[]).filter(item=>item.scope==="forward");
 const excluded=new Set(["id","type","category","owner","amount","date","label","scope","seriesId","excludedMonths","overrides","endMonth"]);
 await cloudSyncLegacyRows("recurrences",items,item=>({
  household_id:activeHouseholdId,category_id:cloudRequireCategoryId(idMap,item.category),legacy_id:item.id,
  amount:Number(item.amount)||0,label:item.label||null,owner_user_id:null,owner_slot:ownerToSlot(item.owner),
  start_month:cloudMonthDate(String(item.date||"").slice(0,7)),start_day:Math.max(1,Math.min(31,Number(String(item.date||"").slice(8,10))||1)),
  end_month:item.endMonth?cloudMonthDate(item.endMonth):null,excluded_months:Array.isArray(item.excludedMonths)?item.excludedMonths:[],
  overrides:item.overrides&&typeof item.overrides==="object"?item.overrides:{},metadata:{...cloudMetadata(item,excluded),seriesId:item.seriesId||item.id},archived_at:null
 }));
}
async function cloudSyncTransactions(idMap,source=state){
 const items=(source.transactions||[]).filter(item=>item.scope!=="forward");
 const excluded=new Set(["id","type","category","owner","amount","date","label","adjustment","adjustmentLabel"]);
 await cloudSyncLegacyRows("transactions",items,item=>({
  household_id:activeHouseholdId,category_id:cloudRequireCategoryId(idMap,item.category),legacy_id:item.id,
  amount:Number(item.amount)||0,transaction_date:String(item.date||"").slice(0,10),label:item.label||null,
  owner_user_id:null,owner_slot:ownerToSlot(item.owner),recurrence_id:null,is_adjustment:!!item.adjustment,
  adjustment_label:item.adjustmentLabel||null,metadata:cloudMetadata(item,excluded),archived_at:null
 }));
}
async function cloudPushLocalState({force=false}={}){
 if(typeof cloudPushLocalStateV25==="function")return cloudPushLocalStateV25({force});
 if(!cloudSession||!activeHouseholdId)return;
 if(cloudPushInProgress){cloudPushRequested=true;return}
 const snapshot=cloneData(state),digest=cloudSyncDigest(snapshot);
 if(!force&&digest===cloudLastSyncedDigest){localStorage.removeItem(cloudPendingKey());return}
 if(!navigator.onLine){setCloudStatus("Hors ligne · modification conservée","offline");return}
 cloudPushInProgress=true;cloudPushRequested=false;setCloudStatus("Synchronisation…","syncing");
 try{
  cloudIgnoreRealtimeUntil=Date.now()+5000;
  if(activeMembership?.role==="owner"){
   const household=normalizeHousehold(snapshot.household);
   const householdRes=await cloudClient.from("households").update({name:household.name,person_b_label:household.personB,person_a_label:household.personA}).eq("id",activeHouseholdId);
   if(householdRes.error)throw householdRes.error;
  }
  const idMap=await cloudSyncCategories(snapshot);
  await cloudSyncBudgets(idMap,snapshot);
  await cloudSyncRecurrences(idMap,snapshot);
  await cloudSyncTransactions(idMap,snapshot);
  setCloudSyncedBaseline(digest);
  if(cloudSyncDigest()===digest)setCloudStatus("Synchronisé","ok");
  else{cloudPushRequested=true;setCloudStatus("Modification en attente…","offline")}
 }catch(error){
  localStorage.setItem(cloudPendingKey(),"1");
  setCloudStatus("Échec · données gardées localement","error");
  throw error;
 }finally{
  cloudPushInProgress=false;
  if(cloudPushRequested){cloudPushRequested=false;queueCloudSync()}
 }
}

window.addEventListener("online",()=>{
 if(cloudSession&&!cloudSyncReady){requestCloudBootstrap().catch(error=>console.error("Cloud reconnect bootstrap",error));return}
 if(cloudSyncReady){setCloudStatus("Reconnexion…","syncing");cloudPushLocalState().catch(error=>console.error("Cloud reconnect",error))}
});
window.addEventListener("offline",()=>setCloudStatus("Hors ligne · cache local","offline"));
