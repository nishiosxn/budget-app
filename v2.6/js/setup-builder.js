// V2.6 — assistant de création du budget pour les nouveaux foyers
const SETUP_BUILDER_PREFIX="budget-foyer-v2.6-setup-builder:";
const SETUP_BUILDER_UPDATED="2026-10-05";

const SETUP_BUILDER_INCOMES=[
 {id:"salary-b",name:"Salaire personne 1",selected:true,owner:"B"},
 {id:"salary-a",name:"Salaire personne 2",selected:false,owner:"A"},
 {id:"benefits",name:"Aides / allocations",selected:false,owner:"common"},
 {id:"extra-b",name:"Autre revenu personne 1",selected:false,owner:"B"},
 {id:"extra-a",name:"Autre revenu personne 2",selected:false,owner:"A"}
];

const SETUP_BUILDER_EXPENSES=[
 {id:"rent",name:"Loyer / logement",section:"Obligatoires",selected:true,owner:"common"},
 {id:"electricity",name:"Électricité / énergie",section:"Obligatoires",selected:true,owner:"common"},
 {id:"groceries",name:"Courses",section:"Obligatoires",selected:true,owner:"common"},
 {id:"internet",name:"Internet",section:"Obligatoires",selected:true,owner:"common"},
 {id:"home-insurance",name:"Assurance habitation",section:"Obligatoires",selected:false,owner:"common"},
 {id:"car-insurance",name:"Assurance véhicule",section:"Obligatoires",selected:false,owner:"common"},
 {id:"phone-b",name:"Téléphone personne 1",section:"Obligatoires",selected:false,owner:"B"},
 {id:"phone-a",name:"Téléphone personne 2",section:"Obligatoires",selected:false,owner:"A"},
 {id:"fuel",name:"Transport / carburant",section:"Obligatoires",selected:false,owner:"common"},
 {id:"saving-b",name:"Épargne personne 1",section:"Obligatoires",selected:false,owner:"B",saving:true},
 {id:"saving-a",name:"Épargne personne 2",section:"Obligatoires",selected:false,owner:"A",saving:true}
];

const SETUP_SUBSCRIPTIONS=[
 {
  id:"netflix",name:"Netflix",owner:"common",source:"Netflix",sourceUrl:"https://www.netflix.com/fr-fr/",
  plans:[
   {name:"Standard avec pub",price:7.99},
   {name:"Standard",price:14.99},
   {name:"Premium",price:21.99}
  ]
 },
 {
  id:"spotify",name:"Spotify Premium",owner:"common",source:"Spotify",sourceUrl:"https://www.spotify.com/fr/premium/",
  plans:[
   {name:"Personnel",price:12.14},
   {name:"Duo",price:17.20},
   {name:"Famille",price:21.24},
   {name:"Étudiants",price:7.07}
  ]
 },
 {
  id:"disney",name:"Disney+",owner:"common",source:"Disney+",sourceUrl:"https://www.disneyplus.com/fr-fr",
  plans:[
   {name:"Standard avec pub",price:6.99},
   {name:"Standard",price:10.99},
   {name:"Premium",price:15.99}
  ]
 },
 {
  id:"prime",name:"Amazon Prime",owner:"common",source:"Amazon France",sourceUrl:"https://www.amazon.fr/amazonprime",
  plans:[{name:"Mensuel",price:6.99}]
 },
 {
  id:"icloud",name:"iCloud+",owner:"B",source:"Apple",sourceUrl:"https://support.apple.com/fr-fr/108047",
  plans:[
   {name:"50 Go",price:.99},
   {name:"200 Go",price:2.99},
   {name:"2 To",price:9.99}
  ]
 },
 {
  id:"discord",name:"Discord Nitro",owner:"B",source:"Discord",sourceUrl:"https://support.discord.com/hc/fr/articles/4407269525911",
  plans:[
   {name:"Nitro Basic",price:2.99},
   {name:"Nitro",price:9.99}
  ]
 },
 {
  id:"chatgpt",name:"ChatGPT Plus",owner:"B",source:"OpenAI",sourceUrl:"https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus",
  plans:[{name:"Plus · 20 $/mois",price:null}]
 }
];

let setupBuilderStep=0;
let setupBuilderDraft=null;

function setupBuilderKey(householdId=activeHouseholdId){
 return SETUP_BUILDER_PREFIX+String(householdId||"unknown");
}
function markSetupBuilderPending(householdId){
 if(!householdId)return;
 try{localStorage.setItem(setupBuilderKey(householdId),"pending")}catch{}
}
function markSetupBuilderComplete(householdId=activeHouseholdId){
 if(!householdId)return;
 try{localStorage.setItem(setupBuilderKey(householdId),"complete")}catch{}
}
function setupBuilderNeedsRun(householdId=activeHouseholdId){
 if(!householdId)return false;
 try{return localStorage.getItem(setupBuilderKey(householdId))==="pending"}catch{return false}
}
function setupBuilderPersonName(owner){
 if(owner==="B")return state.household.personB||"Personne 1";
 if(owner==="A")return state.household.personA||"Personne 2";
 return "À deux";
}
function setupBuilderOwnerOptions(selected){
 return [["common","À deux"],["B",state.household.personB||"Personne 1"],["A",state.household.personA||"Personne 2"]]
  .map(([value,label])=>`<option value="${value}" ${selected===value?"selected":""}>${escapeHtml(label)}</option>`).join("");
}
function setupBuilderInitialDraft(){
 const income={};
 SETUP_BUILDER_INCOMES.forEach(item=>income[item.id]={selected:item.selected,amount:"",owner:item.owner});
 const expense={};
 SETUP_BUILDER_EXPENSES.forEach(item=>expense[item.id]={selected:item.selected,amount:"",owner:item.owner});
 const subscriptions={};
 SETUP_SUBSCRIPTIONS.forEach(item=>{
  const plan=item.plans[0];
  subscriptions[item.id]={selected:false,plan:0,amount:plan.price==null?"":String(plan.price),owner:item.owner};
 });
 return {
  household:{
   name:state.household.name||"Mon foyer",
   personB:state.household.personB||"Personne 1",
   personA:state.household.personA||"Personne 2"
  },
  income,expense,subscriptions
 };
}
function ensureSetupBuilder(){
 let root=document.getElementById("setupBuilderBackdrop");
 if(root)return root;
 root=document.createElement("div");
 root.id="setupBuilderBackdrop";
 root.className="setup-builder-backdrop";
 root.setAttribute("aria-hidden","true");
 root.innerHTML=`
  <section class="setup-builder-panel" role="dialog" aria-modal="true" aria-labelledby="setupBuilderTitle">
   <header class="setup-builder-head">
    <div class="setup-builder-brand"><img src="icons/icon.svg" alt=""><div><span>Budget foyer · V2.6</span><h2 id="setupBuilderTitle">Construire mon budget</h2></div></div>
    <div id="setupBuilderProgress" class="setup-builder-progress" aria-label="Progression"></div>
   </header>
   <main id="setupBuilderContent" class="setup-builder-content"></main>
   <div id="setupBuilderStatus" class="setup-builder-status" role="status" aria-live="polite"></div>
   <footer class="setup-builder-actions">
    <button id="setupBuilderBack" class="btn btn-ghost" type="button">Retour</button>
    <button id="setupBuilderSkip" class="setup-builder-skip" type="button">Configurer plus tard</button>
    <button id="setupBuilderNext" class="btn btn-income" type="button">Continuer</button>
   </footer>
  </section>`;
 document.body.appendChild(root);
 root.addEventListener("input",setupBuilderHandleInput);
 root.addEventListener("change",setupBuilderHandleInput);
 document.getElementById("setupBuilderBack").addEventListener("click",()=>setupBuilderGo(-1));
 document.getElementById("setupBuilderNext").addEventListener("click",()=>setupBuilderGo(1));
 document.getElementById("setupBuilderSkip").addEventListener("click",skipSetupBuilder);
 return root;
}
function setupBuilderSetStatus(message="",type=""){
 const node=document.getElementById("setupBuilderStatus");
 if(!node)return;
 node.textContent=message;
 node.className=("setup-builder-status "+type).trim();
}
function openSetupBuilder(){
 if(!activeHouseholdId)return;
 setupBuilderDraft=setupBuilderInitialDraft();
 setupBuilderStep=0;
 const root=ensureSetupBuilder();
 root.classList.add("open");
 root.setAttribute("aria-hidden","false");
 document.documentElement.classList.add("setup-builder-open");
 setupBuilderRender();
}
function closeSetupBuilder(){
 const root=document.getElementById("setupBuilderBackdrop");
 if(root){root.classList.remove("open");root.setAttribute("aria-hidden","true")}
 document.documentElement.classList.remove("setup-builder-open");
}
function skipSetupBuilder(){
 markSetupBuilderComplete();
 closeSetupBuilder();
 showUndoToast?.("Configuration de départ ignorée");
}
function setupBuilderProgress(){
 const labels=["Foyer","Revenus","Dépenses","Abonnements","Résumé"];
 return labels.map((label,index)=>`<span class="${index===setupBuilderStep?"active":index<setupBuilderStep?"done":""}"><b>${index+1}</b><em>${label}</em></span>`).join("");
}
function setupBuilderItemRow(item,data,type){
 const checked=data.selected?"checked":"";
 const disabled=data.selected?"":"disabled";
 const ownerLabel=type==="income"?"Attribution":"Payé par";
 return `<div class="setup-builder-item ${data.selected?"selected":""}" data-builder-row="${item.id}">
   <label class="setup-builder-check">
    <input type="checkbox" data-builder-select="${type}:${item.id}" ${checked}>
    <span><strong>${escapeHtml(item.name)}</strong><small>${item.saving?"Objectif mensuel":"Budget mensuel prévu"}</small></span>
   </label>
   <div class="setup-builder-item-fields">
    <label><span>Montant</span><div class="setup-builder-money"><input type="number" min="0" step="0.01" inputmode="decimal" data-builder-amount="${type}:${item.id}" value="${escapeHtml(data.amount)}" ${disabled}><b>€</b></div></label>
    <label><span>${ownerLabel}</span><select data-builder-owner="${type}:${item.id}" ${disabled}>${setupBuilderOwnerOptions(data.owner)}</select></label>
   </div>
  </div>`;
}
function setupBuilderSubscriptionRow(item,data){
 const selectedPlan=item.plans[data.plan]||item.plans[0];
 return `<div class="setup-builder-item setup-builder-sub ${data.selected?"selected":""}" data-builder-row="sub-${item.id}">
   <label class="setup-builder-check">
    <input type="checkbox" data-builder-select="subscription:${item.id}" ${data.selected?"checked":""}>
    <span><strong>${escapeHtml(item.name)}</strong><small>Tarif vérifié le ${SETUP_BUILDER_UPDATED.split("-").reverse().join("/")}</small></span>
   </label>
   <div class="setup-builder-item-fields">
    <label><span>Formule</span><select data-builder-plan="${item.id}" ${data.selected?"":"disabled"}>${item.plans.map((plan,index)=>`<option value="${index}" ${index===data.plan?"selected":""}>${escapeHtml(plan.name)}</option>`).join("")}</select></label>
    <label><span>Montant</span><div class="setup-builder-money"><input type="number" min="0" step="0.01" inputmode="decimal" data-builder-sub-amount="${item.id}" value="${escapeHtml(data.amount)}" placeholder="${selectedPlan.price==null?"À saisir":""}" ${data.selected?"":"disabled"}><b>€</b></div></label>
    <label><span>Payé par</span><select data-builder-sub-owner="${item.id}" ${data.selected?"":"disabled"}>${setupBuilderOwnerOptions(data.owner)}</select></label>
   </div>
   <a class="setup-builder-source" href="${item.sourceUrl}" target="_blank" rel="noopener">Source : ${escapeHtml(item.source)}</a>
  </div>`;
}
function setupBuilderRender(){
 if(!setupBuilderDraft)return;
 const content=document.getElementById("setupBuilderContent");
 const progress=document.getElementById("setupBuilderProgress");
 const back=document.getElementById("setupBuilderBack");
 const next=document.getElementById("setupBuilderNext");
 progress.innerHTML=setupBuilderProgress();
 back.hidden=setupBuilderStep===0;
 next.textContent=setupBuilderStep===4?"Créer mon budget":"Continuer";
 setupBuilderSetStatus("");
 if(setupBuilderStep===0){
  content.innerHTML=`
   <div class="setup-builder-title"><span>Étape 1 sur 5</span><h3>Votre foyer</h3><p>Ces noms servent uniquement à répartir les revenus et dépenses.</p></div>
   <div class="setup-builder-card setup-builder-household">
    <label><span>Nom du foyer</span><input type="text" maxlength="80" data-builder-household="name" value="${escapeHtml(setupBuilderDraft.household.name)}"></label>
    <label><span>Personne 1</span><input type="text" maxlength="40" data-builder-household="personB" value="${escapeHtml(setupBuilderDraft.household.personB)}"></label>
    <label><span>Personne 2</span><input type="text" maxlength="40" data-builder-household="personA" value="${escapeHtml(setupBuilderDraft.household.personA)}"></label>
   </div>`;
 }else if(setupBuilderStep===1){
  content.innerHTML=`
   <div class="setup-builder-title"><span>Étape 2 sur 5</span><h3>Revenus prévus</h3><p>Cochez ce qui vous concerne. Les montants restent modifiables à tout moment.</p></div>
   <div class="setup-builder-list">${SETUP_BUILDER_INCOMES.map(item=>setupBuilderItemRow(item,setupBuilderDraft.income[item.id],"income")).join("")}</div>`;
 }else if(setupBuilderStep===2){
  content.innerHTML=`
   <div class="setup-builder-title"><span>Étape 3 sur 5</span><h3>Dépenses de base</h3><p>Commencez par les charges que vous prévoyez chaque mois. Aucun montant n’est compté comme dépense réelle.</p></div>
   <div class="setup-builder-list">${SETUP_BUILDER_EXPENSES.map(item=>setupBuilderItemRow(item,setupBuilderDraft.expense[item.id],"expense")).join("")}</div>`;
 }else if(setupBuilderStep===3){
  content.innerHTML=`
   <div class="setup-builder-title"><span>Étape 4 sur 5</span><h3>Abonnements</h3><p>Tarifs publics vérifiés en France le 05/10/2026. Ils sont proposés comme base et restent entièrement modifiables.</p></div>
   <div class="setup-builder-list setup-builder-subscriptions">${SETUP_SUBSCRIPTIONS.map(item=>setupBuilderSubscriptionRow(item,setupBuilderDraft.subscriptions[item.id])).join("")}</div>
   <p class="setup-builder-note">ChatGPT Plus est affiché à 20 $/mois par OpenAI : saisissez le montant réellement prélevé en euros.</p>`;
 }else{
  const totals=setupBuilderTotals();
  content.innerHTML=`
   <div class="setup-builder-title"><span>Étape 5 sur 5</span><h3>Votre budget de départ</h3><p>Vérifiez le résultat. Vous pourrez tout modifier ensuite dans Catégories.</p></div>
   <div class="setup-builder-summary">
    <div><span>Revenus prévus</span><strong>${euro(totals.income)}</strong></div>
    <div><span>Dépenses prévues</span><strong>${euro(totals.expense)}</strong></div>
    <div class="setup-builder-summary-rest"><span>Reste prévu</span><strong>${euro(totals.income-totals.expense)}</strong></div>
   </div>
   <div class="setup-builder-recap">
    <strong>${totals.count} catégorie${totals.count>1?"s":""} configurée${totals.count>1?"s":""}</strong>
    <span>Les montants sont créés comme prévus uniquement. Votre historique réel reste vide.</span>
   </div>`;
 }
}
function setupBuilderHandleInput(event){
 const target=event.target;
 if(!setupBuilderDraft||!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
 if(target.dataset.builderHousehold){
  setupBuilderDraft.household[target.dataset.builderHousehold]=target.value;
  return;
 }
 if(target.dataset.builderSelect){
  const [type,id]=target.dataset.builderSelect.split(":");
  const store=type==="subscription"?setupBuilderDraft.subscriptions:setupBuilderDraft[type];
  if(!store?.[id])return;
  store[id].selected=target.checked;
  setupBuilderRender();
  return;
 }
 if(target.dataset.builderAmount){
  const [type,id]=target.dataset.builderAmount.split(":");
  if(setupBuilderDraft[type]?.[id])setupBuilderDraft[type][id].amount=target.value;
  return;
 }
 if(target.dataset.builderOwner){
  const [type,id]=target.dataset.builderOwner.split(":");
  if(setupBuilderDraft[type]?.[id])setupBuilderDraft[type][id].owner=target.value;
  return;
 }
 if(target.dataset.builderPlan){
  const id=target.dataset.builderPlan,index=Math.max(0,Number(target.value)||0);
  const data=setupBuilderDraft.subscriptions[id],item=SETUP_SUBSCRIPTIONS.find(x=>x.id===id);
  if(!data||!item)return;
  data.plan=index;
  const price=item.plans[index]?.price;
  data.amount=price==null?"":String(price);
  setupBuilderRender();
  return;
 }
 if(target.dataset.builderSubAmount){
  const data=setupBuilderDraft.subscriptions[target.dataset.builderSubAmount];
  if(data)data.amount=target.value;
  return;
 }
 if(target.dataset.builderSubOwner){
  const data=setupBuilderDraft.subscriptions[target.dataset.builderSubOwner];
  if(data)data.owner=target.value;
 }
}
function setupBuilderNumber(value){return Math.max(0,Math.round((Number(String(value).replace(",","."))||0)*100)/100)}
function setupBuilderTotals(){
 let income=0,expense=0,count=0;
 for(const item of SETUP_BUILDER_INCOMES){const d=setupBuilderDraft.income[item.id];if(d.selected){income+=setupBuilderNumber(d.amount);count++}}
 for(const item of SETUP_BUILDER_EXPENSES){const d=setupBuilderDraft.expense[item.id];if(d.selected){expense+=setupBuilderNumber(d.amount);count++}}
 for(const item of SETUP_SUBSCRIPTIONS){const d=setupBuilderDraft.subscriptions[item.id];if(d.selected){expense+=setupBuilderNumber(d.amount);count++}}
 return {income,expense,count};
}
function setupBuilderGo(delta){
 if(delta<0){setupBuilderStep=Math.max(0,setupBuilderStep-1);setupBuilderRender();return}
 if(setupBuilderStep<4){setupBuilderStep++;setupBuilderRender();return}
 finishSetupBuilder();
}
function setupBuilderSetBaseBudget(type,id,amount,owner){
 const budgetMap=type==="income"?state.incomeBudgets:state.categoryBudgets;
 const ownerMap=type==="income"?state.incomeCategoryOwners:state.categoryOwners;
 budgetMap[id]=amount;
 ownerMap[id]=owner||"common";
}
function setupBuilderApplySubscriptions(){
 const setupIds=new Set(SETUP_SUBSCRIPTIONS.map(item=>"setup-sub-"+item.id));
 state.customExpenseCategories=(state.customExpenseCategories||[]).filter(item=>!setupIds.has(item.id));
 for(const item of SETUP_SUBSCRIPTIONS){
  const data=setupBuilderDraft.subscriptions[item.id];
  const id="setup-sub-"+item.id;
  delete state.categoryBudgets[id];
  delete state.categoryOwners[id];
  if(!data.selected)continue;
  const amount=setupBuilderNumber(data.amount),plan=item.plans[data.plan]||item.plans[0];
  state.customExpenseCategories.push({
   id,
   name:item.name,
   budget:amount,
   section:"Abonnements",
   owner:data.owner||"common",
   createdFrom:state.createdMonth,
   custom:true,
   setupPlan:plan.name
  });
  state.categoryBudgets[id]=amount;
  state.categoryOwners[id]=data.owner||"common";
 }
}
async function finishSetupBuilder(){
 if(!setupBuilderDraft||!activeHouseholdId)return;
 const next=document.getElementById("setupBuilderNext");
 next.disabled=true;
 setupBuilderSetStatus("Création de votre budget…");
 try{
  state.household=normalizeHousehold({
   name:String(setupBuilderDraft.household.name||"Mon foyer").trim()||"Mon foyer",
   personB:String(setupBuilderDraft.household.personB||"Personne 1").trim()||"Personne 1",
   personA:String(setupBuilderDraft.household.personA||"Personne 2").trim()||"Personne 2"
  });
  for(const item of SETUP_BUILDER_INCOMES){
   const data=setupBuilderDraft.income[item.id];
   setupBuilderSetBaseBudget("income",item.id,data.selected?setupBuilderNumber(data.amount):0,data.owner);
  }
  for(const item of SETUP_BUILDER_EXPENSES){
   const data=setupBuilderDraft.expense[item.id];
   setupBuilderSetBaseBudget("expense",item.id,data.selected?setupBuilderNumber(data.amount):0,data.owner);
  }
  setupBuilderApplySubscriptions();
  state.onboardingComplete=true;
  applyCategoryState();
  syncHouseholdUi();
  render();
  saveState();
  await cloudPushLocalState({force:true});
  markSetupBuilderComplete();
  setupBuilderSetStatus("Budget créé.","success");
  setTimeout(()=>{closeSetupBuilder();showUndoToast?.("Budget de départ créé")},350);
 }catch(error){
  console.error("Setup builder",error);
  setupBuilderSetStatus(error?.message||"Impossible de créer le budget. Réessaie.","error");
 }finally{next.disabled=false}
}
