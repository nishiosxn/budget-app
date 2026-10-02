// V2.5.1 — fusion optimiste en mémoire, sans cache local persistant
const CLOUD_SYNC_BASELINE_VERSION=1;
const CLOUD_SYNC_TABLES=["households","categories","budgets","transactions","recurrences"];
let cloudSyncConflict=null;
let cloudSyncBaselineMemory=null;

function cloudStableValue(value){
 if(Array.isArray(value))return value.map(cloudStableValue);
 if(value&&typeof value==="object"){
  const out={};
  for(const key of Object.keys(value).sort())out[key]=cloudStableValue(value[key]);
  return out;
 }
 return value===undefined?null:value;
}
function cloudSameValue(a,b){
 return JSON.stringify(cloudStableValue(a))===JSON.stringify(cloudStableValue(b));
}
function cloudPlainObject(value){
 return !!value&&typeof value==="object"&&!Array.isArray(value);
}
function cloudPayload(entry){
 return entry?entry.payload:null;
}
function cloudRemoteEntry(row,payload){
 return {id:row.id,updatedAt:row.updated_at||null,payload};
}
function cloudActiveCount(snapshot){
 let count=0;
 for(const table of ["categories","budgets","transactions","recurrences"]){
  for(const entry of snapshot.tables[table].values())if(entry.payload!==null)count++;
 }
 return count;
}

function cloudBuildLocalSnapshot(source=state){
 const tables={
  households:new Map(),
  categories:new Map(),
  budgets:new Map(),
  transactions:new Map(),
  recurrences:new Map()
 };
 const household=normalizeHousehold(source.household);
 tables.households.set("household",{payload:{
  name:household.name,
  person_b_label:household.personB,
  person_a_label:household.personA
 }});

 const categoryItems=cloudLocalCategories(source);
 for(const item of categoryItems){
  if(item.archived)continue;
  tables.categories.set(item.local_id,{payload:{
   name:item.name,
   type:item.type,
   group_name:item.group_name,
   owner_slot:item.owner_slot,
   is_saving:!!item.is_saving,
   created_from:String(item.created_from||"").slice(0,10),
   excluded_months:[...(item.excluded_months||[])].sort(),
   is_custom:!!item.is_custom,
   sort_order:Number(item.sort_order)||0
  }});
 }

 const activeCategories=categoryItems.filter(item=>!item.archived);
 for(const item of activeCategories){
  const category=item.category,type=item.type;
  const budgetMap=type==="income"?source.incomeBudgets:source.categoryBudgets;
  const ownerMap=type==="income"?source.incomeCategoryOwners:source.categoryOwners;
  const plans=type==="income"?source.incomePlanChanges:source.expensePlanChanges;
  const baseline={
   category_local_id:item.local_id,
   month:String(item.created_from||"").slice(0,10),
   planned_amount:Number(Object.prototype.hasOwnProperty.call(budgetMap||{},item.local_id)?budgetMap[item.local_id]:category.budget)||0,
   scope:"forward",
   owner_slot:ownerToSlot(ownerMap?.[item.local_id]||category.owner)
  };
  tables.budgets.set(item.local_id+"|"+baseline.month,{payload:baseline});
  const record=plans?.[item.local_id]||{};
  for(const pair of [["forward",record.forward||{}],["month",record.month||{}]]){
   const scope=pair[0],values=pair[1];
   for(const [key,value] of Object.entries(values)){
    const month=cloudMonthDate(key);if(!month)continue;
    const payload={
     category_local_id:item.local_id,
     month,
     planned_amount:Math.max(0,Number(value?.budget)||0),
     scope,
     owner_slot:ownerToSlot(value?.owner)
    };
    tables.budgets.set(item.local_id+"|"+month,{payload});
   }
  }
 }

 const txExcluded=new Set(["id","type","category","owner","amount","date","label","adjustment","adjustmentLabel"]);
 const recurrenceExcluded=new Set(["id","type","category","owner","amount","date","label","scope","seriesId","excludedMonths","overrides","endMonth"]);
 for(const item of source.transactions||[]){
  if(item.scope==="forward"){
   const key=item.id;
   tables.recurrences.set(key,{payload:{
    category_local_id:item.category,
    amount:Number(item.amount)||0,
    label:item.label||null,
    owner_slot:ownerToSlot(item.owner),
    start_month:cloudMonthDate(String(item.date||"").slice(0,7)),
    start_day:Math.max(1,Math.min(31,Number(String(item.date||"").slice(8,10))||1)),
    end_month:item.endMonth?cloudMonthDate(item.endMonth):null,
    excluded_months:Array.isArray(item.excludedMonths)?[...item.excludedMonths].sort():[],
    overrides:item.overrides&&typeof item.overrides==="object"&&!Array.isArray(item.overrides)?cloneData(item.overrides):{},
    metadata:{...cloudMetadata(item,recurrenceExcluded),seriesId:item.seriesId||item.id}
   }});
  }else{
   tables.transactions.set(item.id,{payload:{
    category_local_id:item.category,
    amount:Number(item.amount)||0,
    transaction_date:String(item.date||"").slice(0,10),
    label:item.label||null,
    owner_slot:ownerToSlot(item.owner),
    recurrence_id:null,
    is_adjustment:!!item.adjustment,
    adjustment_label:item.adjustmentLabel||null,
    metadata:cloudMetadata(item,txExcluded)
   }});
  }
 }
 return {tables};
}

function cloudBuildRemoteSnapshot(rows){
 const tables={
  households:new Map(),
  categories:new Map(),
  budgets:new Map(),
  transactions:new Map(),
  recurrences:new Map()
 };
 const household=rows.household;
 if(household)tables.households.set("household",cloudRemoteEntry(household,{
  name:household.name,
  person_b_label:household.person_b_label,
  person_a_label:household.person_a_label
 }));

 const categoryUuidToLocal=new Map();
 const categoryLocalToUuid=new Map();
 for(const row of rows.categories||[]){
  const localId=row.legacy_id||row.id;
  categoryUuidToLocal.set(row.id,localId);
  categoryLocalToUuid.set(localId,row.id);
  const payload=row.archived_at?null:{
   name:row.name,
   type:row.type,
   group_name:row.group_name||null,
   owner_slot:row.owner_slot||null,
   is_saving:!!row.is_saving,
   created_from:String(row.created_from||"").slice(0,10),
   excluded_months:Array.isArray(row.excluded_months)?[...row.excluded_months].sort():[],
   is_custom:!!row.is_custom,
   sort_order:Number(row.sort_order)||0
  };
  tables.categories.set(localId,cloudRemoteEntry(row,payload));
 }
 for(const row of rows.budgets||[]){
  const localId=categoryUuidToLocal.get(row.category_id);if(!localId)continue;
  const month=String(row.month||"").slice(0,10);
  const payload=row.archived_at?null:{
   category_local_id:localId,
   month,
   planned_amount:Number(row.planned_amount)||0,
   scope:row.scope==="month"?"month":"forward",
   owner_slot:row.owner_slot||null
  };
  tables.budgets.set(localId+"|"+month,cloudRemoteEntry(row,payload));
 }
 for(const row of rows.transactions||[]){
  const localId=categoryUuidToLocal.get(row.category_id);if(!localId)continue;
  const metadata=row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?cloneData(row.metadata):{};
  const payload=row.archived_at?null:{
   category_local_id:localId,
   amount:Number(row.amount)||0,
   transaction_date:String(row.transaction_date||"").slice(0,10),
   label:row.label||null,
   owner_slot:row.owner_slot||null,
   recurrence_id:null,
   is_adjustment:!!row.is_adjustment,
   adjustment_label:row.adjustment_label||null,
   metadata
  };
  tables.transactions.set(row.legacy_id||row.id,cloudRemoteEntry(row,payload));
 }
 for(const row of rows.recurrences||[]){
  const localId=categoryUuidToLocal.get(row.category_id);if(!localId)continue;
  const metadata=row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?cloneData(row.metadata):{};
  const payload=row.archived_at?null:{
   category_local_id:localId,
   amount:Number(row.amount)||0,
   label:row.label||null,
   owner_slot:row.owner_slot||null,
   start_month:String(row.start_month||"").slice(0,10),
   start_day:Math.max(1,Math.min(31,Number(row.start_day)||1)),
   end_month:row.end_month?String(row.end_month).slice(0,10):null,
   excluded_months:Array.isArray(row.excluded_months)?[...row.excluded_months].sort():[],
   overrides:row.overrides&&typeof row.overrides==="object"&&!Array.isArray(row.overrides)?cloneData(row.overrides):{},
   metadata
  };
  tables.recurrences.set(row.legacy_id||row.id,cloudRemoteEntry(row,payload));
 }
 return {tables,categoryUuidToLocal,categoryLocalToUuid};
}

async function cloudFetchRemoteSyncSnapshot(){
 if(!activeHouseholdId)throw new Error("Aucun foyer actif.");
 const requests=[
  cloudClient.from("households").select("*").eq("id",activeHouseholdId).single(),
  cloudClient.from("categories").select("*").eq("household_id",activeHouseholdId),
  cloudClient.from("budgets").select("*").eq("household_id",activeHouseholdId),
  cloudClient.from("transactions").select("*").eq("household_id",activeHouseholdId),
  cloudClient.from("recurrences").select("*").eq("household_id",activeHouseholdId)
 ];
 const results=await Promise.all(requests);
 for(const result of results)if(result.error)throw result.error;
 return cloudBuildRemoteSnapshot({
  household:results[0].data,
  categories:results[1].data||[],
  budgets:results[2].data||[],
  transactions:results[3].data||[],
  recurrences:results[4].data||[]
 });
}

function cloudBaselineFromRemote(remote){
 const tables={};
 for(const table of CLOUD_SYNC_TABLES){
  tables[table]={};
  for(const [key,entry] of remote.tables[table])tables[table][key]={
   id:entry.id,
   updatedAt:entry.updatedAt,
   payload:cloneData(entry.payload)
  };
 }
 return {version:CLOUD_SYNC_BASELINE_VERSION,householdId:activeHouseholdId,capturedAt:new Date().toISOString(),tables};
}
function cloudReadSyncBaseline(){
 if(!activeHouseholdId||!cloudSyncBaselineMemory)return null;
 if(cloudSyncBaselineMemory.version!==CLOUD_SYNC_BASELINE_VERSION||cloudSyncBaselineMemory.householdId!==activeHouseholdId)return null;
 return cloudSyncBaselineMemory;
}
function cloudWriteSyncBaseline(remote){
 if(!activeHouseholdId)return;
 cloudSyncBaselineMemory=cloudBaselineFromRemote(remote);
}
function cloudCaptureRemoteBaseline(rowsOrSnapshot){
 const remote=rowsOrSnapshot?.tables?rowsOrSnapshot:cloudBuildRemoteSnapshot(rowsOrSnapshot);
 cloudWriteSyncBaseline(remote);
 return remote;
}
function cloudBaselineEntry(baseline,table,key){
 return baseline?.tables?.[table]?.[key]||null;
}

function cloudMergeKnownPayload(base,local,remote,preference,table,key){
 const conflicts=[];
 if(cloudSameValue(local,remote))return {value:cloneData(local),conflicts};
 const localChanged=!cloudSameValue(local,base);
 const remoteChanged=!cloudSameValue(remote,base);
 if(!localChanged)return {value:cloneData(remote),conflicts};
 if(!remoteChanged)return {value:cloneData(local),conflicts};

 if(cloudPlainObject(base)&&cloudPlainObject(local)&&cloudPlainObject(remote)){
  const value={};
  const keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]);
  for(const field of keys){
   const b=Object.prototype.hasOwnProperty.call(base,field)?base[field]:null;
   const l=Object.prototype.hasOwnProperty.call(local,field)?local[field]:null;
   const r=Object.prototype.hasOwnProperty.call(remote,field)?remote[field]:null;
   const lc=!cloudSameValue(l,b),rc=!cloudSameValue(r,b);
   if(lc&&rc&&!cloudSameValue(l,r)){
    conflicts.push({table,key,field});
    value[field]=cloneData(preference==="local"?l:r);
   }else if(lc)value[field]=cloneData(l);
   else value[field]=cloneData(r);
  }
  return {value,conflicts};
 }

 conflicts.push({table,key,field:null});
 return {value:cloneData(preference==="local"?local:remote),conflicts};
}
function cloudMergeUnknownPayload(localEntry,remoteEntry,preference,table,key){
 const local=cloudPayload(localEntry),remote=cloudPayload(remoteEntry);
 const conflicts=[];
 if(cloudSameValue(local,remote))return {value:cloneData(remote),conflicts};
 if(!remoteEntry&&local!==null)return {value:cloneData(local),conflicts};
 if(local===null&&remote!==null)return {value:cloneData(remote),conflicts};
 if(local===null&&remote===null)return {value:null,conflicts};
 conflicts.push({table,key,field:null,bootstrap:true});
 return {value:cloneData(preference==="local"?local:remote),conflicts};
}

function cloudBuildSyncPlan(local,remote,baseline,preference=null){
 const mutations=[];
 const conflicts=[];
 for(const table of CLOUD_SYNC_TABLES){
  const localMap=local.tables[table],remoteMap=remote.tables[table];
  const baseMap=baseline?.tables?.[table]||{};
  const keys=new Set([...Object.keys(baseMap),...localMap.keys(),...remoteMap.keys()]);
  for(const key of keys){
   const localEntry=localMap.get(key)||null;
   const remoteEntry=remoteMap.get(key)||null;
   const baseEntry=baseMap[key]||null;
   const merged=baseEntry
    ?cloudMergeKnownPayload(baseEntry.payload,cloudPayload(localEntry),cloudPayload(remoteEntry),preference,table,key)
    :cloudMergeUnknownPayload(localEntry,remoteEntry,preference,table,key);
   conflicts.push(...merged.conflicts);
   if(cloudSameValue(merged.value,cloudPayload(remoteEntry)))continue;
   if(table==="households"){
    if(merged.value!==null)mutations.push({table,key,action:"update",payload:merged.value,remote:remoteEntry});
    continue;
   }
   if(merged.value===null){
    if(remoteEntry&&remoteEntry.payload!==null)mutations.push({table,key,action:"archive",payload:null,remote:remoteEntry});
   }else if(remoteEntry){
    mutations.push({table,key,action:"update",payload:merged.value,remote:remoteEntry});
   }else{
    mutations.push({table,key,action:"insert",payload:merged.value,remote:null});
   }
  }
 }
 return {mutations,conflicts};
}

function cloudSnapshotsSame(local,remote){
 for(const table of CLOUD_SYNC_TABLES){
  const keys=new Set([...local.tables[table].keys(),...remote.tables[table].keys()]);
  for(const key of keys)if(!cloudSameValue(cloudPayload(local.tables[table].get(key)),cloudPayload(remote.tables[table].get(key))))return false;
 }
 return true;
}

function cloudConflictError(conflicts){
 const error=new Error("Conflit de synchronisation");
 error.code="CLOUD_SYNC_CONFLICT";
 error.conflicts=conflicts||[];
 return error;
}
function cloudRaceError(table,key){
 const error=new Error("La donnée distante a changé pendant la synchronisation.");
 error.code="CLOUD_SYNC_RACE";
 error.table=table;
 error.key=key;
 return error;
}
function cloudSetConflict(conflicts){
 cloudSyncConflict={conflicts:conflicts||[],at:new Date().toISOString()};
 cloudUnsyncedSession=true;
 setCloudStatus("Conflit de synchronisation","error");
 cloudRenderConflictUi();
}
function cloudClearConflict(){
 cloudSyncConflict=null;
 cloudRenderConflictUi();
}
function cloudRenderConflictUi(){
 if(typeof document==="undefined")return;
 const card=document.getElementById("cloudConflictCard");
 const detail=document.getElementById("cloudConflictDetail");
 if(!card)return;
 card.hidden=!cloudSyncConflict;
 if(detail&&cloudSyncConflict){
  const count=cloudSyncConflict.conflicts.length;
  detail.textContent=count
   ?count+" modification"+(count>1?"s":"")+" touche"+(count>1?"nt":"")+" la même donnée sur plusieurs appareils."
   :"Des modifications locales et distantes doivent être réconciliées.";
 }
}

async function cloudGuardedUpdate(table,entry,values,key){
 let query=cloudClient.from(table).update(values).eq("id",entry.id);
 if(entry.updatedAt)query=query.eq("updated_at",entry.updatedAt);
 const result=await query.select("id,updated_at");
 if(result.error)throw result.error;
 if(!result.data?.length)throw cloudRaceError(table,key);
 return result.data[0];
}
async function cloudInsertRow(table,row,key){
 const result=await cloudClient.from(table).insert(row).select("id,updated_at");
 if(result.error){
  if(result.error.code==="23505")throw cloudRaceError(table,key);
  throw result.error;
 }
 return result.data?.[0]||null;
}
async function cloudFetchCategoryUuidMap(){
 const result=await cloudClient.from("categories").select("id,legacy_id").eq("household_id",activeHouseholdId);
 if(result.error)throw result.error;
 return new Map((result.data||[]).map(row=>[row.legacy_id||row.id,row.id]));
}
function cloudRequireUuid(categoryMap,localId){
 const id=categoryMap.get(localId);
 if(!id)throw new Error("Catégorie cloud introuvable : "+localId);
 return id;
}

function cloudCategoryValues(payload,insert=false){
 const values={
  name:payload.name,type:payload.type,group_name:payload.group_name||null,
  owner_user_id:null,owner_slot:payload.owner_slot||null,is_saving:!!payload.is_saving,
  excluded_months:payload.excluded_months||[],is_custom:!!payload.is_custom,
  sort_order:Number(payload.sort_order)||0,archived_at:null
 };
 if(insert)values.created_from=payload.created_from;
 return values;
}
function cloudBudgetValues(payload,categoryMap,insert=false){
 const values={
  planned_amount:Number(payload.planned_amount)||0,
  scope:payload.scope==="month"?"month":"forward",
  owner_slot:payload.owner_slot||null,
  archived_at:null
 };
 if(insert){
  values.category_id=cloudRequireUuid(categoryMap,payload.category_local_id);
  values.month=payload.month;
 }
 return values;
}
function cloudTransactionValues(payload,categoryMap,insert=false){
 const values={
  category_id:cloudRequireUuid(categoryMap,payload.category_local_id),
  amount:Number(payload.amount)||0,
  transaction_date:payload.transaction_date,
  label:payload.label||null,
  owner_user_id:null,
  owner_slot:payload.owner_slot||null,
  recurrence_id:null,
  is_adjustment:!!payload.is_adjustment,
  adjustment_label:payload.adjustment_label||null,
  metadata:payload.metadata||{},
  archived_at:null
 };
 return values;
}
function cloudRecurrenceValues(payload,categoryMap,insert=false){
 return {
  category_id:cloudRequireUuid(categoryMap,payload.category_local_id),
  amount:Number(payload.amount)||0,
  label:payload.label||null,
  owner_user_id:null,
  owner_slot:payload.owner_slot||null,
  start_month:payload.start_month,
  start_day:Math.max(1,Math.min(31,Number(payload.start_day)||1)),
  end_month:payload.end_month||null,
  excluded_months:payload.excluded_months||[],
  overrides:payload.overrides||{},
  metadata:payload.metadata||{},
  archived_at:null
 };
}

async function cloudApplyMutation(mutation,categoryMap){
 const table=mutation.table,key=mutation.key,entry=mutation.remote;
 if(mutation.action==="archive"){
  return cloudGuardedUpdate(table,entry,{archived_at:new Date().toISOString()},key);
 }
 if(table==="households"){
  if(activeMembership?.role!=="owner")return;
  return cloudGuardedUpdate(table,entry,{
   name:mutation.payload.name,
   person_b_label:mutation.payload.person_b_label,
   person_a_label:mutation.payload.person_a_label
  },key);
 }
 if(table==="categories"){
  if(mutation.action==="insert")return cloudInsertRow(table,{
   household_id:activeHouseholdId,
   legacy_id:key,
   ...cloudCategoryValues(mutation.payload,true)
  },key);
  return cloudGuardedUpdate(table,entry,cloudCategoryValues(mutation.payload,false),key);
 }
 if(table==="budgets"){
  if(mutation.action==="insert")return cloudInsertRow(table,{
   household_id:activeHouseholdId,
   ...cloudBudgetValues(mutation.payload,categoryMap,true)
  },key);
  return cloudGuardedUpdate(table,entry,cloudBudgetValues(mutation.payload,categoryMap,false),key);
 }
 if(table==="transactions"){
  if(mutation.action==="insert")return cloudInsertRow(table,{
   household_id:activeHouseholdId,
   legacy_id:key,
   ...cloudTransactionValues(mutation.payload,categoryMap,true)
  },key);
  return cloudGuardedUpdate(table,entry,cloudTransactionValues(mutation.payload,categoryMap,false),key);
 }
 if(table==="recurrences"){
  if(mutation.action==="insert")return cloudInsertRow(table,{
   household_id:activeHouseholdId,
   legacy_id:key,
   ...cloudRecurrenceValues(mutation.payload,categoryMap,true)
  },key);
  return cloudGuardedUpdate(table,entry,cloudRecurrenceValues(mutation.payload,categoryMap,false),key);
 }
}
async function cloudApplySyncPlan(plan){
 const householdMutations=plan.mutations.filter(m=>m.table==="households");
 const categoryMutations=plan.mutations.filter(m=>m.table==="categories");
 const otherMutations=plan.mutations.filter(m=>!["households","categories"].includes(m.table));
 for(const mutation of householdMutations)await cloudApplyMutation(mutation,new Map());
 for(const mutation of categoryMutations)await cloudApplyMutation(mutation,new Map());
 const categoryMap=await cloudFetchCategoryUuidMap();
 for(const mutation of otherMutations)await cloudApplyMutation(mutation,categoryMap);
}

async function cloudPushLocalStateV25({force=false,conflictPreference=null}={}){
 if(!cloudSession||!activeHouseholdId)return;
 if(cloudPushInProgress){cloudPushRequested=true;return}
 const source=cloneData(state),digest=cloudSyncDigest(source);
 if(!force&&!conflictPreference&&digest===cloudLastSyncedDigest&&!cloudUnsyncedSession)return;
 if(!navigator.onLine){
  cloudUnsyncedSession=true;
  setCloudStatus("Connexion perdue · réessayer","error");
  return;
 }

 cloudPushInProgress=true;
 cloudPushRequested=false;
 setCloudStatus(conflictPreference?"Résolution du conflit…":"Synchronisation…","syncing");
 try{
  cloudIgnoreRealtimeUntil=Date.now()+5000;
  const local=cloudBuildLocalSnapshot(source);
  const remote=await cloudFetchRemoteSyncSnapshot();
  let baseline=cloudReadSyncBaseline();

  if(!baseline){
   if(cloudSnapshotsSame(local,remote)){
    cloudWriteSyncBaseline(remote);
    setCloudSyncedBaseline(digest);
    cloudClearConflict();
    setCloudStatus("Synchronisé","ok");
    return;
   }
   if(cloudActiveCount(remote)===0||conflictPreference==="local"){
    baseline=cloudBaselineFromRemote(remote);
   }else if(conflictPreference==="remote"){
    cloudClearConflict();
    await cloudLoadState();
    cloudUnsyncedSession=false;
    return;
   }else{
    const conflicts=[{table:"bootstrap",key:"baseline",field:null,bootstrap:true}];
    cloudSetConflict(conflicts);
    throw cloudConflictError(conflicts);
   }
  }

  const plan=cloudBuildSyncPlan(local,remote,baseline,conflictPreference);
  if(plan.conflicts.length&&!conflictPreference){
   cloudSetConflict(plan.conflicts);
   throw cloudConflictError(plan.conflicts);
  }

  await cloudApplySyncPlan(plan);
  cloudClearConflict();
  await cloudLoadState();
  cloudUnsyncedSession=false;
  setCloudStatus("Synchronisé","ok");
 }catch(error){
  cloudUnsyncedSession=true;
  if(error?.code==="CLOUD_SYNC_RACE"){
   const conflicts=[{table:error.table||"sync",key:error.key||"race",field:null}];
   cloudSetConflict(conflicts);
   const wrapped=cloudConflictError(conflicts);
   wrapped.cause=error;
   throw wrapped;
  }
  if(error?.code!=="CLOUD_SYNC_CONFLICT")setCloudStatus("Échec de synchronisation · réessayer","error");
  throw error;
 }finally{
  cloudPushInProgress=false;
  if(cloudPushRequested&&!cloudSyncConflict){
   cloudPushRequested=false;
   queueCloudSync();
  }
 }
}

async function cloudResolveConflict(preference){
 const localButton=typeof document!=="undefined"?document.getElementById("cloudConflictKeepLocal"):null;
 const remoteButton=typeof document!=="undefined"?document.getElementById("cloudConflictKeepRemote"):null;
 if(localButton)localButton.disabled=true;
 if(remoteButton)remoteButton.disabled=true;
 try{
  await cloudPushLocalStateV25({force:true,conflictPreference:preference});
 }catch(error){
  if(error?.code!=="CLOUD_SYNC_CONFLICT")console.error("Cloud conflict resolution",error);
 }finally{
  if(localButton)localButton.disabled=false;
  if(remoteButton)remoteButton.disabled=false;
 }
}

if(typeof document!=="undefined"){
 document.getElementById("cloudConflictKeepLocal")?.addEventListener("click",()=>cloudResolveConflict("local"));
 document.getElementById("cloudConflictKeepRemote")?.addEventListener("click",()=>cloudResolveConflict("remote"));
 cloudRenderConflictUi();
}
