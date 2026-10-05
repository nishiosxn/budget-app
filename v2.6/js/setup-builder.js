// V2.6 — assistant de création du budget
// Contrôleur stabilisé : un seul root persistant + délégation d'événements locale.
// Le contenu des étapes peut être rerendu librement sans perdre les interactions.

const SETUP_BUILDER_PREFIX="budget-foyer-v2.6-setup-builder:";
const SETUP_BUILDER_UPDATED="2026-10-05";

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

let setupBuilderStep=0;
let setupBuilderDraft=null;
let setupBuilderEditingName="";
let setupBuilderOriginalAppearance=null;
let setupBuilderPointerTarget=null;

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

function setupBuilderMode(){
 return setupBuilderDraft?.household?.mode==="solo"?"solo":"couple";
}
function setupBuilderIsSolo(){
 return setupBuilderMode()==="solo";
}
function setupBuilderPersonName(owner){
 const household=setupBuilderDraft?.household||state.household;
 if(owner==="B")return household.personB||"Personne 1";
 if(owner==="A")return household.personA||"Personne 2";
 return setupBuilderIsSolo()?(household.personB||"Moi"):"À deux";
}
function setupBuilderOwnerOptions(selected){
 if(setupBuilderIsSolo()){
  return `<option value="B" selected>${escapeHtml(setupBuilderPersonName("B"))}</option>`;
 }
 return [["common","À deux"],["B",setupBuilderPersonName("B")],["A",setupBuilderPersonName("A")]]
  .map(([value,label])=>`<option value="${value}" ${selected===value?"selected":""}>${escapeHtml(label)}</option>`)
  .join("");
}
function setupBuilderDefaultOwner(owner){
 return setupBuilderIsSolo()?"B":owner||"common";
}
function setupBuilderNumber(value){
 return Math.max(0,Math.round((Number(String(value??"").replace(",","."))||0)*100)/100);
}

function setupBuilderInitialDraft(){
 const household=normalizeHousehold(state.household);
 const mode=household.mode==="solo"?"solo":"couple";
 const income={};
 SETUP_BUILDER_INCOMES.forEach(item=>{
  const name=item.id==="salary-b"
   ?`Salaire ${household.personB}`
   :item.id==="salary-a"
    ?`Salaire ${household.personA}`
    :item.name;
  income[item.id]={
   selected:item.owner==="A"&&mode==="solo"?false:item.selected,
   amount:"",
   owner:mode==="solo"?"B":item.owner,
   name,
   renamed:false,
   removable:item.kind!=="salary",
   hidden:false
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
   selected:item.owner==="A"&&mode==="solo"?false:item.selected,
   amount:"",
   owner:mode==="solo"?"B":item.owner,
   name,
   section:item.section,
   renamed:false
  };
 });

 const subscriptions={};
 SETUP_SUBSCRIPTIONS.forEach(item=>{
  const plan=item.plans[0];
  subscriptions[item.id]={
   selected:false,
   plan:0,
   amount:plan.price==null?"":String(plan.price),
   owner:mode==="solo"?"B":item.owner,
   name:item.name
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

function setupBuilderSafe(label,fn){
 try{return fn()}
 catch(error){
  console.error("[Setup builder]",label,error);
  setupBuilderSetStatus("Une erreur a été interceptée dans le builder. Recharge la page si elle persiste.","error");
  return undefined;
 }
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
    <div class="setup-builder-brand">
     ${typeof themeLogoMarkup==="function"?themeLogoMarkup("theme-logo setup-builder-logo"):""}
     <div><span>Budget foyer · V2.6</span><h2 id="setupBuilderTitle">Construire mon budget</h2></div>
    </div>
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

 // Un seul contrôleur est attaché au root persistant.
 // setupBuilderContent peut ensuite être remplacé sans perdre aucun listener.
 root.addEventListener("click",setupBuilderControllerClick);
 root.addEventListener("change",setupBuilderControllerChange);
 root.addEventListener("input",setupBuilderControllerInput);
 root.addEventListener("keydown",setupBuilderControllerKeydown);
 root.addEventListener("pointerdown",setupBuilderControllerPointerDown);
 root.addEventListener("pointermove",setupBuilderControllerPointerMove);
 root.addEventListener("pointerup",setupBuilderControllerPointerUp);
 root.addEventListener("pointercancel",setupBuilderControllerPointerCancel);

 return root;
}

function openSetupBuilder(){
 if(!activeHouseholdId)return;
 setupBuilderOriginalAppearance=typeof currentUserAppearance==="function"?currentUserAppearance():null;
 setupBuilderDraft=setupBuilderInitialDraft();
 setupBuilderStep=0;
 setupBuilderEditingName="";
 setupBuilderPointerTarget=null;

 const root=ensureSetupBuilder();
 root.dataset.builderStep="";
 root.classList.add("open");
 root.setAttribute("aria-hidden","false");
 document.documentElement.classList.add("setup-builder-open");
 setupBuilderRender();
}
function closeSetupBuilder(){
 setupBuilderPointerTarget=null;
 const root=document.getElementById("setupBuilderBackdrop");
 if(root){
  root.classList.remove("open");
  root.setAttribute("aria-hidden","true");
 }
 document.documentElement.classList.remove("setup-builder-open");
}
function skipSetupBuilder(){
 if(setupBuilderOriginalAppearance&&typeof applyUserAppearance==="function"){
  applyUserAppearance(setupBuilderOriginalAppearance);
 }
 markSetupBuilderComplete();
 closeSetupBuilder();
 showUndoToast?.("Configuration de départ ignorée");
}
function setupBuilderSetStatus(message="",type=""){
 const node=document.getElementById("setupBuilderStatus");
 if(!node)return;
 node.textContent=message;
 node.className=("setup-builder-status "+type).trim();
}

function setupBuilderControllerClick(event){
 setupBuilderSafe("click",()=>{
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;

  if(target.closest("#setupBuilderBack")){
   event.preventDefault();
   setupBuilderGo(-1);
   return;
  }
  if(target.closest("#setupBuilderSkip")){
   event.preventDefault();
   skipSetupBuilder();
   return;
  }
  if(target.closest("#setupBuilderNext")){
   event.preventDefault();
   setupBuilderGo(1);
   return;
  }

  const mode=target.closest("[data-builder-mode]");
  if(mode){
   event.preventDefault();
   setupBuilderSetMode(mode.dataset.builderMode);
   return;
  }

  const customToggle=target.closest("[data-appearance-custom-toggle]");
  if(customToggle&&setupBuilderDraft?.appearance){
   event.preventDefault();
   setupBuilderDraft.appearance={
    ...normalizeUserAppearance(setupBuilderDraft.appearance),
    color:"custom"
   };
   applyUserAppearance(setupBuilderDraft.appearance);
   const picker=customToggle.closest("[data-appearance-picker]");
   setAppearanceCustomPanelOpen?.(picker,true);
   syncAppearancePickerUi?.(picker,setupBuilderDraft.appearance,{customOpen:true});
   return;
  }

  const colorButton=target.closest("[data-appearance-color]");
  if(colorButton&&setupBuilderDraft?.appearance){
   event.preventDefault();
   setupBuilderDraft.appearance=appearanceFromPickerEvent(colorButton,setupBuilderDraft.appearance);
   applyUserAppearance(setupBuilderDraft.appearance);
   const picker=colorButton.closest("[data-appearance-picker]");
   syncAppearancePickerUi?.(picker,setupBuilderDraft.appearance,{customOpen:false});
   return;
  }

  const fontButton=target.closest("[data-appearance-font]");
  if(fontButton&&setupBuilderDraft?.appearance){
   event.preventDefault();
   setupBuilderDraft.appearance=appearanceFromPickerEvent(fontButton,setupBuilderDraft.appearance);
   applyUserAppearance(setupBuilderDraft.appearance);
   const picker=fontButton.closest("[data-appearance-picker]");
   syncAppearancePickerUi?.(picker,setupBuilderDraft.appearance,{
    customOpen:setupBuilderDraft.appearance.color==="custom"
   });
   return;
  }

  const rename=target.closest("[data-builder-rename]");
  if(rename){
   event.preventDefault();
   const key=rename.dataset.builderRename;
   setupBuilderEditingName=setupBuilderEditingName===key?"":key;
   setupBuilderRender();
   return;
  }

  const remove=target.closest("[data-builder-delete]");
  if(remove){
   event.preventDefault();
   setupBuilderDelete(remove.dataset.builderDelete);
   return;
  }

  const add=target.closest("[data-builder-add]");
  if(add){
   event.preventDefault();
   setupBuilderAddCustom(add.dataset.builderAdd);
  }
 });
}

function setupBuilderControllerChange(event){
 setupBuilderSafe("change",()=>{
  const target=event.target;
  if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;

  if(target.matches("[data-builder-select]")){
   const data=setupBuilderDataForKey(target.dataset.builderSelect);
   if(!data)return;
   data.selected=target.checked;
   setupBuilderRender();
   return;
  }

  if(target.matches("[data-builder-owner]")){
   const data=setupBuilderDataForKey(target.dataset.builderOwner);
   if(data)data.owner=target.value;
   return;
  }

  if(target.matches("[data-builder-section]")){
   const data=setupBuilderDataForKey(target.dataset.builderSection);
   if(data)data.section=target.value;
   return;
  }

  if(target.matches("[data-builder-plan]")){
   const id=target.dataset.builderPlan;
   const data=setupBuilderDraft?.subscriptions?.[id];
   const item=SETUP_SUBSCRIPTIONS.find(entry=>entry.id===id);
   if(!data||!item)return;
   const index=Math.max(0,Number(target.value)||0);
   data.plan=index;
   const price=item.plans[index]?.price;
   data.amount=price==null?"":String(price);
   const row=target.closest("[data-builder-row]");
   const amountInput=row?.querySelector("[data-builder-sub-amount]");
   if(amountInput)amountInput.value=data.amount;
   return;
  }

  if(target.matches("[data-builder-sub-owner]")){
   const data=setupBuilderDataForKey(target.dataset.builderSubOwner);
   if(data)data.owner=target.value;
   return;
  }

  if(target.matches("[data-appearance-hex]")){
   const hex=validAppearanceHex(target.value);
   if(!hex){
    target.value=normalizeUserAppearance(setupBuilderDraft.appearance).customColor;
    target.classList.remove("invalid");
    return;
   }
   setupBuilderDraft.appearance={
    ...normalizeUserAppearance(setupBuilderDraft.appearance),
    color:"custom",
    customColor:hex
   };
   applyUserAppearance(setupBuilderDraft.appearance);
   const picker=target.closest("[data-appearance-picker]");
   syncAppearancePickerUi?.(picker,setupBuilderDraft.appearance,{customOpen:true});
  }
 });
}

function setupBuilderControllerInput(event){
 setupBuilderSafe("input",()=>{
  const target=event.target;
  if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;

  if(target.matches("[data-builder-household]")){
   const field=target.dataset.builderHousehold;
   setupBuilderDraft.household[field]=target.value;
   setupBuilderSyncDynamicNames(field,target.value);
   return;
  }

  if(target.matches("[data-builder-name-input]")){
   const data=setupBuilderDataForKey(target.dataset.builderNameInput);
   if(data){
    data.name=target.value;
    data.renamed=true;
   }
   return;
  }

  if(target.matches("[data-builder-amount]")){
   const data=setupBuilderDataForKey(target.dataset.builderAmount);
   if(data)data.amount=target.value;
   return;
  }

  if(target.matches("[data-builder-sub-amount]")){
   const data=setupBuilderDataForKey(target.dataset.builderSubAmount);
   if(data)data.amount=target.value;
   return;
  }

  if(target.matches("[data-appearance-hex]")){
   const hex=validAppearanceHex(target.value);
   target.classList.toggle("invalid",!hex);
   if(!hex)return;
   setupBuilderDraft.appearance={
    ...normalizeUserAppearance(setupBuilderDraft.appearance),
    color:"custom",
    customColor:hex
   };
   applyUserAppearance(setupBuilderDraft.appearance);
   const picker=target.closest("[data-appearance-picker]");
   syncAppearanceCustomPanel?.(picker,setupBuilderDraft.appearance,{syncHex:false});
  }
 });
}

function setupBuilderControllerKeydown(event){
 const target=event.target;
 if(!(target instanceof Element))return;
 if(event.key==="Enter"&&target.matches("[data-builder-name-input]")){
  event.preventDefault();
  setupBuilderEditingName="";
  setupBuilderRender();
 }
}

function setupBuilderControllerPointerDown(event){
 setupBuilderSafe("pointerdown",()=>{
  const target=event.target instanceof Element
   ?event.target.closest("[data-appearance-sv],[data-appearance-hue]")
   :null;
  if(!target)return;
  setupBuilderPointerTarget=target;
  target.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  setupBuilderUpdateCustomPointer(target,event);
 });
}
function setupBuilderControllerPointerMove(event){
 if(!setupBuilderPointerTarget)return;
 event.preventDefault();
 setupBuilderSafe("pointermove",()=>setupBuilderUpdateCustomPointer(setupBuilderPointerTarget,event));
}
function setupBuilderControllerPointerUp(event){
 if(!setupBuilderPointerTarget)return;
 event.preventDefault();
 setupBuilderSafe("pointerup",()=>setupBuilderUpdateCustomPointer(setupBuilderPointerTarget,event));
 setupBuilderPointerTarget=null;
}
function setupBuilderControllerPointerCancel(){
 setupBuilderPointerTarget=null;
}
function setupBuilderUpdateCustomPointer(target,event){
 if(!setupBuilderDraft?.appearance||typeof appearanceCustomFromPointer!=="function")return;
 setupBuilderDraft.appearance=appearanceCustomFromPointer(
  target,
  event,
  setupBuilderDraft.appearance
 );
 applyUserAppearance(setupBuilderDraft.appearance);
 const picker=target.closest("[data-appearance-picker]");
 syncAppearancePickerUi?.(picker,setupBuilderDraft.appearance,{customOpen:true});
}

function setupBuilderSyncDynamicNames(field,value){
 const name=String(value||"").trim()||(field==="personA"?"Personne 2":"Personne 1");
 if(field==="personB"){
  if(!setupBuilderDraft.income["salary-b"].renamed)setupBuilderDraft.income["salary-b"].name=`Salaire ${name}`;
  if(!setupBuilderDraft.expense["phone-b"].renamed)setupBuilderDraft.expense["phone-b"].name=`Téléphone ${name}`;
  if(!setupBuilderDraft.expense["saving-b"].renamed)setupBuilderDraft.expense["saving-b"].name=`Épargne ${name}`;
 }
 if(field==="personA"){
  if(!setupBuilderDraft.income["salary-a"].renamed)setupBuilderDraft.income["salary-a"].name=`Salaire ${name}`;
  if(!setupBuilderDraft.expense["phone-a"].renamed)setupBuilderDraft.expense["phone-a"].name=`Téléphone ${name}`;
  if(!setupBuilderDraft.expense["saving-a"].renamed)setupBuilderDraft.expense["saving-a"].name=`Épargne ${name}`;
 }
}

function setupBuilderSetMode(mode){
 if(!setupBuilderDraft?.household)return;
 const next=mode==="solo"?"solo":"couple";
 const previous=setupBuilderMode();
 setupBuilderDraft.household.mode=next;

 if(previous!==next){
  const switchOwner=data=>{
   if(next==="solo"){
    data._ownerBeforeSolo=data.owner;
    data.owner="B";
   }else if(data._ownerBeforeSolo){
    data.owner=data._ownerBeforeSolo;
    delete data._ownerBeforeSolo;
   }
  };
  Object.values(setupBuilderDraft.income).forEach(switchOwner);
  Object.values(setupBuilderDraft.expense).forEach(switchOwner);
  Object.values(setupBuilderDraft.subscriptions).forEach(switchOwner);
  setupBuilderDraft.customIncome.forEach(switchOwner);
  setupBuilderDraft.customExpense.forEach(switchOwner);
  setupBuilderDraft.customSubscriptions.forEach(switchOwner);

  const personAIds=[
   ["income","salary-a"],
   ["expense","phone-a"],
   ["expense","saving-a"]
  ];
  personAIds.forEach(([store,id])=>{
   const data=setupBuilderDraft[store][id];
   if(!data)return;
   if(next==="solo"){
    data._selectedBeforeSolo=data.selected;
    data.selected=false;
   }else if("_selectedBeforeSolo" in data){
    data.selected=!!data._selectedBeforeSolo;
    delete data._selectedBeforeSolo;
   }
  });
 }

 setupBuilderRender();
}

function setupBuilderProgress(){
 const labels=["Foyer","Revenus","Dépenses","Abonnements","Résumé"];
 return labels.map((label,index)=>
  `<span class="${index===setupBuilderStep?"active":index<setupBuilderStep?"done":""}">
    <b>${index+1}</b><em>${label}</em>
   </span>`
 ).join("");
}

function setupBuilderDisplayName(item,data){
 return data.name||item?.name||"Catégorie";
}
function setupBuilderNameMarkup(key,name){
 if(setupBuilderEditingName===key){
  return `<input class="setup-builder-inline-name" type="text" maxlength="60"
   data-builder-name-input="${escapeHtml(key)}" value="${escapeHtml(name)}" autofocus>`;
 }
 return `<strong>${escapeHtml(name)}</strong>`;
}
function setupBuilderDomId(key){
 return "setup-builder-"+String(key).replace(/[^a-z0-9_-]+/gi,"-");
}
function setupBuilderRowActions(key,data){
 const canDelete=!!data.custom||!!data.removable;
 return `<div class="setup-builder-row-actions">
   <button class="setup-builder-rename" type="button" data-builder-rename="${escapeHtml(key)}">
    ${setupBuilderEditingName===key?"OK":"Renommer"}
   </button>
   ${canDelete?`<button class="setup-builder-delete" type="button"
    data-builder-delete="${escapeHtml(key)}" aria-label="Supprimer cette catégorie">Supprimer</button>`:""}
  </div>`;
}

function setupBuilderItemRow(item,data,type,keyOverride=""){
 const key=keyOverride||`${type}:${item.id}`;
 const checked=data.selected?"checked":"";
 const disabled=data.selected?"":"disabled";
 const name=setupBuilderDisplayName(item,data);
 const checkId=setupBuilderDomId(key);
 const ownerLabel=type==="income"?"Attribué à":"Payé par";

 return `<div class="setup-builder-item ${data.selected?"selected":""}" data-builder-row="${escapeHtml(key)}">
   <div class="setup-builder-item-head">
    <div class="setup-builder-check">
     <input id="${checkId}" type="checkbox" data-builder-select="${escapeHtml(key)}" ${checked}>
     <div class="setup-builder-name-wrap">
      ${setupBuilderEditingName===key
       ?setupBuilderNameMarkup(key,name)
       :`<label for="${checkId}">${setupBuilderNameMarkup(key,name)}
          <small>${item.saving?"Objectif mensuel":"Budget mensuel prévu"}</small></label>`}
     </div>
    </div>
    ${setupBuilderRowActions(key,data)}
   </div>
   <div class="setup-builder-item-fields">
    <label><span>Montant</span>
     <div class="setup-builder-money">
      <input type="number" min="0" step="0.01" inputmode="decimal"
       data-builder-amount="${escapeHtml(key)}" value="${escapeHtml(data.amount)}" ${disabled}>
      <b>€</b>
     </div>
    </label>
    ${setupBuilderIsSolo()?"":`<label><span>${ownerLabel}</span>
     <select data-builder-owner="${escapeHtml(key)}" ${disabled}>
      ${setupBuilderOwnerOptions(data.owner)}
     </select>
    </label>`}
    ${type==="expense"&&data.custom?`<label><span>Groupe</span>
     <select data-builder-section="${escapeHtml(key)}" ${disabled}>
      <option ${data.section==="Obligatoires"?"selected":""}>Obligatoires</option>
      <option ${data.section==="Abonnements"?"selected":""}>Abonnements</option>
      <option ${data.section==="Vie courante"?"selected":""}>Vie courante</option>
     </select>
    </label>`:""}
   </div>
  </div>`;
}

function setupBuilderSubscriptionRow(item,data,keyOverride=""){
 const key=keyOverride||`subscription:${item.id}`;
 const selectedPlan=item.plans?.[data.plan]||item.plans?.[0];
 const name=data.name||item.name;
 const checkId=setupBuilderDomId(key);
 const custom=!!data.custom;

 return `<div class="setup-builder-item setup-builder-sub ${data.selected?"selected":""}"
  data-builder-row="${escapeHtml(key)}">
   <div class="setup-builder-item-head">
    <div class="setup-builder-check">
     <input id="${checkId}" type="checkbox" data-builder-select="${escapeHtml(key)}"
      ${data.selected?"checked":""}>
     <div class="setup-builder-name-wrap">
      ${setupBuilderEditingName===key
       ?setupBuilderNameMarkup(key,name)
       :`<label for="${checkId}">${setupBuilderNameMarkup(key,name)}
          <small>${custom?"Abonnement personnalisé":`Tarif vérifié le ${SETUP_BUILDER_UPDATED.split("-").reverse().join("/")}`}</small>
         </label>`}
     </div>
    </div>
    ${setupBuilderRowActions(key,data)}
   </div>
   <div class="setup-builder-item-fields">
    ${custom?"":`<label><span>Formule</span>
     <select data-builder-plan="${item.id}" ${data.selected?"":"disabled"}>
      ${item.plans.map((plan,index)=>
       `<option value="${index}" ${index===data.plan?"selected":""}>${escapeHtml(plan.name)}</option>`
      ).join("")}
     </select>
    </label>`}
    <label><span>Montant</span>
     <div class="setup-builder-money">
      <input type="number" min="0" step="0.01" inputmode="decimal"
       data-builder-sub-amount="${escapeHtml(key)}" value="${escapeHtml(data.amount)}"
       placeholder="${selectedPlan?.price==null&&!custom?"À saisir":""}" ${data.selected?"":"disabled"}>
      <b>€</b>
     </div>
    </label>
    ${setupBuilderIsSolo()?"":`<label><span>Payé par</span>
     <select data-builder-sub-owner="${escapeHtml(key)}" ${data.selected?"":"disabled"}>
      ${setupBuilderOwnerOptions(data.owner)}
     </select>
    </label>`}
   </div>
   ${!custom&&item.sourceUrl?`<a class="setup-builder-source" href="${item.sourceUrl}"
    target="_blank" rel="noopener">Source : ${escapeHtml(item.source)}</a>`:""}
  </div>`;
}

function setupBuilderAddCard(type,label){
 return `<button class="setup-builder-add" type="button" data-builder-add="${type}">
  <span>＋</span><strong>${escapeHtml(label)}</strong>
  <small>Créer rapidement une catégorie supplémentaire</small>
 </button>`;
}

function setupBuilderVisibleIncomes(){
 return SETUP_BUILDER_INCOMES.filter(item=>
  !setupBuilderDraft.income[item.id]?.hidden&&
  (!setupBuilderIsSolo()||item.owner!=="A")
 );
}
function setupBuilderVisibleExpenses(){
 return SETUP_BUILDER_EXPENSES.filter(item=>!setupBuilderIsSolo()||item.owner!=="A");
}
function setupBuilderAppearanceMarkup(){
 if(typeof appearancePickerMarkup!=="function")return "";
 try{return appearancePickerMarkup("builder",setupBuilderDraft.appearance)}
 catch(error){
  console.error("[Setup builder] appearance markup",error);
  return '<p class="setup-builder-note">Le sélecteur d’apparence n’a pas pu être chargé.</p>';
 }
}

function setupBuilderRender(){
 if(!setupBuilderDraft)return;

 setupBuilderSafe("render",()=>{
  const root=ensureSetupBuilder();
  const content=root.querySelector("#setupBuilderContent");
  const progress=root.querySelector("#setupBuilderProgress");
  const back=root.querySelector("#setupBuilderBack");
  const next=root.querySelector("#setupBuilderNext");

  if(!content||!progress||!back||!next)throw new Error("Structure du builder incomplète");

  const sameStep=root.dataset.builderStep===String(setupBuilderStep);
  const previousScroll=sameStep?root.scrollTop:0;

  progress.innerHTML=setupBuilderProgress();
  back.hidden=setupBuilderStep===0;
  next.textContent=setupBuilderStep===4?"Créer mon budget":"Continuer";
  setupBuilderSetStatus("");

  if(setupBuilderStep===0){
   const solo=setupBuilderIsSolo();
   content.innerHTML=`
    <div class="setup-builder-title">
     <span>Étape 1 sur 5</span>
     <h3>Votre foyer</h3>
     <p>Choisissez si vous gérez votre budget seul ou à deux. Ce choix reste modifiable dans Paramètres.</p>
    </div>
    <div class="setup-builder-mode" role="group" aria-label="Type de foyer">
     <button type="button" data-builder-mode="solo" class="${solo?"active":""}">
      <b>Seul</b><span>Un seul budget personnel</span>
     </button>
     <button type="button" data-builder-mode="couple" class="${!solo?"active":""}">
      <b>À deux</b><span>Répartition entre deux personnes</span>
     </button>
    </div>
    <div class="setup-builder-card setup-builder-household">
     <label><span>Nom du foyer</span>
      <input type="text" maxlength="80" data-builder-household="name"
       value="${escapeHtml(setupBuilderDraft.household.name)}">
     </label>
     <label><span>${solo?"Votre nom":"Personne 1"}</span>
      <input type="text" maxlength="40" data-builder-household="personB"
       value="${escapeHtml(setupBuilderDraft.household.personB)}">
     </label>
     ${solo?"":`<label><span>Personne 2</span>
      <input type="text" maxlength="40" data-builder-household="personA"
       value="${escapeHtml(setupBuilderDraft.household.personA)}">
     </label>`}
    </div>
    <div class="setup-builder-appearance-card">
     <div class="setup-builder-appearance-copy">
      <span>APPARENCE</span><strong>Personnaliser votre interface</strong>
      <p>Choisissez une couleur principale et une police. Ce réglage est personnel à votre compte.</p>
     </div>
     ${setupBuilderAppearanceMarkup()}
    </div>`;
  }else if(setupBuilderStep===1){
   content.innerHTML=`
    <div class="setup-builder-title">
     <span>Étape 2 sur 5</span><h3>Revenus prévus</h3>
     <p>Les salaires restent disponibles mais peuvent être décochés. Les autres revenus peuvent être supprimés.</p>
    </div>
    <div class="setup-builder-list">
     ${setupBuilderVisibleIncomes().map(item=>
      setupBuilderItemRow(item,setupBuilderDraft.income[item.id],"income")
     ).join("")}
     ${setupBuilderDraft.customIncome.map(data=>
      setupBuilderItemRow({id:data.id,name:data.name},data,"income",`customIncome:${data.id}`)
     ).join("")}
     ${setupBuilderAddCard("income","Ajouter une catégorie de revenu")}
    </div>`;
  }else if(setupBuilderStep===2){
   content.innerHTML=`
    <div class="setup-builder-title">
     <span>Étape 3 sur 5</span><h3>Dépenses de base</h3>
     <p>Cochez uniquement les charges que vous prévoyez chaque mois. Rien n’est créé comme dépense réelle.</p>
    </div>
    <div class="setup-builder-list">
     ${setupBuilderVisibleExpenses().map(item=>
      setupBuilderItemRow(item,setupBuilderDraft.expense[item.id],"expense")
     ).join("")}
     ${setupBuilderDraft.customExpense.map(data=>
      setupBuilderItemRow({id:data.id,name:data.name},data,"expense",`customExpense:${data.id}`)
     ).join("")}
     ${setupBuilderAddCard("expense","Ajouter une dépense personnalisée")}
    </div>`;
  }else if(setupBuilderStep===3){
   content.innerHTML=`
    <div class="setup-builder-title">
     <span>Étape 4 sur 5</span><h3>Abonnements</h3>
     <p>Sélectionnez vos services et adaptez le tarif si nécessaire.</p>
    </div>
    <div class="setup-builder-list setup-builder-subscriptions">
     ${SETUP_SUBSCRIPTIONS.map(item=>
      setupBuilderSubscriptionRow(item,setupBuilderDraft.subscriptions[item.id])
     ).join("")}
     ${setupBuilderDraft.customSubscriptions.map(data=>
      setupBuilderSubscriptionRow(
       {id:data.id,name:data.name,plans:[]},
       data,
       `customSubscription:${data.id}`
      )
     ).join("")}
     ${setupBuilderAddCard("subscription","Ajouter un abonnement")}
    </div>
    <p class="setup-builder-note">Les tarifs proposés restent modifiables.</p>`;
  }else{
   const totals=setupBuilderTotals();
   content.innerHTML=`
    <div class="setup-builder-title">
     <span>Étape 5 sur 5</span><h3>Votre budget de départ</h3>
     <p>Dernière vérification avant de créer les catégories et montants prévus.</p>
    </div>
    <div class="setup-builder-summary">
     <div><span>Revenus prévus</span><strong>${euro(totals.income)}</strong></div>
     <div><span>Dépenses prévues</span><strong>${euro(totals.expense)}</strong></div>
     <div class="setup-builder-summary-rest">
      <span>Reste prévu</span><strong>${euro(totals.income-totals.expense)}</strong>
     </div>
    </div>
    <div class="setup-builder-recap">
     <strong>${totals.count} catégorie${totals.count>1?"s":""} configurée${totals.count>1?"s":""}</strong>
     <span>Mode ${setupBuilderIsSolo()?"seul":"à deux"} · historique réel vide · tout reste modifiable ensuite.</span>
    </div>`;
  }

  root.dataset.builderStep=String(setupBuilderStep);

  if(sameStep)requestAnimationFrame(()=>{root.scrollTop=previousScroll});
  requestAnimationFrame(()=>{
   const field=root.querySelector("[data-builder-name-input]");
   if(field){
    field.focus({preventScroll:true});
    field.select?.();
   }
  });
 });
}

function setupBuilderCollection(type){
 if(type==="income")return setupBuilderDraft.income;
 if(type==="expense")return setupBuilderDraft.expense;
 if(type==="subscription")return setupBuilderDraft.subscriptions;
 return null;
}
function setupBuilderCustomArray(type){
 if(type==="customIncome")return setupBuilderDraft.customIncome;
 if(type==="customExpense")return setupBuilderDraft.customExpense;
 if(type==="customSubscription")return setupBuilderDraft.customSubscriptions;
 return null;
}
function setupBuilderDataForKey(key){
 const [type,id]=String(key||"").split(":");
 const custom=setupBuilderCustomArray(type);
 if(custom)return custom.find(item=>item.id===id)||null;
 return setupBuilderCollection(type)?.[id]||null;
}

function setupBuilderAddCustom(type){
 const id="setup-"+type+"-"+uid();
 const owner=setupBuilderIsSolo()?"B":"common";

 if(type==="income"){
  setupBuilderDraft.customIncome.push({
   id,name:"Nouveau revenu",selected:true,amount:"",owner,custom:true,removable:true
  });
  setupBuilderEditingName="customIncome:"+id;
 }else if(type==="expense"){
  setupBuilderDraft.customExpense.push({
   id,name:"Nouvelle dépense",selected:true,amount:"",owner,section:"Obligatoires",custom:true,removable:true
  });
  setupBuilderEditingName="customExpense:"+id;
 }else if(type==="subscription"){
  setupBuilderDraft.customSubscriptions.push({
   id,name:"Nouvel abonnement",selected:true,amount:"",owner,custom:true,removable:true
  });
  setupBuilderEditingName="customSubscription:"+id;
 }
 setupBuilderRender();
}

function setupBuilderDelete(key){
 const [type,id]=String(key||"").split(":");
 const list=setupBuilderCustomArray(type);

 if(list){
  const index=list.findIndex(item=>item.id===id);
  if(index>=0)list.splice(index,1);
 }else{
  const data=setupBuilderCollection(type)?.[id];
  if(!data?.removable)return;
  data.selected=false;
  data.hidden=true;
 }

 if(setupBuilderEditingName===key)setupBuilderEditingName="";
 setupBuilderRender();
}

function setupBuilderTotals(){
 let income=0,expense=0,count=0;

 for(const item of setupBuilderVisibleIncomes()){
  const data=setupBuilderDraft.income[item.id];
  if(data.selected){income+=setupBuilderNumber(data.amount);count++}
 }
 for(const data of setupBuilderDraft.customIncome){
  if(data.selected){income+=setupBuilderNumber(data.amount);count++}
 }
 for(const item of setupBuilderVisibleExpenses()){
  const data=setupBuilderDraft.expense[item.id];
  if(data.selected){expense+=setupBuilderNumber(data.amount);count++}
 }
 for(const data of setupBuilderDraft.customExpense){
  if(data.selected){expense+=setupBuilderNumber(data.amount);count++}
 }
 for(const item of SETUP_SUBSCRIPTIONS){
  const data=setupBuilderDraft.subscriptions[item.id];
  if(data.selected){expense+=setupBuilderNumber(data.amount);count++}
 }
 for(const data of setupBuilderDraft.customSubscriptions){
  if(data.selected){expense+=setupBuilderNumber(data.amount);count++}
 }

 return {income,expense,count};
}

function setupBuilderGo(delta){
 if(delta<0){
  setupBuilderStep=Math.max(0,setupBuilderStep-1);
  setupBuilderEditingName="";
  setupBuilderRender();
  return;
 }
 if(setupBuilderStep<4){
  setupBuilderStep++;
  setupBuilderEditingName="";
  setupBuilderRender();
  return;
 }
 finishSetupBuilder();
}

function setupBuilderSetBaseBudget(type,id,amount,owner){
 const budgetMap=type==="income"?state.incomeBudgets:state.categoryBudgets;
 const ownerMap=type==="income"?state.incomeCategoryOwners:state.categoryOwners;
 budgetMap[id]=amount;
 ownerMap[id]=setupBuilderDefaultOwner(owner);
}

function setupBuilderPersonalizeCategoryNames(){
 const b=state.household.personB||"Personne 1";
 const a=state.household.personA||"Personne 2";
 state.incomeCategoryNames={
  ...(state.incomeCategoryNames||{}),
  "salary-b":setupBuilderDraft.income["salary-b"].name||`Salaire ${b}`,
  "salary-a":setupBuilderDraft.income["salary-a"].name||`Salaire ${a}`,
  "benefits":setupBuilderDraft.income.benefits.name||"Aides / allocations"
 };
 state.categoryNames={
  ...(state.categoryNames||{}),
  "rent":setupBuilderDraft.expense.rent.name,
  "electricity":setupBuilderDraft.expense.electricity.name,
  "groceries":setupBuilderDraft.expense.groceries.name,
  "internet":setupBuilderDraft.expense.internet.name,
  "home-insurance":setupBuilderDraft.expense["home-insurance"].name,
  "car-insurance":setupBuilderDraft.expense["car-insurance"].name,
  "phone-b":setupBuilderDraft.expense["phone-b"].name||`Téléphone ${b}`,
  "phone-a":setupBuilderDraft.expense["phone-a"].name||`Téléphone ${a}`,
  "fuel":setupBuilderDraft.expense.fuel.name,
  "saving-b":setupBuilderDraft.expense["saving-b"].name||`Épargne ${b}`,
  "saving-a":setupBuilderDraft.expense["saving-a"].name||`Épargne ${a}`
 };
}

function setupBuilderApplyCustomCategories(){
 const incomePrefix="setup-income-";
 const expensePrefixes=["setup-expense-","setup-subscription-","setup-sub-"];

 state.customIncomeCategories=(state.customIncomeCategories||[])
  .filter(item=>!String(item.id).startsWith(incomePrefix));
 state.customExpenseCategories=(state.customExpenseCategories||[])
  .filter(item=>!expensePrefixes.some(prefix=>String(item.id).startsWith(prefix)));

 for(const data of setupBuilderDraft.customIncome){
  if(!data.selected)continue;
  state.customIncomeCategories.push({
   id:data.id,
   name:String(data.name||"Revenu").trim()||"Revenu",
   budget:setupBuilderNumber(data.amount),
   owner:setupBuilderDefaultOwner(data.owner),
   createdFrom:state.createdMonth,
   custom:true
  });
  state.incomeBudgets[data.id]=setupBuilderNumber(data.amount);
  state.incomeCategoryOwners[data.id]=setupBuilderDefaultOwner(data.owner);
 }

 for(const data of setupBuilderDraft.customExpense){
  if(!data.selected)continue;
  state.customExpenseCategories.push({
   id:data.id,
   name:String(data.name||"Dépense").trim()||"Dépense",
   budget:setupBuilderNumber(data.amount),
   section:data.section||"Obligatoires",
   owner:setupBuilderDefaultOwner(data.owner),
   createdFrom:state.createdMonth,
   custom:true
  });
  state.categoryBudgets[data.id]=setupBuilderNumber(data.amount);
  state.categoryOwners[data.id]=setupBuilderDefaultOwner(data.owner);
 }

 for(const item of SETUP_SUBSCRIPTIONS){
  const data=setupBuilderDraft.subscriptions[item.id];
  if(!data.selected)continue;
  const id="setup-sub-"+item.id;
  const plan=item.plans[data.plan]||item.plans[0];
  state.customExpenseCategories.push({
   id,
   name:String(data.name||item.name).trim()||item.name,
   budget:setupBuilderNumber(data.amount),
   section:"Abonnements",
   owner:setupBuilderDefaultOwner(data.owner),
   createdFrom:state.createdMonth,
   custom:true,
   setupPlan:plan?.name||""
  });
  state.categoryBudgets[id]=setupBuilderNumber(data.amount);
  state.categoryOwners[id]=setupBuilderDefaultOwner(data.owner);
 }

 for(const data of setupBuilderDraft.customSubscriptions){
  if(!data.selected)continue;
  state.customExpenseCategories.push({
   id:data.id,
   name:String(data.name||"Abonnement").trim()||"Abonnement",
   budget:setupBuilderNumber(data.amount),
   section:"Abonnements",
   owner:setupBuilderDefaultOwner(data.owner),
   createdFrom:state.createdMonth,
   custom:true
  });
  state.categoryBudgets[data.id]=setupBuilderNumber(data.amount);
  state.categoryOwners[data.id]=setupBuilderDefaultOwner(data.owner);
 }
}

async function finishSetupBuilder(){
 if(!setupBuilderDraft||!activeHouseholdId)return;

 const next=document.getElementById("setupBuilderNext");
 if(next)next.disabled=true;
 setupBuilderSetStatus("Création de votre budget…");

 try{
  state.household=normalizeHousehold({
   name:String(setupBuilderDraft.household.name||"Mon foyer").trim()||"Mon foyer",
   personB:String(setupBuilderDraft.household.personB||"Personne 1").trim()||"Personne 1",
   personA:String(setupBuilderDraft.household.personA||"Personne 2").trim()||"Personne 2",
   mode:setupBuilderMode()
  });

  for(const item of SETUP_BUILDER_INCOMES){
   const data=setupBuilderDraft.income[item.id];
   setupBuilderSetBaseBudget(
    "income",
    item.id,
    data.selected?setupBuilderNumber(data.amount):0,
    data.owner
   );
  }
  for(const item of SETUP_BUILDER_EXPENSES){
   const data=setupBuilderDraft.expense[item.id];
   setupBuilderSetBaseBudget(
    "expense",
    item.id,
    data.selected?setupBuilderNumber(data.amount):0,
    data.owner
   );
  }

  setupBuilderApplyCustomCategories();
  setupBuilderPersonalizeCategoryNames();

  const selectedIncome=new Set(
   SETUP_BUILDER_INCOMES
    .filter(item=>{
     const data=setupBuilderDraft.income[item.id];
     return !data.hidden&&data.selected&&(!setupBuilderIsSolo()||item.owner!=="A");
    })
    .map(item=>item.id)
  );
  const selectedExpense=new Set(
   SETUP_BUILDER_EXPENSES
    .filter(item=>{
     const data=setupBuilderDraft.expense[item.id];
     return data.selected&&(!setupBuilderIsSolo()||item.owner!=="A");
    })
    .map(item=>item.id)
  );

  state.deletedIncomeCategoriesGlobal=[
   ...new Set((state.baseIncomeCategories||[]).map(item=>item.id).filter(id=>!selectedIncome.has(id)))
  ];
  state.deletedCategoriesGlobal=[
   ...new Set((state.baseExpenseCategories||[]).map(item=>item.id).filter(id=>!selectedExpense.has(id)))
  ];

  state.onboardingComplete=true;
  applyCategoryState();
  syncHouseholdUi();
  render();
  saveState();

  if(setupBuilderDraft.appearance&&typeof saveUserAppearance==="function"){
   await saveUserAppearance(setupBuilderDraft.appearance);
  }

  await cloudPushLocalState({force:true});
  markSetupBuilderComplete();
  setupBuilderOriginalAppearance=null;
  setupBuilderSetStatus("Budget créé.","success");

  setTimeout(()=>{
   closeSetupBuilder();
   showUndoToast?.("Budget de départ créé");
  },300);
 }catch(error){
  console.error("[Setup builder] finish",error);
  setupBuilderSetStatus(error?.message||"Impossible de créer le budget. Réessaie.","error");
 }finally{
  if(next)next.disabled=false;
 }
}
