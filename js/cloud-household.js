// V2.4 — foyer partagé et état de session cloud
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
 const saved=localStorage.getItem("budget-foyer-v2.4-active-household");
 activeMembership=cloudMemberships.find(m=>m.household_id===saved)||cloudMemberships[0]||null;
 activeHouseholdId=activeMembership?.household_id||null;
 if(activeHouseholdId)localStorage.setItem("budget-foyer-v2.4-active-household",activeHouseholdId);
 updateCloudHouseholdUi();
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
  if(!cloudMemberships.length){
   const h=normalizeHousehold(state.household);
   document.getElementById("cloudCreateHouseholdName").value=state.onboardingComplete?h.name:"";
   document.getElementById("cloudCreateDisplayName").value=state.onboardingComplete?h.personB:"";
   document.getElementById("cloudCreateOtherName").value=state.onboardingComplete?h.personA:"";
   const importBox=document.getElementById("cloudCreateImportLocal");
   importBox.checked=!!state.onboardingComplete;
   importBox.disabled=!state.onboardingComplete;
   setCloudGateView("create");
   setCloudGateStatus(state.onboardingComplete?"Des données locales sont disponibles sur ce navigateur.":"Crée ton premier foyer partagé.");
   return;
  }
  selectActiveMembership();
  if(state.onboardingComplete&&localStorage.getItem(cloudPendingKey())==="1"){
   setCloudGateStatus("Envoi des modifications conservées hors ligne…");
   await cloudPushLocalState({force:true});
  }
  await cloudLoadState();
  startCloudRealtime();
  cloudSyncReady=true;
  setCloudStatus("Synchronisé","ok");
  hideCloudGate();
 }catch(error){
  console.error("Cloud bootstrap",error);
  if(state.onboardingComplete){
   hideCloudGate();
   setCloudStatus("Hors ligne · cache local","offline");
  }else{
   setCloudGateView("loading");
   setCloudGateStatus(error?.message||"Impossible de charger le foyer.","error");
   setCloudStatus("Erreur de synchronisation","error");
  }
 }
}
async function createCloudHousehold(){
 const name=document.getElementById("cloudCreateHouseholdName").value.trim();
 const displayName=document.getElementById("cloudCreateDisplayName").value.trim();
 const otherName=document.getElementById("cloudCreateOtherName").value.trim()||"Personne 2";
 const importLocal=document.getElementById("cloudCreateImportLocal").checked&&state.onboardingComplete;
 const button=document.getElementById("cloudCreateHouseholdBtn");
 if(!name||!displayName){
  setCloudGateStatus("Renseigne le nom du foyer et ton nom.","error");
  return;
 }
 button.disabled=true;
 setCloudGateStatus("Création du foyer…");
 try{
  const {data,error}=await cloudClient.rpc("create_household",{p_name:name,p_display_name:displayName});
  if(error)throw error;
  activeHouseholdId=data;
  const update=await cloudClient.from("households").update({person_b_label:displayName,person_a_label:otherName}).eq("id",data);
  if(update.error)throw update.error;
  await loadCloudMemberships();
  selectActiveMembership();
  if(importLocal){
   state.household=normalizeHousehold({...state.household,name,personB:displayName,personA:otherName});
  }else{
   state=seedState();
   state.onboardingComplete=true;
   state.household=normalizeHousehold({name,personB:displayName,personA:otherName});
  }
  cloudApplyingRemote=true;saveState();cloudApplyingRemote=false;
  await cloudPushLocalState({force:true});
  await cloudLoadState();
  startCloudRealtime();
  cloudSyncReady=true;
  setCloudStatus("Synchronisé","ok");
  hideCloudGate();
 }catch(error){
  console.error("Create household",error);
  setCloudGateStatus(error?.message||"Impossible de créer le foyer.","error");
 }finally{button.disabled=false}
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
  localStorage.setItem("budget-foyer-v2.4-active-household",data);
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

document.getElementById("cloudCreateHouseholdBtn")?.addEventListener("click",createCloudHousehold);
document.getElementById("cloudAcceptInviteBtn")?.addEventListener("click",acceptCloudInvite);
document.getElementById("cloudCreateInviteBtn")?.addEventListener("click",createCloudInvite);
