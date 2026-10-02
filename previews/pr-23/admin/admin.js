const loginView=document.getElementById("adminLoginView");
const deniedView=document.getElementById("adminDeniedView");
const loadingView=document.getElementById("adminLoadingView");
const dashboard=document.getElementById("adminDashboard");
const statusNode=document.getElementById("adminStatus");
const signOutBtn=document.getElementById("adminSignOutBtn");

function showAdminView(name){
 loginView.hidden=name!=="login";
 deniedView.hidden=name!=="denied";
 loadingView.hidden=name!=="loading";
 dashboard.hidden=name!=="dashboard";
 signOutBtn.hidden=name==="login";
}
function setAdminStatus(message,type=""){
 statusNode.textContent=message||"";
 statusNode.className=("status "+type).trim();
}
function formatDate(value){
 if(!value)return "—";
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(date);
}
function cell(row,value){
 const td=document.createElement("td");
 if(value instanceof Node)td.append(value);else td.textContent=String(value??"—");
 row.append(td);
 return td;
}
function badge(text,kind=""){
 const node=document.createElement("span");
 node.className=("badge "+kind).trim();
 node.textContent=text;
 return node;
}
async function adminRequest(action,payload={}){
 const {data,error}=await cloudClient.functions.invoke("admin-api",{body:{action,...payload}});
 if(error){
  const denied=error.context?.status===403||/administrator/i.test(String(error.message||""));
  const wrapped=new Error(denied?"Accès administrateur refusé.":(error.message||"Erreur du service administrateur."));
  wrapped.denied=denied;
  throw wrapped;
 }
 if(data?.error)throw new Error(data.error);
 return data;
}
function renderStats(data){
 const stats=document.getElementById("adminStats");
 stats.replaceChildren();
 const memberCount=data.households.reduce((sum,item)=>sum+item.members.length,0);
 for(const [label,value] of [["Utilisateurs",data.users.length],["Foyers",data.households.length],["Membres",memberCount]]){
  const node=document.createElement("div");node.className="stat";
  const strong=document.createElement("strong");strong.textContent=value;
  const span=document.createElement("span");span.textContent=label;
  node.append(strong,span);stats.append(node);
 }
}
function renderUsers(users){
 const body=document.getElementById("adminUsersBody");body.replaceChildren();
 for(const user of users){
  const row=document.createElement("tr");
  const email=document.createElement("div");email.textContent=user.email||"Sans email";
  const id=document.createElement("small");id.textContent=user.id;email.append(id);cell(row,email);
  const state=document.createElement("div");
  state.append(user.disabled?badge("Désactivé","warn"):badge(user.email_confirmed_at?"Confirmé":"À confirmer",user.email_confirmed_at?"":"warn"));
  if(user.is_admin)state.append(" ",badge("Admin","admin"));cell(row,state);
  cell(row,formatDate(user.created_at));cell(row,formatDate(user.last_sign_in_at));cell(row,user.memberships.length);
  const actions=document.createElement("div");actions.className="row-actions";
  if(!user.is_admin){
   const toggle=document.createElement("button");toggle.type="button";toggle.textContent=user.disabled?"Réactiver":"Désactiver";
   toggle.addEventListener("click",()=>mutateUser("set_user_disabled",user.id,{disabled:!user.disabled},user.disabled?"réactiver":"désactiver"));
   const remove=document.createElement("button");remove.type="button";remove.className="danger";remove.textContent="Supprimer";
   remove.addEventListener("click",()=>mutateUser("delete_user",user.id,{},"supprimer définitivement"));
   actions.append(toggle,remove);
  }
  cell(row,actions);body.append(row);
 }
}
function renderHouseholds(households){
 const body=document.getElementById("adminHouseholdsBody");body.replaceChildren();
 for(const household of households){
  const row=document.createElement("tr");
  const name=document.createElement("div");name.textContent=household.name;
  const id=document.createElement("small");id.textContent=household.id;name.append(id);cell(row,name);
  cell(row,formatDate(household.created_at));
  const members=document.createElement("div");
  for(const member of household.members){const line=document.createElement("div");line.textContent=`${member.display_name} · ${member.role} · slot ${member.slot||"—"}`;members.append(line)}
  if(!household.members.length)members.textContent="Aucun";cell(row,members);
  cell(row,`${household.category_count} catégories · ${household.transaction_count} opérations · ${household.recurrence_count} récurrences`);
  const remove=document.createElement("button");remove.type="button";remove.className="danger";remove.textContent="Supprimer";
  remove.addEventListener("click",()=>deleteHousehold(household));
  cell(row,remove);body.append(row);
 }
}
async function loadAdmin(){
 showAdminView("loading");setAdminStatus("");
 try{
  const data=await adminRequest("list");
  renderStats(data);renderUsers(data.users);renderHouseholds(data.households);
  showAdminView("dashboard");
 }catch(error){
  console.error("Admin load",error);
  if(error.denied){showAdminView("denied");setAdminStatus("Ce compte ne possède pas le rôle administrateur.","error")}
  else{showAdminView("login");setAdminStatus(error.message,"error")}
 }
}
async function mutateUser(action,userId,extra,verb){
 if(!confirm(`Confirmer : ${verb} ce compte ?`))return;
 setAdminStatus("Action en cours…");
 try{await adminRequest(action,{user_id:userId,...extra});setAdminStatus("Action terminée.","success");await loadAdmin()}
 catch(error){setAdminStatus(error.message,"error")}
}
async function deleteHousehold(household){
 if(!confirm(`Supprimer définitivement le foyer « ${household.name} » et toutes ses données ?`))return;
 setAdminStatus("Suppression du foyer…");
 try{await adminRequest("delete_household",{household_id:household.id});setAdminStatus("Foyer supprimé.","success");await loadAdmin()}
 catch(error){setAdminStatus(error.message,"error")}
}
async function loginAdmin(){
 const email=document.getElementById("adminEmail").value.trim();
 const password=document.getElementById("adminPassword").value;
 const button=document.getElementById("adminLoginBtn");button.disabled=true;setAdminStatus("Connexion…");
 try{
  const {error}=await cloudClient.auth.signInWithPassword({email,password});
  if(error)throw error;
  await loadAdmin();
 }catch(error){showAdminView("login");setAdminStatus(error.message||"Connexion impossible.","error")}
 finally{button.disabled=false}
}
async function signOutAdmin(){await cloudClient.auth.signOut();showAdminView("login");setAdminStatus("Session fermée.")}

document.getElementById("adminLoginBtn").addEventListener("click",loginAdmin);
document.getElementById("adminPassword").addEventListener("keydown",event=>{if(event.key==="Enter")loginAdmin()});
document.getElementById("adminRefreshBtn").addEventListener("click",loadAdmin);
signOutBtn.addEventListener("click",signOutAdmin);
document.getElementById("adminDeniedSignOutBtn").addEventListener("click",signOutAdmin);

(async()=>{
 if(!cloudClient){showAdminView("login");setAdminStatus("Client Supabase indisponible.","error");return}
 const {data}=await cloudClient.auth.getSession();
 if(data?.session)await loadAdmin();else showAdminView("login");
})();
