// V2.5 — Realtime avec priorité aux modifications locales et conflits explicites
let cloudRealtimeChannel=null;
let cloudRealtimeTimer=null;

function stopCloudRealtime(){
 clearTimeout(cloudRealtimeTimer);
 cloudRealtimeTimer=null;
 if(cloudRealtimeChannel&&cloudClient)cloudClient.removeChannel(cloudRealtimeChannel);
 cloudRealtimeChannel=null;
}
function scheduleCloudRealtimeReload(){
 if(Date.now()<cloudIgnoreRealtimeUntil||cloudPushInProgress)return;
 if(typeof cloudSyncConflict!=="undefined"&&cloudSyncConflict){
  setCloudStatus("Conflit de synchronisation · action requise","error");
  return;
 }
 clearTimeout(cloudRealtimeTimer);
 cloudRealtimeTimer=setTimeout(async()=>{
  if(!cloudSession||!activeHouseholdId||cloudPushInProgress)return;
  if(typeof cloudSyncDigest==="function"&&cloudSyncDigest()!==cloudLastSyncedDigest){
   setCloudStatus("Modification locale prioritaire…","syncing");
   queueCloudSync();
   return;
  }
  try{
   setCloudStatus("Mise à jour reçue…","syncing");
   await cloudLoadState();
  }catch(error){
   console.error("Cloud realtime reload",error);
   setCloudStatus("Mise à jour en attente","error");
  }
 },350);
}
function startCloudRealtime(){
 stopCloudRealtime();
 if(!cloudClient||!activeHouseholdId)return;
 const householdFilter=`id=eq.${activeHouseholdId}`;
 const memberFilter=`household_id=eq.${activeHouseholdId}`;
 cloudRealtimeChannel=cloudClient.channel(`household-${activeHouseholdId}`)
  .on("postgres_changes",{event:"*",schema:"public",table:"households",filter:householdFilter},scheduleCloudRealtimeReload)
  .on("postgres_changes",{event:"*",schema:"public",table:"household_members",filter:memberFilter},scheduleCloudRealtimeReload)
  .on("postgres_changes",{event:"*",schema:"public",table:"categories",filter:memberFilter},scheduleCloudRealtimeReload)
  .on("postgres_changes",{event:"*",schema:"public",table:"budgets",filter:memberFilter},scheduleCloudRealtimeReload)
  .on("postgres_changes",{event:"*",schema:"public",table:"transactions",filter:memberFilter},scheduleCloudRealtimeReload)
  .on("postgres_changes",{event:"*",schema:"public",table:"recurrences",filter:memberFilter},scheduleCloudRealtimeReload)
  .subscribe(status=>{
   if(status==="SUBSCRIBED"){
    if(typeof cloudSyncConflict!=="undefined"&&cloudSyncConflict)setCloudStatus("Conflit de synchronisation · action requise","error");
    else setCloudStatus("Synchronisé","ok");
   }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setCloudStatus("Realtime indisponible","error");
  });
}
