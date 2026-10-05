// V2.5.1 — foyer partagé et synchronisation cloud obligatoire
let activeHouseholdId=null;
let activeMembership=null;
let cloudMemberships=[];
let cloudHouseholds=[];
let cloudSyncReady=false;
let cloudApplyingRemote=false;
let cloudPushInProgress=false;
let cloudPushTimer=null;
let cloudIgnoreRealtimeUntil=0;
let cloudBootstrapPromise=null;

function ownerToSlot(owner){return owner==="A"||owner==="B"?owner:null}
function slotToOwner(slot){return slot==="A"||slot==="B"?slot:"common"}
function cloudMonthDate(key){return /^\d{4}-\d{2}$/.test(String(key||""))?key+"-01":null}

function setCloudStatus(message,stateName="idle"){
 const node=document.getElementById("cloudSyncStatus");
 if(node){node.textContent=message;node.dataset.state=stateName}
 const retry=document.getElementById("cloudForceSyncBtn");
 if(retry){
  retry.hidden=!["error","offline"].includes(stateName);
  retry.disabled=!cloudSession||!activeHouseholdId;
 }
}
function updateCloudHouseholdUi(){
 const household=cloudHouseholds.find(h=>h.id===activeHouseholdId);
 const householdNode=document.getElementById("cloudActiveHousehold");
 if(householdNode)householdNode.textContent=household?.name||"Aucun foyer";
 const inviteBtn=document.getElementById("cloudCreateInviteBtn");
 if(inviteBtn)inviteBtn.disabled=!activeMembership||activeMembership.role!=="owner";
 const canEditHousehold=!activeMembership||activeMembership.role==="owner";
 for(const id of ["settingsHouseholdName","settingsPersonB","settingsPersonA","saveHouseholdBtn","migrateLocalBtn","importBtn","resetBtn"]){
  const control=document.getElementById(id);if(control)control.disabled=!canEditHousehold;
 }
 const saveHousehold=document.getElementById("saveHouseholdBtn");
 if(saveHousehold)saveHousehold.title=canEditHousehold?"":"Seul le propriétaire peut modifier les noms du foyer.";
}
async function loadCloudMemberships(){
 const userId=cloudSession?.user?.id;
 if(!userId)return[];
 const {data,error}=await cloudClient.from("household_members").select("*").eq("user_id",userId);
 if(error)throw error;
 cloudMemberships=data||[];
 const ids=cloudMemberships.map(x=>x.household_id);
 if(ids.length){
  const res=await cloudClient.from("households").select("*").in("id",ids);
  if(res.error)throw res.error;
  cloudHouseholds=res.data||[];
 }else cloudHouseholds=[];
 return cloudMemberships;
}
function requestCloudBootstrap(){
 if(cloudBootstrapPromise)return cloudBootstrapPromise;
 cloudBootstrapPromise=cloudBootstrap().finally(()=>{cloudBootstrapPromise=null});
 return cloudBootstrapPromise;
}
function selectActiveMembership(){
 let saved=localStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
 if(!saved)for(const key of PREVIOUS_ACTIVE_HOUSEHOLD_KEYS||[]){
  saved=localStorage.getItem(key);
  if(saved){localStorage.setItem(ACTIVE_HOUSEHOLD_KEY,saved);break}
 }
 activeMembership=cloudMemberships.find(m=>m.household_id===saved)||cloudMemberships[0]||null;
 activeHouseholdId=activeMembership?.household_id||null;
 if(activeHouseholdId){
  localStorage.setItem(ACTIVE_HOUSEHOLD_KEY,activeHouseholdId);
  switchHouseholdCache(activeHouseholdId);
 }
 updateCloudHouseholdUi();
}
async function provisionPersonalHousehold(){
 const profile=pendingPersonalProfile();
 const householdName=String(profile.householdName||"Mon foyer").trim()||"Mon foyer";
 const displayName=String(profile.displayName||cloudSession?.user?.user_metadata?.display_name||"Personne 1").trim()||"Personne 1";
 setCloudGateStatus("Création de ton foyer personnel…");
 const {data,error}=await cloudClient.rpc("ensure_personal_household",{
  p_household_name:householdName,
  p_display_name:displayName
 });
 if(error)throw error;

 localStorage.setItem(ACTIVE_HOUSEHOLD_KEY,data);
 if(typeof markSetupBuilderPending==="function")markSetupBuilderPending(data);

 await loadCloudMemberships();
 selectActiveMembership();

 // Nouveau foyer : on prépare l'état local immédiatement.
 // Le premier push cloud est fait une seule fois après le builder (ou en arrière-plan si ignoré).
 state=seedState();
 state.onboardingComplete=true;
 state.household=normalizeHousehold({name:householdName,personB:displayName,personA:"Personne 2",mode:"couple"});
 cloudApplyingRemote=true;
 saveState();
 cloudApplyingRemote=false;

 clearPendingPersonalProfile();
 return true;
}
async function cloudBootstrap(){
 if(!cloudSession)return;
 setCloudGateView("loading");
 setCloudGateStatus("Chargement du foyer partagé…");
 try{
  if(pendingInviteToken){
   setCloudGateView("invite");
   setCloudGateStatus("Cette invitation est prête à être acceptée.");
   if(!cloudInviteName.value)cloudInviteName.value=cloudSession.user?.user_metadata?.display_name||"";
   return;
  }
  await loadCloudMemberships();
  let provisionedNow=false;
  if(!cloudMemberships.length){
   provisionedNow=await provisionPersonalHousehold();
  }else{
   selectActiveMembership();
  }

  // Un foyer tout juste créé n'a encore aucune donnée distante à relire.
  // Évite un push complet suivi immédiatement d'un reload complet avant l'ouverture du builder.
  if(!provisionedNow)await cloudLoadState();
  startCloudRealtime();
  cloudSyncReady=true;
  setCloudStatus("Synchronisé","ok");
  hideCloudGate();
  if(typeof setupBuilderNeedsRun==="function"&&setupBuilderNeedsRun(activeHouseholdId)&&typeof openSetupBuilder==="function")openSetupBuilder();
 }catch(error){
  console.error("Cloud bootstrap",error);
  cloudSyncReady=false;
  setCloudGateView("loading");
  setCloudGateStatus(
   navigator.onLine
    ?(error?.message||"Impossible de charger le foyer. Réessaie la synchronisation.")
    :"Connexion internet requise pour ouvrir le budget.",
   "error"
  );
  setCloudStatus(navigator.onLine?"Erreur de synchronisation":"Connexion requise","error");
  if(typeof cloudRenderConflictUi==="function")cloudRenderConflictUi();
 }
}
async function acceptCloudInvite(){
 const name=cloudInviteName.value.trim();
 const button=document.getElementById("cloudAcceptInviteBtn");
 if(!pendingInviteToken||!name){
  setCloudGateStatus("Entre ton nom pour rejoindre le foyer.","error");
  return;
 }
 button.disabled=true;
 setCloudGateStatus("Ajout au foyer…");
 try{
  const {data,error}=await cloudClient.rpc("accept_household_invite",{p_token:pendingInviteToken,p_display_name:name});
  if(error)throw error;
  clearPendingInvite();
  clearPendingPersonalProfile();
  localStorage.setItem(ACTIVE_HOUSEHOLD_KEY,data);
  await loadCloudMemberships();
  selectActiveMembership();
  await cloudLoadState();
  startCloudRealtime();
  cloudSyncReady=true;
  setCloudStatus("Synchronisé","ok");
  hideCloudGate();
 }catch(error){
  console.error("Accept invite",error);
  setCloudGateStatus(error?.message||"Invitation invalide ou expirée.","error");
 }finally{button.disabled=false}
}
async function createCloudInvite(){
 if(!activeHouseholdId||activeMembership?.role!=="owner")return;
 const button=document.getElementById("cloudCreateInviteBtn");
 button.disabled=true;
 setCloudStatus("Création de l’invitation…","syncing");
 try{
  const target=activeMembership.slot==="A"?"B":"A";
  const {data,error}=await cloudClient.rpc("create_household_invite",{p_household_id:activeHouseholdId,p_slot:target});
  if(error)throw error;
  const url=new URL(cloudBaseUrl());
  url.searchParams.set("invite",data);
  await navigator.clipboard.writeText(url.toString());
  setCloudStatus("Lien d’invitation copié","ok");
  showUndoToast("Lien d’invitation copié");
 }catch(error){
  console.error("Invite",error);
  setCloudStatus(error?.message||"Impossible de créer l’invitation","error");
 }finally{button.disabled=false}
}

document.getElementById("cloudAcceptInviteBtn")?.addEventListener("click",acceptCloudInvite);
document.getElementById("cloudCreateInviteBtn")?.addEventListener("click",createCloudInvite);
