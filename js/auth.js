// V2.5.1 — authentification Supabase requise pour accéder aux données cloud
let cloudSession=null;
let pendingInviteToken="";
let cloudAuthSubscription=null;
let cloudAuthMode="login";

const cloudGate=document.getElementById("cloudGate");
const cloudLoginView=document.getElementById("cloudLoginView");
const cloudLoadingView=document.getElementById("cloudLoadingView");
const cloudInviteView=document.getElementById("cloudInviteView");
const cloudResetView=document.getElementById("cloudResetView");
const cloudGateStatus=document.getElementById("cloudGateStatus");
const cloudEmailInput=document.getElementById("cloudEmailInput");
const cloudPasswordInput=document.getElementById("cloudPasswordInput");
const cloudDisplayNameInput=document.getElementById("cloudDisplayNameInput");
const cloudHouseholdNameInput=document.getElementById("cloudHouseholdNameInput");
const cloudSignupFields=document.getElementById("cloudSignupFields");
const cloudAuthHeading=document.getElementById("cloudAuthHeading");
const cloudAuthIntro=document.getElementById("cloudAuthIntro");
const cloudAuthSubmitBtn=document.getElementById("cloudAuthSubmitBtn");
const cloudSendMagicLinkBtn=document.getElementById("cloudSendMagicLinkBtn");
const cloudInviteName=document.getElementById("cloudInviteName");

function cloudBaseUrl(){
 return location.origin+location.pathname;
}
function cloudAuthRedirectUrl(mode=""){
 const redirect=new URL(cloudBaseUrl());
 const invite=pendingInviteToken||readPendingInvite();
 if(invite)redirect.searchParams.set("invite",invite);
 if(mode)redirect.searchParams.set("mode",mode);
 return redirect.toString();
}
function readPendingInvite(){
 const urlToken=new URLSearchParams(location.search).get("invite");
 if(urlToken){
  localStorage.setItem("budget-foyer-v2.5-pending-invite",urlToken);
  return urlToken;
 }
 return localStorage.getItem("budget-foyer-v2.5-pending-invite")||"";
}
function clearPendingInvite(){
 pendingInviteToken="";
 localStorage.removeItem("budget-foyer-v2.5-pending-invite");
 const url=new URL(location.href);
 url.searchParams.delete("invite");
 history.replaceState({},document.title,url.pathname+url.search);
}
function isPasswordRecoveryReturn(){
 return new URLSearchParams(location.search).get("mode")==="recovery"||new URLSearchParams(location.hash.slice(1)).get("type")==="recovery";
}
function clearPasswordRecoveryUrl(){
 const url=new URL(location.href);
 url.searchParams.delete("mode");
 url.hash="";
 history.replaceState({},document.title,url.pathname+url.search);
}
function pendingPersonalProfile(){
 try{return JSON.parse(localStorage.getItem("budget-foyer-v2.5-pending-profile")||"null")||{}}catch{return{}}
}
function setPendingPersonalProfile(profile){
 localStorage.setItem("budget-foyer-v2.5-pending-profile",JSON.stringify(profile));
}
function clearPendingPersonalProfile(){
 localStorage.removeItem("budget-foyer-v2.5-pending-profile");
}
function setCloudGateView(name){
 [cloudLoginView,cloudLoadingView,cloudInviteView,cloudResetView].forEach(el=>{if(el)el.hidden=true});
 const map={login:cloudLoginView,loading:cloudLoadingView,invite:cloudInviteView,reset:cloudResetView};
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
function setCloudAuthMode(mode){
 cloudAuthMode=mode==="signup"?"signup":"login";
 const signup=cloudAuthMode==="signup";
 cloudSignupFields.hidden=!signup;
 cloudAuthHeading.textContent=signup?"Créer un compte":"Se connecter";
 cloudAuthIntro.textContent=signup
  ?"Crée ton compte. Un foyer personnel et vide sera préparé après confirmation de ton email."
  :"Connecte-toi avec ton email et ton mot de passe.";
 cloudAuthSubmitBtn.textContent=signup?"Créer mon compte":"Se connecter";
 cloudPasswordInput.autocomplete=signup?"new-password":"current-password";
 document.getElementById("cloudForgotPasswordBtn").hidden=signup;
 for(const [id,active] of [["cloudLoginModeBtn",!signup],["cloudSignupModeBtn",signup]]){
  const button=document.getElementById(id);
  button.classList.toggle("active",active);
  button.setAttribute("aria-selected",String(active));
 }
 setCloudGateStatus("");
}
function validCloudEmail(){
 const email=String(cloudEmailInput.value||"").trim();
 if(/^\S+@\S+\.\S+$/.test(email))return email;
 setCloudGateStatus("Entre une adresse email valide.","error");
 cloudEmailInput.focus();
 return "";
}
function validCloudPassword(){
 const password=String(cloudPasswordInput.value||"");
 if(password.length>=8)return password;
 setCloudGateStatus("Le mot de passe doit contenir au moins 8 caractères.","error");
 cloudPasswordInput.focus();
 return "";
}
async function submitCloudAuth(){
 const email=validCloudEmail();
 const password=validCloudPassword();
 if(!email||!password)return;
 cloudAuthSubmitBtn.disabled=true;
 setCloudGateStatus(cloudAuthMode==="signup"?"Création du compte…":"Connexion…");
 try{
  if(cloudAuthMode==="signup"){
   const displayName=String(cloudDisplayNameInput.value||"").trim()||"Personne 1";
   const householdName=String(cloudHouseholdNameInput.value||"").trim()||"Mon foyer";
   setPendingPersonalProfile({displayName,householdName});
   const {data,error}=await cloudClient.auth.signUp({
    email,password,
    options:{emailRedirectTo:cloudAuthRedirectUrl(),data:{display_name:displayName}}
   });
   if(error)throw error;
   if(data?.session){
    cloudSession=data.session;
    updateCloudAccountUi();
    await requestCloudBootstrap();
   }else{
    setCloudGateStatus("Compte créé. Confirme ton adresse depuis l’email reçu, puis reviens ici.","success");
   }
  }else{
   const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
   if(error)throw error;
   cloudSession=data?.session||null;
   updateCloudAccountUi();
   if(cloudSession)await requestCloudBootstrap();
  }
 }catch(error){
  console.error("Email auth",error);
  setCloudGateStatus(error?.message||"Authentification impossible.","error");
 }finally{cloudAuthSubmitBtn.disabled=false}
}
async function sendPasswordReset(){
 const email=validCloudEmail();
 if(!email)return;
 const button=document.getElementById("cloudForgotPasswordBtn");
 button.disabled=true;
 setCloudGateStatus("Envoi du lien de réinitialisation…");
 try{
  const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo:cloudAuthRedirectUrl("recovery")});
  if(error)throw error;
  setCloudGateStatus("Si ce compte existe, un email de réinitialisation vient d’être envoyé.","success");
 }catch(error){
  console.error("Password reset",error);
  setCloudGateStatus(error?.message||"Impossible d’envoyer le lien.","error");
 }finally{button.disabled=false}
}
async function updateCloudPassword(){
 const password=String(document.getElementById("cloudNewPasswordInput").value||"");
 const confirm=String(document.getElementById("cloudNewPasswordConfirm").value||"");
 if(password.length<8){setCloudGateStatus("Le mot de passe doit contenir au moins 8 caractères.","error");return}
 if(password!==confirm){setCloudGateStatus("Les deux mots de passe ne correspondent pas.","error");return}
 const button=document.getElementById("cloudResetPasswordBtn");
 button.disabled=true;
 setCloudGateStatus("Mise à jour du mot de passe…");
 try{
  const {error}=await cloudClient.auth.updateUser({password});
  if(error)throw error;
  clearPasswordRecoveryUrl();
  setCloudGateStatus("Mot de passe mis à jour.","success");
  await requestCloudBootstrap();
 }catch(error){
  console.error("Update password",error);
  setCloudGateStatus(error?.message||"Impossible de modifier le mot de passe.","error");
 }finally{button.disabled=false}
}
async function sendMagicLink(){
 const email=validCloudEmail();
 if(!email)return;
 cloudSendMagicLinkBtn.disabled=true;
 setCloudGateStatus("Envoi du lien de connexion…");
 try{
  const {error}=await cloudClient.auth.signInWithOtp({
   email,
   options:{shouldCreateUser:true,emailRedirectTo:cloudAuthRedirectUrl()}
  });
  if(error)throw error;
  setCloudGateStatus("Lien envoyé. Ouvre l’email sur cet appareil pour te connecter.","success");
 }catch(error){
  console.error("Magic Link",error);
  setCloudGateStatus(error?.message||"Impossible d’envoyer le lien.","error");
 }finally{cloudSendMagicLinkBtn.disabled=false}
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
  setCloudGateStatus("Le service de synchronisation n’a pas pu être chargé. Une connexion cloud est requise pour ouvrir le budget.","error");
  setCloudStatus("Cloud indisponible","error");
  return;
 }
 const {data,error}=await cloudClient.auth.getSession();
 if(error)console.error("Session Supabase",error);
 cloudSession=data?.session||null;
 updateCloudAccountUi();
 if(cloudSession&&isPasswordRecoveryReturn()){
  setCloudGateView("reset");
  setCloudGateStatus("Choisis ton nouveau mot de passe.");
 }else if(cloudSession){
  await requestCloudBootstrap();
 }else{
  setCloudGateView("login");
  setCloudAuthMode("login");
  setCloudGateStatus(pendingInviteToken?"Connecte-toi ou crée un compte pour accepter cette invitation.":"");
 }

 cloudAuthSubscription?.unsubscribe?.();
 const {data:listener}=cloudClient.auth.onAuthStateChange((event,session)=>{
  cloudSession=session||null;
  updateCloudAccountUi();
  if(event==="PASSWORD_RECOVERY"){
   setCloudGateView("reset");
   setCloudGateStatus("Choisis ton nouveau mot de passe.");
   return;
  }
  if(event==="SIGNED_OUT"){
   if(typeof stopCloudRealtime==="function")stopCloudRealtime();
   cloudSyncReady=false;
   activeHouseholdId=null;
   activeMembership=null;
   setCloudGateView("login");
   setCloudAuthMode("login");
   setCloudGateStatus("Session fermée.");
   return;
  }
  if(!session||isPasswordRecoveryReturn())return;
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

document.getElementById("cloudLoginModeBtn")?.addEventListener("click",()=>setCloudAuthMode("login"));
document.getElementById("cloudSignupModeBtn")?.addEventListener("click",()=>setCloudAuthMode("signup"));
cloudAuthSubmitBtn?.addEventListener("click",submitCloudAuth);
cloudSendMagicLinkBtn?.addEventListener("click",sendMagicLink);
document.getElementById("cloudForgotPasswordBtn")?.addEventListener("click",sendPasswordReset);
document.getElementById("cloudResetPasswordBtn")?.addEventListener("click",updateCloudPassword);
document.getElementById("cloudSignOutBtn")?.addEventListener("click",cloudSignOut);
