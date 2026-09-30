// V2.4 — authentification Magic Link Supabase
let cloudSession=null;
let pendingInviteToken="";
let cloudAuthSubscription=null;

const cloudGate=document.getElementById("cloudGate");
const cloudLoginView=document.getElementById("cloudLoginView");
const cloudLoadingView=document.getElementById("cloudLoadingView");
const cloudCreateView=document.getElementById("cloudCreateView");
const cloudInviteView=document.getElementById("cloudInviteView");
const cloudGateStatus=document.getElementById("cloudGateStatus");
const cloudEmailInput=document.getElementById("cloudEmailInput");
const cloudSendMagicLinkBtn=document.getElementById("cloudSendMagicLinkBtn");
const cloudInviteName=document.getElementById("cloudInviteName");

function cloudBaseUrl(){
 return location.origin+location.pathname;
}
function readPendingInvite(){
 const urlToken=new URLSearchParams(location.search).get("invite");
 if(urlToken){
  localStorage.setItem("budget-foyer-v2.4-pending-invite",urlToken);
  history.replaceState({},document.title,cloudBaseUrl());
  return urlToken;
 }
 return localStorage.getItem("budget-foyer-v2.4-pending-invite")||"";
}
function clearPendingInvite(){
 pendingInviteToken="";
 localStorage.removeItem("budget-foyer-v2.4-pending-invite");
}
function setCloudGateView(name){
 [cloudLoginView,cloudLoadingView,cloudCreateView,cloudInviteView].forEach(el=>{if(el)el.hidden=true});
 const map={login:cloudLoginView,loading:cloudLoadingView,create:cloudCreateView,invite:cloudInviteView};
 if(map[name])map[name].hidden=false;
 cloudGate.classList.add("open");
 cloudGate.setAttribute("aria-hidden","false");
}
function hideCloudGate(){
 cloudGate.classList.remove("open");
 cloudGate.setAttribute("aria-hidden","true");
}
function setCloudGateStatus(message,type=""){
 cloudGateStatus.textContent=message||"";
 cloudGateStatus.className=("cloud-gate-status "+type).trim();
}
async function sendMagicLink(){
 const email=String(cloudEmailInput.value||"").trim();
 if(!/^\S+@\S+\.\S+$/.test(email)){
  setCloudGateStatus("Entre une adresse email valide.","error");
  cloudEmailInput.focus();
  return;
 }
 cloudSendMagicLinkBtn.disabled=true;
 setCloudGateStatus("Envoi du lien de connexion…");
 try{
  const invite=pendingInviteToken||readPendingInvite();
  const redirect=new URL(cloudBaseUrl());
  if(invite)redirect.searchParams.set("invite",invite);
  const {error}=await cloudClient.auth.signInWithOtp({
   email,
   options:{
    shouldCreateUser:true,
    emailRedirectTo:redirect.toString()
   }
  });
  if(error)throw error;
  setCloudGateStatus("Lien envoyé. Ouvre l’email sur cet appareil pour te connecter.","success");
 }catch(error){
  console.error("Magic Link",error);
  setCloudGateStatus(error?.message||"Impossible d’envoyer le lien.","error");
 }finally{
  cloudSendMagicLinkBtn.disabled=false;
 }
}
async function cloudSignOut(){
 if(typeof stopCloudRealtime==="function")stopCloudRealtime();
 cloudSyncReady=false;
 activeHouseholdId=null;
 activeMembership=null;
 await cloudClient.auth.signOut();
}
async function initCloudAuth(){
 pendingInviteToken=readPendingInvite();
 setCloudGateView("loading");
 setCloudGateStatus("Vérification de la session…");
 if(!cloudClient){
  if(state.onboardingComplete){
   hideCloudGate();
   setCloudStatus("Cloud indisponible · cache local","offline");
  }else{
   setCloudGateStatus("Le service de synchronisation n’a pas pu être chargé. Vérifie la connexion puis recharge la page.","error");
   setCloudStatus("Cloud indisponible","error");
  }
  return;
 }
 const {data,error}=await cloudClient.auth.getSession();
 if(error)console.error("Session Supabase",error);
 cloudSession=data?.session||null;
 updateCloudAccountUi();
 if(cloudSession){
  await requestCloudBootstrap();
 }else{
  setCloudGateView("login");
  setCloudGateStatus(pendingInviteToken?"Connecte-toi pour rejoindre le foyer partagé.":"Connexion par lien magique, sans mot de passe.");
 }

 cloudAuthSubscription?.unsubscribe?.();
 const {data:listener}=cloudClient.auth.onAuthStateChange((event,session)=>{
  cloudSession=session||null;
  updateCloudAccountUi();
  if(event==="SIGNED_OUT"){
   if(typeof stopCloudRealtime==="function")stopCloudRealtime();
   cloudSyncReady=false;
   activeHouseholdId=null;
   activeMembership=null;
   setCloudGateView("login");
   setCloudGateStatus("Session fermée.");
   return;
  }
  if(!session)return;
  if(["SIGNED_IN","INITIAL_SESSION"].includes(event)){
   setTimeout(()=>{requestCloudBootstrap().catch(error=>console.error("Cloud auth bootstrap",error))},0);
  }
 });
 cloudAuthSubscription=listener?.subscription||null;
}
function updateCloudAccountUi(){
 const email=cloudSession?.user?.email||"Non connecté";
 const emailNode=document.getElementById("cloudAccountEmail");
 if(emailNode)emailNode.textContent=email;
 const signout=document.getElementById("cloudSignOutBtn");
 if(signout)signout.disabled=!cloudSession;
}

cloudSendMagicLinkBtn?.addEventListener("click",sendMagicLink);
cloudEmailInput?.addEventListener("keydown",e=>{if(e.key==="Enter")sendMagicLink()});
document.getElementById("cloudSignOutBtn")?.addEventListener("click",cloudSignOut);
