// V2.9 — Builder de premier budget
// Contrôleur unique : un seul arbre DOM persistant, une seule délégation d'événements.
const SETUP_BUILDER_PREFIX="budget-foyer-v2.6-setup-builder:";
const SETUP_BUILDER_UPDATED="2026-10-05";
const SETUP_BUILDER_CONTROLLER_VERSION="2.7.1";

const SETUP_BUILDER_INCOMES=[
 {id:"salary-b",name:"Salaire personne 1",selected:true,owner:"B",kind:"salary"},
 {id:"salary-a",name:"Salaire personne 2",selected:true,owner:"A",kind:"salary"},
 {id:"benefits",name:"Aides / allocations",selected:false,owner:"common",kind:"benefits"}
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
 {id:"netflix",name:"Netflix",owner:"common",source:"Netflix",sourceUrl:"https://www.netflix.com/fr-fr/",plans:[{name:"Standard avec pub",price:7.99},{name:"Standard",price:14.99},{name:"Premium",price:21.99}]},
 {id:"spotify",name:"Spotify Premium",owner:"common",source:"Spotify",sourceUrl:"https://www.spotify.com/fr/premium/",plans:[{name:"Personnel",price:12.14},{name:"Duo",price:17.20},{name:"Famille",price:21.24},{name:"Étudiants",price:7.07}]},
 {id:"disney",name:"Disney+",owner:"common",source:"Disney+",sourceUrl:"https://www.disneyplus.com/fr-fr",plans:[{name:"Standard avec pub",price:6.99},{name:"Standard",price:10.99},{name:"Premium",price:15.99}]},
 {id:"prime",name:"Amazon Prime",owner:"common",source:"Amazon France",sourceUrl:"https://www.amazon.fr/amazonprime",plans:[{name:"Mensuel",price:6.99}]},
 {id:"icloud",name:"iCloud+",owner:"B",source:"Apple",sourceUrl:"https://support.apple.com/fr-fr/108047",plans:[{name:"50 Go",price:.99},{name:"200 Go",price:2.99},{name:"2 To",price:9.99}]},
 {id:"discord",name:"Discord Nitro",owner:"B",source:"Discord",sourceUrl:"https://support.discord.com/hc/fr/articles/4407269525911",plans:[{name:"Nitro Basic",price:2.99},{name:"Nitro",price:9.99}]},
 {id:"chatgpt",name:"ChatGPT Plus",owner:"B",source:"OpenAI",sourceUrl:"https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus",plans:[{name:"Plus · 20 $/mois",price:null}]}
];

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

class SetupBuilderController{
 constructor(){
  this.root=null;
  this.step=0;
  this.draft=null;
  this.editingName="";
  this.originalAppearance=null;
  this.customPickerOpen=false;
  this.dragTarget=null;
  this.customPickerHsv=null;
  this.appearanceCommitTimer=null;
  this.appearanceFrame=0;
  this.pendingAppearancePoint=null;
  this.busy=false;

  this.onClick=this.onClick.bind(this);
  this.onInput=this.onInput.bind(this);
  this.onChange=this.onChange.bind(this);
  this.onKeyDown=this.onKeyDown.bind(this);
  this.onPointerDown=this.onPointerDown.bind(this);
  this.onPointerMove=this.onPointerMove.bind(this);
  this.onPointerUp=this.onPointerUp.bind(this);
 }

 ensureRoot(){
  let root=document.getElementById("setupBuilderBackdrop");
  if(root&&root.dataset.controllerVersion!==SETUP_BUILDER_CONTROLLER_VERSION){
   root.remove();
   root=null;
  }
  if(root){
   this.root=root;
   return root;
  }

  root=document.createElement("div");
  root.id="setupBuilderBackdrop";
  root.className="setup-builder-backdrop";
  root.dataset.controllerVersion=SETUP_BUILDER_CONTROLLER_VERSION;
  root.setAttribute("aria-hidden","true");
  root.innerHTML=`
   <section class="setup-builder-panel" role="dialog" aria-modal="true" aria-labelledby="setupBuilderTitle">
    <header class="setup-builder-head">
     <div class="setup-builder-brand">
      ${typeof themeLogoMarkup==="function"?themeLogoMarkup("theme-logo setup-builder-logo"):""}
      <div><span>Smart Budget · V3.1</span><h2 id="setupBuilderTitle">Construire mon budget</h2></div>
     </div>
     <div id="setupBuilderProgress" class="setup-builder-progress" aria-label="Progression"></div>
    </header>
    <main id="setupBuilderContent" class="setup-builder-content"></main>
    <div id="setupBuilderStatus" class="setup-builder-status" role="status" aria-live="polite"></div>
    <footer class="setup-builder-actions">
     <button class="btn btn-ghost" type="button" data-setup-action="back">Retour</button>
     <button class="setup-builder-skip" type="button" data-setup-action="skip">Configurer plus tard</button>
     <button class="btn setup-primary" type="button" data-setup-action="next">Continuer</button>
    </footer>
   </section>`;

  root.addEventListener("click",this.onClick);
  root.addEventListener("input",this.onInput);
  root.addEventListener("change",this.onChange);
  root.addEventListener("keydown",this.onKeyDown);
  root.addEventListener("pointerdown",this.onPointerDown);
  root.addEventListener("pointermove",this.onPointerMove);
  root.addEventListener("pointerup",this.onPointerUp);
  root.addEventListener("pointercancel",this.onPointerUp);

  document.body.appendChild(root);
  this.root=root;
  return root;
 }

 open(){
  if(!activeHouseholdId)return;
  this.originalAppearance=typeof currentUserAppearance==="function"?currentUserAppearance():null;
  this.householdId=activeHouseholdId;
  this.initialDigest=cloudSyncDigest();
  this.prepared=false;
  this.draft=this.createInitialDraft();
  this.step=0;
  this.editingName="";
  this.customPickerOpen=this.draft.appearance.color==="custom";
  this.customPickerHsv=hexToHsv(this.draft.appearance.customColor);
  clearTimeout(this.appearanceCommitTimer);
  this.appearanceCommitTimer=null;
  this.busy=false;

  const root=this.ensureRoot();
  root.classList.add("open");
  root.setAttribute("aria-hidden","false");
  document.documentElement.classList.add("setup-builder-open");
  this.render({preserveScroll:false});
 }

 close(){
  if(!this.root)return;
  this.root.classList.remove("open");
  this.root.setAttribute("aria-hidden","true");
  document.documentElement.classList.remove("setup-builder-open");
  this.dragTarget=null;
  this.pendingAppearancePoint=null;
  if(this.appearanceFrame)cancelAnimationFrame(this.appearanceFrame);
  this.appearanceFrame=0;
  clearTimeout(this.appearanceCommitTimer);
  this.appearanceCommitTimer=null;
 }

 createInitialDraft(){
  const household=normalizeHousehold(state.household);
  const mode=household.mode==="solo"?"solo":"couple";

  const income={};
  SETUP_BUILDER_INCOMES.forEach(item=>{
   let name=item.name;
   if(item.id==="salary-b")name=`Salaire ${household.personB}`;
   if(item.id==="salary-a")name=`Salaire ${household.personA}`;
   income[item.id]={
    selected:item.owner==="A"&&mode==="solo"?false:!!item.selected,
    amount:"",
    owner:item.owner,
    name,
    renamed:false
   };
  });

  const expense={};
  SETUP_BUILDER_EXPENSES.forEach(item=>{
   let name=item.name;
   if(item.id==="phone-b")name=`Téléphone ${household.personB}`;
   if(item.id==="phone-a")name=`Téléphone ${household.personA}`;
   if(item.id==="saving-b")name=`Épargne ${household.personB}`;
   if(item.id==="saving-a")name=`Épargne ${household.personA}`;
   expense[item.id]={
    selected:item.owner==="A"&&mode==="solo"?false:!!item.selected,
    amount:"",
    owner:item.owner,
    name,
    section:item.section,
    renamed:false
   };
  });

  const subscriptions={};
  SETUP_SUBSCRIPTIONS.forEach(item=>{
   const first=item.plans[0];
   subscriptions[item.id]={
    selected:false,
    plan:0,
    amount:first.price==null?"":String(first.price),
    owner:item.owner,
    name:item.name,
    custom:false
   };
  });

  return {
   household:{
    name:household.name,
    personB:household.personB,
    personA:household.personA,
    mode
   },
   appearance:typeof currentUserAppearance==="function"
    ?currentUserAppearance()
    :{color:"green",font:"current",customColor:"#7C73D8"},
   income,
   expense,
   subscriptions,
   customIncome:[],
   customExpense:[],
   customSubscriptions:[]
  };
 }

 isSolo(){return this.draft?.household?.mode==="solo"}

 personName(owner){
  const h=this.draft?.household||state.household;
  if(owner==="B")return h.personB||"Personne 1";
  if(owner==="A")return h.personA||"Personne 2";
  return this.isSolo()?(h.personB||"Moi"):"À deux";
 }

 ownerOptions(selected){
  if(this.isSolo())return `<option value="B" selected>${escapeHtml(this.personName("B"))}</option>`;
  return [["common","À deux"],["B",this.personName("B")],["A",this.personName("A")]]
   .map(([value,label])=>`<option value="${value}" ${selected===value?"selected":""}>${escapeHtml(label)}</option>`)
   .join("");
 }

 effectiveOwner(owner){return this.isSolo()?"B":owner||"common"}

 visibleBaseIncomes(){
  return SETUP_BUILDER_INCOMES.filter(item=>!this.isSolo()||item.owner!=="A");
 }

 visibleBaseExpenses(){
  return SETUP_BUILDER_EXPENSES.filter(item=>!this.isSolo()||item.owner!=="A");
 }

 number(value){
  const amount=Number(String(value??"").replace(",","."));
  return Number.isFinite(amount)?Math.max(0,Math.round(amount*100)/100):0;
 }

 setStatus(message="",type=""){
  const node=this.root?.querySelector("#setupBuilderStatus");
  if(!node)return;
  node.textContent=message;
  node.className=("setup-builder-status "+type).trim();
 }

 progressMarkup(){
  const labels=["Foyer","Revenus","Charges","Abonnements","Épargne","Budgets","Bilan"];
  return labels.map((label,index)=>
   `<button type="button" data-step="${index}" aria-label="Étape ${index+1} · ${label}" ${index===this.step?'aria-current="step"':""} ${index>=this.step||this.prepared||this.busy?"disabled":""} class="${index<this.step?"done":""}"><b>${index+1}</b><em>${label}</em></button>`
  ).join("");
 }

 domId(key){return "setup-builder-"+String(key).replace(/[^a-z0-9_-]+/gi,"-")}

 nameMarkup(key,name){
  if(this.editingName===key){
   return `<input class="setup-builder-inline-name" type="text" maxlength="60" data-setup-name="${escapeHtml(key)}" value="${escapeHtml(name)}" autofocus>`;
  }
  return `<strong>${escapeHtml(name)}</strong>`;
 }

 rowActions(key){
  return `<div class="setup-builder-row-actions">
   <button class="setup-builder-rename" type="button" data-setup-action="rename" data-key="${escapeHtml(key)}">${this.editingName===key?"OK":"Renommer"}</button>
  </div>`;
 }

 itemRow(item,data,type,keyOverride=""){
  const key=keyOverride||`${type}:${item.id}`;
  const checkId=this.domId(key);
  const disabled=data.selected?"":"disabled";
  const name=data.name||item.name||"Catégorie";
  const ownerLabel=type==="income"?"Attribué à":"Payé par";

  return `<div class="setup-builder-item ${data.selected?"selected":""}" data-builder-row="${escapeHtml(key)}">
   <div class="setup-builder-item-head">
    <div class="setup-builder-check">
     <input id="${checkId}" type="checkbox" data-setup-select="${escapeHtml(key)}" ${data.selected?"checked":""}>
     <div class="setup-builder-name-wrap">
      ${this.editingName===key
       ?this.nameMarkup(key,name)
       :`<label for="${checkId}">${this.nameMarkup(key,name)}<small>${item.saving?"Objectif mensuel":"Budget mensuel prévu"}</small></label>`}
     </div>
    </div>
    ${this.rowActions(key)}
   </div>
   <div class="setup-builder-item-fields">
    <label>
     <span>Montant</span>
     <div class="setup-builder-money">
      <input type="number" min="0" max="99999999" step="0.01" inputmode="decimal" data-setup-amount="${escapeHtml(key)}" value="${escapeHtml(data.amount)}" ${disabled}>
      <b>€</b>
     </div>
    </label>
    ${this.isSolo()?"":`<label><span>${ownerLabel}</span><select data-setup-owner="${escapeHtml(key)}" ${disabled}>${this.ownerOptions(data.owner)}</select></label>`}
    ${type==="expense"&&data.custom
     ?`<label><span>Groupe</span><select data-setup-section="${escapeHtml(key)}" ${disabled}>
       <option ${data.section==="Obligatoires"?"selected":""}>Obligatoires</option>
       <option ${data.section==="Abonnements"?"selected":""}>Abonnements</option>
       <option ${data.section==="Vie courante"?"selected":""}>Vie courante</option>
      </select></label>`
     :""}
   </div>
  </div>`;
 }

 subscriptionMonthlyCents(data){
  const billedCents=Math.round(this.number(data.amount)*100);
  return data.period==="annual"?Math.round(billedCents/12):billedCents;
 }

 subscriptionRow(item,data,keyOverride=""){
  const key=keyOverride||`subscription:${item.id}`;
  const checkId=this.domId(key);
  const custom=!!data.custom;
  const plan=item.plans?.[data.plan]||item.plans?.[0];
  const disabled=data.selected?"":"disabled";

  return `<div class="setup-builder-item setup-builder-sub ${data.selected?"selected":""}" data-builder-row="${escapeHtml(key)}">
   <div class="setup-builder-item-head">
    <div class="setup-builder-check">
     <input id="${checkId}" type="checkbox" data-setup-select="${escapeHtml(key)}" ${data.selected?"checked":""}>
     <div class="setup-builder-name-wrap">
      ${this.editingName===key
       ?this.nameMarkup(key,data.name||item.name)
       :`<label for="${checkId}">${this.nameMarkup(key,data.name||item.name)}<small>${custom?"Abonnement personnalisé":`Tarif indicatif · vérifié le ${SETUP_BUILDER_UPDATED.split("-").reverse().join("/")}`}</small></label>`}
     </div>
    </div>
    ${this.rowActions(key)}
   </div>
   <div class="setup-builder-item-fields">
    ${custom?"":`<label><span>Formule</span><select data-setup-plan="${item.id}" ${disabled}>
      ${item.plans.map((p,index)=>`<option value="${index}" ${index===data.plan?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
     </select></label>`}
    <label>
     <span>Montant</span>
     <div class="setup-builder-money">
      <input type="number" min="0" max="99999999" step="0.01" inputmode="decimal" data-setup-sub-amount="${escapeHtml(key)}" value="${escapeHtml(data.amount)}" placeholder="${plan?.price==null&&!custom?"À saisir":""}" ${disabled}>
      <b>€</b>
     </div>
    </label>
    <label><span>Facturation</span><select data-setup-period="${escapeHtml(key)}" ${disabled}>
     <option value="monthly">Mensuelle</option><option value="annual" ${data.period==="annual"?"selected":""}>Annuelle</option>
    </select></label>
    ${this.isSolo()?"":`<label><span>Payé par</span><select data-setup-sub-owner="${escapeHtml(key)}" ${disabled}>${this.ownerOptions(data.owner)}</select></label>`}
   </div>
   ${!custom&&item.sourceUrl?`<a class="setup-builder-source" href="${item.sourceUrl}" target="_blank" rel="noopener">Source : ${escapeHtml(item.source)}</a>`:""}
  </div>`;
 }

 addCard(type,label){
  return `<button class="setup-builder-add" type="button" data-setup-action="add" data-add-type="${type}">
   <span>＋</span><strong>${escapeHtml(label)}</strong><small>Créer rapidement une catégorie supplémentaire</small>
  </button>`;
 }

 appearanceMarkup(){
  const a=normalizeUserAppearance(this.draft.appearance);
  const customOpen=this.customPickerOpen;

  return `<div class="appearance-picker" data-setup-appearance>
   <div class="appearance-picker-group">
    <span class="appearance-picker-label">Couleur principale</span>
    <div class="appearance-colors">
     ${Object.entries(APPEARANCE_COLORS).map(([id,item])=>
      `<button type="button" class="appearance-color ${a.color===id?"active":""}" data-setup-color="${id}" style="--swatch:${item.accent}" aria-label="${escapeHtml(item.label)}"><i></i><span>${escapeHtml(item.label)}</span></button>`
     ).join("")}
     <button type="button" class="appearance-color appearance-color-custom ${a.color==="custom"?"active":""}" data-setup-action="custom-color" aria-expanded="${customOpen}">
      <svg class="appearance-custom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3L17.8 5a2.1 2.1 0 0 0-3 0L4 15.8V20Z"/><path d="m13.6 6.2 4.2 4.2"/><path d="M4 15.8 8.2 20"/></svg>
      <span>Personnalisé</span>
     </button>
    </div>
    ${customOpen?appearanceCustomPanelMarkup(a):""}
   </div>
   <div class="appearance-picker-group">
    <span class="appearance-picker-label">Police</span>
    <div class="appearance-fonts">
     ${Object.entries(APPEARANCE_FONTS).map(([id,item])=>
      `<button type="button" class="appearance-font ${a.font===id?"active":""}" data-setup-font="${id}" style="font-family:${item.stack}"><strong>${escapeHtml(item.sample)}</strong><span>${escapeHtml(item.label)}</span></button>`
     ).join("")}
    </div>
   </div>
  </div>`;
 }

 stepMarkup(){
  if(this.step===0){
   const solo=this.isSolo();
   return `
    <div class="setup-builder-title"><span>Étape 1 sur 7</span><h3>Votre foyer</h3><p>Choisissez si vous gérez votre budget seul ou à deux. Ce choix reste modifiable plus tard dans Paramètres.</p></div>
    <div class="setup-builder-mode" role="group" aria-label="Type de foyer">
     <button type="button" data-setup-mode="solo" class="${solo?"active":""}"><b>Seul</b><span>Un seul budget personnel</span></button>
     <button type="button" data-setup-mode="couple" class="${!solo?"active":""}"><b>À deux</b><span>Répartition entre deux personnes</span></button>
    </div>
    <div class="setup-builder-card setup-builder-household">
     <label><span>Nom du foyer</span><input type="text" maxlength="80" data-setup-household="name" value="${escapeHtml(this.draft.household.name)}"></label>
     <label><span>${solo?"Votre nom":"Personne 1"}</span><input type="text" maxlength="40" data-setup-household="personB" value="${escapeHtml(this.draft.household.personB)}"></label>
     ${solo?"":`<label><span>Personne 2</span><input type="text" maxlength="40" data-setup-household="personA" value="${escapeHtml(this.draft.household.personA)}"></label>`}
    </div>
    <div class="setup-builder-appearance-card">
     <div class="setup-builder-appearance-copy"><span>APPARENCE</span><strong>Personnaliser votre interface</strong><p>La couleur et la police sont propres à votre compte.</p></div>
     ${this.appearanceMarkup()}
    </div>`;
  }

  if(this.step===1){
   return `
    <div class="setup-builder-title"><span>Étape 2 sur 7</span><h3>Revenus prévus</h3><p>Cochez uniquement les revenus qui vous concernent. Une catégorie décochée ne sera pas créée dans votre budget.</p></div>
    <div class="setup-builder-list">
     ${this.visibleBaseIncomes().map(item=>this.itemRow(item,this.draft.income[item.id],"income")).join("")}
     ${this.draft.customIncome.map(data=>this.itemRow({id:data.id,name:data.name},data,"income",`customIncome:${data.id}`)).join("")}
     ${this.addCard("income","Ajouter une catégorie de revenu")}
    </div>`;
  }

  if(this.step===2){
   return `
    <div class="setup-builder-title"><span>Étape 3 sur 7</span><h3>Dépenses de base</h3><p>Activez seulement les charges utiles. Les montants restent des prévisions et ne créent aucune dépense réelle.</p></div>
    <div class="setup-builder-list">
     ${this.visibleBaseExpenses().filter(item=>!item.saving&&!["fuel","groceries"].includes(item.id)).map(item=>this.itemRow(item,this.draft.expense[item.id],"expense")).join("")}
     ${this.draft.customExpense.filter(data=>!data.saving&&!data.envelope).map(data=>this.itemRow({id:data.id,name:data.name,saving:false},data,"expense",`customExpense:${data.id}`)).join("")}
     ${this.addCard("expense","Ajouter une dépense personnalisée")}
    </div>`;
  }

  if(this.step===3){
   return `
    <div class="setup-builder-title"><span>Étape 4 sur 7</span><h3>Abonnements</h3><p>Activez uniquement vos abonnements. Les tarifs proposés sont modifiables.</p></div>
    <div class="setup-builder-list setup-builder-subscriptions">
     ${SETUP_SUBSCRIPTIONS.map(item=>this.subscriptionRow(item,this.draft.subscriptions[item.id])).join("")}
     ${this.draft.customSubscriptions.map(data=>this.subscriptionRow({id:data.id,name:data.name,plans:[]},data,`customSubscription:${data.id}`)).join("")}
     ${this.addCard("subscription","Ajouter un abonnement")}
    </div>
    <p class="setup-builder-note">Les tarifs servent uniquement d’aide à la saisie. Le budget mensuel d’un abonnement annuel correspond au montant saisi divisé par douze, arrondi au centime.</p>`;
  }

  if(this.step===4){
   const rows=this.visibleBaseExpenses().filter(item=>item.saving).map(item=>this.goalRow(item,this.draft.expense[item.id],"expense:"+item.id));
   for(const data of this.draft.customExpense.filter(row=>row.saving))rows.push(this.goalRow(data,data,"customExpense:"+data.id));
   return '<div class="setup-builder-title"><span>Étape 5 sur 7</span><h3>Objectifs d’épargne</h3><p>Le montant mensuel devient le budget de la catégorie d’épargne. La cible et la durée servent au calcul.</p></div><div class="setup-builder-list">'+rows.join("")+this.addCard("saving","Ajouter un objectif")+'</div>';
  }
  if(this.step===5){
   const rows=this.visibleBaseExpenses().filter(item=>["fuel","groceries"].includes(item.id)).map(item=>this.itemRow(item,this.draft.expense[item.id],"expense"));
   for(const data of this.draft.customExpense.filter(row=>row.envelope))rows.push(this.itemRow(data,data,"expense","customExpense:"+data.id));
   return '<div class="setup-builder-title"><span>Étape 6 sur 7</span><h3>Budgets du mois</h3><p>Répartis les montants prévus pour la vie courante.</p></div><div class="setup-builder-list">'+rows.join("")+this.addCard("envelope","Ajouter un budget")+'</div>';
  }
  const groups=this.monthlyLines();
  const totals=this.totals(groups);
  return `
   <div class="setup-builder-title"><span>Étape 7 sur 7</span><h3>Votre budget de départ</h3><p>Vérifiez le résultat avant la création des catégories.</p></div>
   <div class="setup-builder-summary">
    <div><span>Revenus prévus</span><strong>${euro(totals.income)}</strong></div>
    <div><span>Dépenses prévues</span><strong>${euro(totals.expense)}</strong></div>
    <div class="setup-builder-summary-rest"><span>Reste prévu</span><strong>${euro(totals.income-totals.expense)}</strong></div>
   </div>
   <div class="setup-builder-recap">
    <strong>${totals.count} catégorie${totals.count>1?"s":""} active${totals.count>1?"s":""}</strong>
    <span>Mode ${this.isSolo()?"seul":"à deux"} · prévisions mensuelles</span>
   </div>
   ${this.breakdown(groups)}`;
 }

 render({preserveScroll=true}={}){
  if(!this.draft)return;
  const root=this.ensureRoot();
  const content=root.querySelector("#setupBuilderContent");
  const previousScroll=preserveScroll?root.scrollTop:0;

  root.querySelector("#setupBuilderProgress").innerHTML=this.progressMarkup();
  content.innerHTML=this.stepMarkup();

  const back=root.querySelector('[data-setup-action="back"]');
  const next=root.querySelector('[data-setup-action="next"]');
  const skip=root.querySelector('[data-setup-action="skip"]');
  back.hidden=this.step===0;
  next.textContent=this.prepared?"Réessayer la synchronisation":this.step===6?"Créer mon budget":"Continuer";
  next.disabled=this.busy;
  back.disabled=this.busy||this.prepared;
  skip.disabled=this.busy||this.prepared;

  this.setStatus("");

  requestAnimationFrame(()=>{
   root.scrollTop=preserveScroll?previousScroll:0;
   const field=content.querySelector("[data-setup-name]");
   if(field){
    field.focus({preventScroll:true});
    field.select?.();
   }
  });
 }

 getData(key){
  const [type,id]=String(key||"").split(":");
  if(type==="income")return this.draft.income[id]||null;
  if(type==="expense")return this.draft.expense[id]||null;
  if(type==="subscription")return this.draft.subscriptions[id]||null;
  if(type==="customIncome")return this.draft.customIncome.find(item=>item.id===id)||null;
  if(type==="customExpense")return this.draft.customExpense.find(item=>item.id===id)||null;
  if(type==="customSubscription")return this.draft.customSubscriptions.find(item=>item.id===id)||null;
  return null;
 }

 onClick(event){
  const target=event.target instanceof Element?event.target:event.target?.parentElement;
  if(!target||!this.root?.classList.contains("open"))return;

  const stepButton=target.closest("[data-step]");
  if(stepButton&&!stepButton.disabled&&!this.busy&&!this.prepared){this.step=Number(stepButton.dataset.step);this.render({preserveScroll:false});return}
  const action=target.closest("[data-setup-action]");
  if(action){
   const name=action.dataset.setupAction;
   if(name==="next"){event.preventDefault();this.goNext();return}
   if(name==="back"){event.preventDefault();this.goBack();return}
   if(name==="skip"){event.preventDefault();this.skip();return}
   if(name==="rename"){
    event.preventDefault();
    const key=action.dataset.key||"";
    this.editingName=this.editingName===key?"":key;
    this.render();
    return;
   }
   if(name==="add"){
    event.preventDefault();
    this.addCustom(action.dataset.addType);
    return;
   }
   if(name==="custom-color"){
    event.preventDefault();
    this.customPickerOpen=true;
    this.draft.appearance={...normalizeUserAppearance(this.draft.appearance),color:"custom"};
    applyUserAppearance(this.draft.appearance);
    this.render();
    return;
   }
  }

  const mode=target.closest("[data-setup-mode]");
  if(mode){
   event.preventDefault();
   this.setMode(mode.dataset.setupMode);
   return;
  }

  const color=target.closest("[data-setup-color]");
  if(color){
   event.preventDefault();
   this.customPickerOpen=false;
   this.draft.appearance={...normalizeUserAppearance(this.draft.appearance),color:color.dataset.setupColor};
   applyUserAppearance(this.draft.appearance);
   this.render();
   return;
  }

  const font=target.closest("[data-setup-font]");
  if(font){
   event.preventDefault();
   this.draft.appearance={...normalizeUserAppearance(this.draft.appearance),font:font.dataset.setupFont};
   applyUserAppearance(this.draft.appearance);
   this.render();
  }
 }

 onInput(event){
  const target=event.target;
  if(!(target instanceof HTMLInputElement))return;

  if(target.dataset.goal){this.updateGoal(target.dataset.key,target.dataset.goal,target.value);return}
  if(target.dataset.setupHousehold){
   const field=target.dataset.setupHousehold;
   this.draft.household[field]=target.value;
   this.updateDynamicNames(field,target.value);
   return;
  }

  if(target.dataset.setupName){
   const data=this.getData(target.dataset.setupName);
   if(data){data.name=target.value;data.renamed=true}
   return;
  }

  if(target.dataset.setupAmount){
   const data=this.getData(target.dataset.setupAmount);
   if(data){data.amount=target.value;if(target.closest(".setup-goal"))this.updateGoal(target.dataset.setupAmount,"amount",target.value)}
   return;
  }

  if(target.dataset.setupSubAmount){
   const data=this.getData(target.dataset.setupSubAmount);
   if(data)data.amount=target.value;
   return;
  }

  if(target.matches("[data-appearance-hex]")){
   const hex=validAppearanceHex(target.value);
   target.classList.toggle("invalid",!hex);
   if(!hex)return;
   this.draft.appearance={...normalizeUserAppearance(this.draft.appearance),color:"custom",customColor:hex};
   this.customPickerHsv=hexToHsv(hex);
   const picker=this.root.querySelector("[data-setup-appearance]");
   syncAppearanceCustomPanel(picker,this.draft.appearance,{syncHex:false,hsvState:this.customPickerHsv});
  }
 }

 onChange(event){
  const target=event.target;
  if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;

  if(target.dataset.setupSelect){
   const data=this.getData(target.dataset.setupSelect);
   if(data){
    data.selected=!!target.checked;
    this.render();
   }
   return;
  }

  if(target.dataset.setupOwner){
   const data=this.getData(target.dataset.setupOwner);
   if(data)data.owner=target.value;
   return;
  }

  if(target.dataset.setupSection){
   const data=this.getData(target.dataset.setupSection);
   if(data)data.section=target.value;
   return;
  }

  if(target.dataset.setupPlan){
   const id=target.dataset.setupPlan;
   const item=SETUP_SUBSCRIPTIONS.find(entry=>entry.id===id);
   const data=this.draft.subscriptions[id];
   if(!item||!data)return;
   data.period="monthly";
   const period=target.closest("[data-builder-row]")?.querySelector("[data-setup-period]");
   if(period)period.value="monthly";
   const index=Math.max(0,Number(target.value)||0);
   data.plan=index;
   const price=item.plans[index]?.price;
   data.amount=price==null?"":String(price);
   const row=target.closest("[data-builder-row]");
   const amount=row?.querySelector("[data-setup-sub-amount]");
   if(amount)amount.value=data.amount;
   return;
  }

  if(target.dataset.setupPeriod){
   const data=this.getData(target.dataset.setupPeriod);
   if(data)data.period=target.value==="annual"?"annual":"monthly";
   return;
  }
  if(target.dataset.setupSubOwner){
   const data=this.getData(target.dataset.setupSubOwner);
   if(data)data.owner=target.value;
   return;
  }

  if(target.matches("[data-appearance-hex]")){
   const hex=validAppearanceHex(target.value);
   if(!hex){
    target.value=normalizeUserAppearance(this.draft.appearance).customColor;
    target.classList.remove("invalid");
   }else{
    this.customPickerHsv=hexToHsv(hex);
    this.scheduleAppearanceCommit();
   }
  }
 }

 onKeyDown(event){
  const target=event.target;
  if(event.key==="Enter"&&target instanceof HTMLInputElement&&target.dataset.setupName){
   event.preventDefault();
   this.editingName="";
   this.render();
  }
 }

 onPointerDown(event){
  const target=event.target instanceof Element?event.target.closest("[data-appearance-sv],[data-appearance-hue]"):null;
  if(!target||!target.closest("[data-setup-appearance]"))return;
  clearTimeout(this.appearanceCommitTimer);
  this.dragTarget=target;
  target.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  this.updateCustomColorFromPointer(target,{clientX:event.clientX,clientY:event.clientY});
 }

 onPointerMove(event){
  if(!this.dragTarget)return;
  event.preventDefault();
  this.pendingAppearancePoint={clientX:event.clientX,clientY:event.clientY};
  if(this.appearanceFrame)return;
  this.appearanceFrame=requestAnimationFrame(()=>{
   this.appearanceFrame=0;
   if(!this.dragTarget||!this.pendingAppearancePoint)return;
   const point=this.pendingAppearancePoint;
   this.pendingAppearancePoint=null;
   this.updateCustomColorFromPointer(this.dragTarget,point);
  });
 }

 onPointerUp(event){
  if(!this.dragTarget)return;
  if(this.appearanceFrame){cancelAnimationFrame(this.appearanceFrame);this.appearanceFrame=0}
  this.pendingAppearancePoint=null;
  this.updateCustomColorFromPointer(this.dragTarget,{clientX:event.clientX,clientY:event.clientY});
  try{this.dragTarget.releasePointerCapture?.(event.pointerId)}catch{}
  this.dragTarget=null;
  this.scheduleAppearanceCommit();
 }

 scheduleAppearanceCommit(){
  clearTimeout(this.appearanceCommitTimer);
  this.appearanceCommitTimer=setTimeout(()=>{
   this.appearanceCommitTimer=null;
   if(this.draft?.appearance)applyUserAppearance(this.draft.appearance);
  },120);
 }

 updateCustomColorFromPointer(target,event){
  const result=appearanceCustomPointerState(target,event,this.draft.appearance,this.customPickerHsv);
  this.draft.appearance=result.appearance;
  this.customPickerHsv=result.hsv;
  this.customPickerOpen=true;
  const picker=this.root.querySelector("[data-setup-appearance]");
  syncAppearanceCustomPanel(picker,this.draft.appearance,{hsvState:this.customPickerHsv});
 }

 updateDynamicNames(field,value){
  const name=String(value||"").trim()||(field==="personA"?"Personne 2":"Personne 1");
  if(field==="personB"){
   if(!this.draft.income["salary-b"].renamed)this.draft.income["salary-b"].name=`Salaire ${name}`;
   if(!this.draft.expense["phone-b"].renamed)this.draft.expense["phone-b"].name=`Téléphone ${name}`;
   if(!this.draft.expense["saving-b"].renamed)this.draft.expense["saving-b"].name=`Épargne ${name}`;
  }
  if(field==="personA"){
   if(!this.draft.income["salary-a"].renamed)this.draft.income["salary-a"].name=`Salaire ${name}`;
   if(!this.draft.expense["phone-a"].renamed)this.draft.expense["phone-a"].name=`Téléphone ${name}`;
   if(!this.draft.expense["saving-a"].renamed)this.draft.expense["saving-a"].name=`Épargne ${name}`;
  }
 }

 setMode(mode){
  const next=mode==="solo"?"solo":"couple";
  if(this.draft.household.mode===next){
   this.render();
   return;
  }
  this.draft.household.mode=next;
  this.render();
 }

 addCustom(type){
  const id=`setup-${type}-${uid()}`;
  const owner=this.isSolo()?"B":"common";

  if(type==="income"){
   this.draft.customIncome.push({id,name:"Nouveau revenu",selected:true,amount:"",owner,custom:true,renamed:false});
   this.editingName=`customIncome:${id}`;
  }else if(["expense","saving","envelope"].includes(type)){
   this.draft.customExpense.push({id,name:type==="saving"?"Nouvel objectif":type==="envelope"?"Nouveau budget":"Nouvelle dépense",selected:true,amount:"",owner,saving:type==="saving",envelope:type==="envelope",section:type==="envelope"?"Vie courante":"Obligatoires",custom:true,renamed:false});
   this.editingName=`customExpense:${id}`;
  }else if(type==="subscription"){
   this.draft.customSubscriptions.push({id,name:"Nouvel abonnement",selected:true,amount:"",owner,custom:true,renamed:false});
   this.editingName=`customSubscription:${id}`;
  }
  this.render();
 }

 goalRow(item,data,key){
  const disabled=data.selected?"":"disabled";
  return `<div class="setup-goal">${this.itemRow(item,data,"expense",key)}
   <div class="setup-builder-item-fields"><label>Montant à épargner (€)<input type="number" step=".01" min="0" max="99999999" data-goal="target" data-key="${escapeHtml(key)}" value="${escapeHtml(data.target||"")}" ${disabled}></label>
   <label>Durée (mois)<input type="number" min="1" max="1200" step="1" data-goal="duration" data-key="${escapeHtml(key)}" value="${escapeHtml(data.duration||"")}" ${disabled}></label></div></div>`;
 }

 updateGoal(key,field,value){
  const data=this.getData(key);
  if(!data)return;
  data[field]=value;
  const cents=Math.round(this.number(data.target)*100);
  if(field==="amount"){
   const monthly=Math.round(this.number(value)*100);
   data.duration=monthly&&cents?Math.ceil(cents/monthly):"";
  }else if(cents&&Number.isInteger(Number(data.duration))&&Number(data.duration)>0){
   data.amount=(Math.ceil(cents/Number(data.duration))/100).toFixed(2);
  }
  const row=this.root.querySelector(`[data-builder-row="${CSS.escape(key)}"]`)?.closest(".setup-goal");
  if(row&&field!=="amount")row.querySelector("[data-setup-amount]").value=data.amount;
  if(row&&field==="amount")row.querySelector('[data-goal="duration"]').value=data.duration;
 }

 goBack(){
  if(this.busy||this.prepared||this.step<=0)return;
  this.editingName="";
  this.step--;
  this.render({preserveScroll:false});
 }

 goNext(){
  if(this.busy)return;
  const invalid=this.root?.querySelector("input:invalid");
  if(invalid){invalid.reportValidity();return}
  if(this.step<6){
   this.editingName="";
   this.step++;
   this.render({preserveScroll:false});
   return;
  }
  this.finish();
 }

 monthlyLines(){
  const groups={income:[],charges:[],subscriptions:[],savings:[],envelopes:[]};
  const add=(group,data,cents=Math.round(this.number(data.amount)*100))=>{
   if(data.selected)groups[group].push({name:data.name,cents});
  };
  for(const item of this.visibleBaseIncomes())add("income",this.draft.income[item.id]);
  for(const data of this.draft.customIncome)add("income",data);
  for(const item of this.visibleBaseExpenses()){
   const group=item.saving?"savings":["groceries","fuel"].includes(item.id)?"envelopes":"charges";
   add(group,this.draft.expense[item.id]);
  }
  for(const data of this.draft.customExpense)add(data.saving?"savings":data.envelope?"envelopes":"charges",data);
  const subscriptions=[...Object.values(this.draft.subscriptions),...this.draft.customSubscriptions];
  for(const data of subscriptions)add("subscriptions",data,this.subscriptionMonthlyCents(data));
  return groups;
 }

 totals(groups=this.monthlyLines()){
  const sum=rows=>rows.reduce((total,row)=>total+row.cents,0);
  const expenses=[...groups.charges,...groups.subscriptions,...groups.savings,...groups.envelopes];
  return {income:sum(groups.income)/100,expense:sum(expenses)/100,count:groups.income.length+expenses.length};
 }

 breakdown(groups){
  const labels={income:"Revenus",charges:"Charges fixes",subscriptions:"Abonnements",savings:"Épargne",envelopes:"Budgets du mois"};
  return Object.entries(groups).filter(([,rows])=>rows.length).map(([group,rows])=>{
   const total=rows.reduce((sum,row)=>sum+row.cents,0);
   return `<details class="setup-breakdown"><summary>${labels[group]} <strong>${euro(total/100)}</strong></summary><dl>${rows.map(row=>
    `<div><dt>${escapeHtml(row.name)}</dt><dd>${euro(row.cents/100)}</dd></div>`).join("")}</dl></details>`;
  }).join("");
 }

 async skip(){
  if(this.busy)return;
  if(this.originalAppearance&&typeof applyUserAppearance==="function")applyUserAppearance(this.originalAppearance);
  markSetupBuilderComplete();
  state.onboardingComplete=true;
  saveState();
  this.close();
  showUndoToast?.("Configuration de départ ignorée");
  if(typeof cloudPushLocalState==="function"){
   cloudPushLocalState({force:true}).catch(error=>console.error("Setup builder skip sync",error));
  }
 }

 applyBaseCategories(){
  const selectedIncome=new Set();
  const selectedExpense=new Set();

  for(const item of SETUP_BUILDER_INCOMES){
   const data=this.draft.income[item.id];
   const eligible=!this.isSolo()||item.owner!=="A";
   const selected=eligible&&!!data.selected;
   state.incomeBudgets[item.id]=selected?this.number(data.amount):0;
   state.incomeCategoryOwners[item.id]=this.effectiveOwner(data.owner);
   state.incomeCategoryNames[item.id]=String(data.name||item.name).trim()||item.name;
   if(selected)selectedIncome.add(item.id);
  }

  for(const item of SETUP_BUILDER_EXPENSES){
   const data=this.draft.expense[item.id];
   const eligible=!this.isSolo()||item.owner!=="A";
   const selected=eligible&&!!data.selected;
   state.categoryBudgets[item.id]=selected?this.number(data.amount):0;
   state.categoryOwners[item.id]=this.effectiveOwner(data.owner);
   state.categoryNames[item.id]=String(data.name||item.name).trim()||item.name;
   if(selected)selectedExpense.add(item.id);
  }

  state.deletedIncomeCategoriesGlobal=(state.baseIncomeCategories||[])
   .map(item=>item.id)
   .filter(id=>!selectedIncome.has(id));

  state.deletedCategoriesGlobal=(state.baseExpenseCategories||[])
   .map(item=>item.id)
   .filter(id=>!selectedExpense.has(id));
 }

 applyCustomCategories(){
  // Keep unrelated categories, including rows produced by an earlier setup.
  const incomes=new Set(this.draft.customIncome.filter(row=>row.selected).map(row=>row.id));
  const expenses=new Set([
   ...this.draft.customExpense,...this.draft.customSubscriptions
  ].filter(row=>row.selected).map(row=>row.id));
  for(const item of SETUP_SUBSCRIPTIONS){
   if(this.draft.subscriptions[item.id].selected)expenses.add("setup-sub-"+item.id);
  }
  state.customIncomeCategories=(state.customIncomeCategories||[]).filter(row=>!incomes.has(row.id));
  state.customExpenseCategories=(state.customExpenseCategories||[]).filter(row=>!expenses.has(row.id));

  for(const data of this.draft.customIncome){
   if(!data.selected)continue;
   const name=String(data.name||"Revenu").trim()||"Revenu";
   const budget=this.number(data.amount);
   const owner=this.effectiveOwner(data.owner);
   state.customIncomeCategories.push({id:data.id,name,budget,owner,createdFrom:state.createdMonth,custom:true});
   state.incomeBudgets[data.id]=budget;
   state.incomeCategoryOwners[data.id]=owner;
  }

  for(const data of this.draft.customExpense){
   if(!data.selected)continue;
   const name=String(data.name||"Dépense").trim()||"Dépense";
   const budget=this.number(data.amount);
   const owner=this.effectiveOwner(data.owner);
   state.customExpenseCategories.push({
    id:data.id,name,budget,owner,saving:!!data.saving,
    section:["Obligatoires","Abonnements","Vie courante"].includes(data.section)?data.section:"Obligatoires",
    createdFrom:state.createdMonth,custom:true
   });
   state.categoryBudgets[data.id]=budget;
   state.categoryOwners[data.id]=owner;
  }

  for(const item of SETUP_SUBSCRIPTIONS){
   const data=this.draft.subscriptions[item.id];
   if(!data.selected)continue;
   const id=`setup-sub-${item.id}`;
   const plan=item.plans[data.plan]||item.plans[0];
   const name=String(data.name||item.name).trim()||item.name;
   const budget=this.subscriptionMonthlyCents(data)/100;
   const owner=this.effectiveOwner(data.owner);
   state.customExpenseCategories.push({
    id,name,budget,owner,section:"Abonnements",
    createdFrom:state.createdMonth,custom:true,setupPlan:plan?.name||""
   });
   state.categoryBudgets[id]=budget;
   state.categoryOwners[id]=owner;
  }

  for(const data of this.draft.customSubscriptions){
   if(!data.selected)continue;
   const name=String(data.name||"Abonnement").trim()||"Abonnement";
   const budget=this.subscriptionMonthlyCents(data)/100;
   const owner=this.effectiveOwner(data.owner);
   state.customExpenseCategories.push({
    id:data.id,name,budget,owner,section:"Abonnements",
    createdFrom:state.createdMonth,custom:true
   });
   state.categoryBudgets[data.id]=budget;
   state.categoryOwners[data.id]=owner;
  }
 }

 async finish(){
  if(this.busy||!activeHouseholdId||activeHouseholdId!==this.householdId)return;
  if(!navigator.onLine||!cloudSession||!cloudSyncReady||cloudPushInProgress){
   this.setStatus("Connexion ou synchronisation en attente. Ton brouillon est conservé.","error");return;
  }
  if(!this.prepared&&this.initialDigest!==cloudSyncDigest()){
   this.setStatus("Le foyer a changé pendant la configuration. Vérifie son état avant de recommencer.","error");return;
  }
  this.busy=true;
  this.render();
  this.setStatus("Création du budget et synchronisation…");

  try{
   if(!this.prepared){
    state.household=normalizeHousehold({
     name:String(this.draft.household.name||"Mon foyer").trim()||"Mon foyer",
     personB:String(this.draft.household.personB||"Personne 1").trim()||"Personne 1",
     personA:String(this.draft.household.personA||"Personne 2").trim()||"Personne 2",
     mode:this.draft.household.mode
    });

    this.applyBaseCategories();
    this.applyCustomCategories();
    state.onboardingComplete=true;

    applyCategoryState();
    syncHouseholdUi();
    render();
    this.prepared=true;
    saveState();
   }

   if(typeof saveUserAppearance==="function")await saveUserAppearance(this.draft.appearance);
   if(activeHouseholdId!==this.householdId)throw Error("Le foyer actif a changé.");
   await cloudPushLocalState({force:true});
   if(activeHouseholdId!==this.householdId||!cloudSession||cloudUnsyncedSession||cloudPushInProgress||!navigator.onLine)throw Error("Configuration en attente de synchronisation.");

   markSetupBuilderComplete(this.householdId);
   this.originalAppearance=null;
   this.close();
   showUndoToast?.("Budget de départ créé");
  }catch(error){
   this.busy=false;
   this.render();
   this.setStatus(error?.message||"Impossible de créer le budget. Réessaie.","error");
  }finally{this.busy=false}
 }
}

const setupBuilderController=new SetupBuilderController();

function openSetupBuilder(){setupBuilderController.open()}
function closeSetupBuilder(){setupBuilderController.close()}
function skipSetupBuilder(){setupBuilderController.skip()}
function setupBuilderGo(delta){delta<0?setupBuilderController.goBack():setupBuilderController.goNext()}
