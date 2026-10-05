// V2.5 — paramètres, import/export V5 et synchronisation cloud
const settingsBackdrop=document.getElementById("settingsBackdrop");
const settingsHouseholdName=document.getElementById("settingsHouseholdName");
const settingsPersonB=document.getElementById("settingsPersonB");
const settingsPersonA=document.getElementById("settingsPersonA");
const settingsPersonAField=document.getElementById("settingsPersonAField");
const settingsPersonBLabel=document.getElementById("settingsPersonBLabel");
const settingsModeButtons=[...document.querySelectorAll("[data-household-mode]")];
let settingsHouseholdMode="couple";
const settingsAppearancePicker=document.getElementById("settingsAppearancePicker");
const saveAppearanceBtn=document.getElementById("saveAppearanceBtn");
let settingsAppearanceDraft=null;
let settingsAppearanceOriginal=null;
let settingsAppearanceSaved=true;

function setSettingsHouseholdMode(mode){
 settingsHouseholdMode=mode==="solo"?"solo":"couple";
 settingsModeButtons.forEach(button=>{
  const active=button.dataset.householdMode===settingsHouseholdMode;
  button.classList.toggle("active",active);
  button.setAttribute("aria-pressed",String(active));
 });
 if(settingsPersonAField)settingsPersonAField.hidden=settingsHouseholdMode==="solo";
 if(settingsPersonBLabel)settingsPersonBLabel.textContent=settingsHouseholdMode==="solo"?"VOTRE NOM":"PERSONNE 1";
}
settingsModeButtons.forEach(button=>button.addEventListener("click",()=>setSettingsHouseholdMode(button.dataset.householdMode)));

function fillHouseholdSettings(){
 const household=normalizeHousehold(state.household);
 settingsHouseholdName.value=household.name;
 settingsPersonB.value=household.personB;
 settingsPersonA.value=household.personA;
 setSettingsHouseholdMode(household.mode);
}
function fillAppearanceSettings(){
 if(typeof currentUserAppearance!=="function"||!settingsAppearancePicker)return;
 settingsAppearanceDraft=currentUserAppearance();
 settingsAppearanceOriginal={...settingsAppearanceDraft};
 settingsAppearanceSaved=true;
 settingsAppearancePicker.innerHTML=appearancePickerMarkup("settings",settingsAppearanceDraft);
}
function previewSettingsAppearance(next){
 settingsAppearanceDraft=normalizeUserAppearance(next);
 settingsAppearanceSaved=false;
 applyUserAppearance(settingsAppearanceDraft);
 if(settingsAppearancePicker)settingsAppearancePicker.innerHTML=appearancePickerMarkup("settings",settingsAppearanceDraft);
}
settingsAppearancePicker?.addEventListener("click",event=>{
 const button=event.target.closest("[data-appearance-color],[data-appearance-font]");
 if(!button||!settingsAppearanceDraft)return;
 previewSettingsAppearance(appearanceFromPickerEvent(button,settingsAppearanceDraft));
});
saveAppearanceBtn?.addEventListener("click",async()=>{
 if(!settingsAppearanceDraft)return;
 saveAppearanceBtn.disabled=true;
 try{
  settingsAppearanceDraft=await saveUserAppearance(settingsAppearanceDraft);
  settingsAppearanceOriginal={...settingsAppearanceDraft};
  settingsAppearanceSaved=true;
  settingsAppearancePicker.innerHTML=appearancePickerMarkup("settings",settingsAppearanceDraft);
  showUndoToast("Apparence enregistrée");
 }catch(error){
  console.error("Appearance save",error);
  alert("Impossible d’enregistrer l’apparence pour le moment.");
 }finally{saveAppearanceBtn.disabled=false}
});
function openSettings(){
 fillHouseholdSettings();
 fillAppearanceSettings();
 if(typeof updateCloudAccountUi==="function")updateCloudAccountUi();
 if(typeof updateCloudHouseholdUi==="function")updateCloudHouseholdUi();
 settingsBackdrop.classList.add("open");
 settingsBackdrop.setAttribute("aria-hidden","false");
}
function closeSettings(){
 if(!settingsAppearanceSaved&&settingsAppearanceOriginal)applyUserAppearance(settingsAppearanceOriginal);
 settingsAppearanceDraft=null;
 settingsAppearanceOriginal=null;
 settingsAppearanceSaved=true;
 settingsBackdrop.classList.remove("open");
 settingsBackdrop.setAttribute("aria-hidden","true");
}
document.getElementById("settingsBtn").addEventListener("click",openSettings);
document.getElementById("closeSettings").addEventListener("click",closeSettings);
settingsBackdrop.addEventListener("click",e=>{if(e.target===settingsBackdrop)closeSettings()});

function reloadUiFromState(){
 applyCategoryState();ensureMonthAvailable(state.selectedMonth);
 MONTHS.forEach(label=>{if(![...monthSelect.options].some(o=>o.value===label)){const o=document.createElement("option");o.value=label;o.textContent=label;monthSelect.appendChild(o)}});
 rebuildCustomSelect(monthSelect);monthSelect.value=state.selectedMonth;syncCustomSelect(monthSelect);
 trackingYear=Number(monthKey(state.selectedMonth).slice(0,4));syncHouseholdUi();updateMonthNav();render()
}
function installPreparedState(next){
 state=normalizeState(cloneData(next));state.onboardingComplete=true;saveState();reloadUiFromState();
}
function isPlainObject(v){return !!v&&typeof v==="object"&&!Array.isArray(v)}
function validateTransactions(list){
 if(!Array.isArray(list))return false;
 const ownerOk=o=>o==null||["common","B","A"].includes(o);
 return list.every(t=>isPlainObject(t)&&typeof t.id==="string"&&["income","expense"].includes(t.type)&&typeof t.category==="string"&&Number.isFinite(Number(t.amount))&&/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||""))&&ownerOk(t.owner)&&(t.scope==null||t.scope==="forward")&&(t.excludedMonths==null||Array.isArray(t.excludedMonths))&&(t.overrides==null||isPlainObject(t.overrides)))
}
function validateV5State(candidate){
 return isPlainObject(candidate)&&Number(candidate.schemaVersion)>=5&&typeof candidate.selectedMonth==="string"&&validateTransactions(candidate.transactions)&&Array.isArray(candidate.baseIncomeCategories)&&Array.isArray(candidate.baseExpenseCategories)
}
function validateLegacyState(candidate){
 if(!isPlainObject(candidate)||!Array.isArray(candidate.transactions)||typeof candidate.selectedMonth!=="string"||!validateTransactions(candidate.transactions))return false;
 for(const key of ["customExpenseCategories","customIncomeCategories","deletedCategoriesGlobal","deletedIncomeCategoriesGlobal"]){if(candidate[key]!=null&&!Array.isArray(candidate[key]))return false}
 for(const key of ["categoryBudgets","incomeBudgets","categoryOwners","incomeCategoryOwners","categoryNames","incomeCategoryNames","expensePlanChanges","incomePlanChanges","deletedCategoryMonths","deletedIncomeCategoryMonths"]){if(candidate[key]!=null&&!isPlainObject(candidate[key]))return false}
 return true
}
function legacyCreatedMonth(candidate){
 const months=(candidate.transactions||[]).map(t=>String(t.date||"").slice(0,7)).filter(value=>/^\d{4}-\d{2}$/.test(value)).sort();
 return months[0]||monthKey(candidate.selectedMonth||currentMonthLabel())
}
function inferLegacyPerson(candidate,profile,owner,fallback){
 const list=Array.isArray(profile?.incomeCategories)?profile.incomeCategories:[];
 const item=list.find(c=>c.owner===owner&&/salaire/i.test(String(c.name||"")))||list.find(c=>c.owner===owner);
 if(!item)return fallback;
 const effective=(candidate.incomeCategoryNames?.[item.id]||item.name||"").trim();
 const stripped=effective.replace(/^salaire\s+/i,"").replace(/^revenu supplémentaire\s+/i,"").trim();
 return stripped&&stripped.length<=40?stripped:fallback
}
function buildLegacyV5State(candidate,profile){
 if(!validateLegacyState(candidate)||!Array.isArray(profile?.incomeCategories)||!Array.isArray(profile?.expenseCategories))throw new Error("legacy-format");
 const createdMonth=legacyCreatedMonth(candidate),next=cloneData(candidate);
 next.schemaVersion=5;next.onboardingComplete=true;next.createdMonth=createdMonth;
 next.baseIncomeCategories=profile.incomeCategories.map(c=>({...cloneData(c),createdFrom:c.createdFrom||createdMonth}));
 next.baseExpenseCategories=profile.expenseCategories.map(c=>({...cloneData(c),createdFrom:c.createdFrom||createdMonth}));
 next.household={
  name:"Mon foyer",
  personB:inferLegacyPerson(candidate,profile,"B","Personne 1"),
  personA:inferLegacyPerson(candidate,profile,"A","Personne 2")
 };
 return normalizeState(next)
}
let legacyProfilePromise=null;
function loadLegacyProfile(){
 if(legacyProfilePromise)return legacyProfilePromise;
 legacyProfilePromise=new Promise((resolve,reject)=>{
  const iframe=document.createElement("iframe");iframe.hidden=true;iframe.setAttribute("aria-hidden","true");
  const cleanup=()=>{window.removeEventListener("message",onMessage);iframe.remove()};
  const timer=setTimeout(()=>{cleanup();legacyProfilePromise=null;reject(new Error("legacy-timeout"))},5000);
  function onMessage(event){
   if(event.origin!==location.origin||event.data?.type!=="budget-legacy-profile-v2.2")return;
   clearTimeout(timer);cleanup();resolve(event.data.profile)
  }
  window.addEventListener("message",onMessage);iframe.src=`legacy-profile.html?v=${Date.now()}`;document.body.appendChild(iframe)
 });
 return legacyProfilePromise
}
async function prepareImportedState(candidate){
 if(validateV5State(candidate))return normalizeState(cloneData(candidate));
 if(validateLegacyState(candidate)){const profile=await loadLegacyProfile();return buildLegacyV5State(candidate,profile)}
 throw new Error("format")
}
async function readStateFile(file){
 const parsed=JSON.parse(await file.text()),candidate=parsed?.state||parsed;
 return prepareImportedState(candidate)
}
async function migrateLegacySource(source){
 const raw=localStorage.getItem(source.key);if(!raw)throw new Error("missing");
 const candidate=JSON.parse(raw),profile=await loadLegacyProfile();
 const next=buildLegacyV5State(candidate,profile);installPreparedState(next);return next
}
function availableLegacySources(){
 return LEGACY_STORAGE_SOURCES.filter(source=>{try{return !!localStorage.getItem(source.key)}catch{return false}})
}

document.getElementById("saveHouseholdBtn").addEventListener("click",()=>{
 const previousMode=normalizeHousehold(state.household).mode;
 state.household=normalizeHousehold({
  name:settingsHouseholdName.value,
  personB:settingsPersonB.value,
  personA:settingsPersonA.value,
  mode:settingsHouseholdMode
 });
 saveState();syncHouseholdUi();render();fillHouseholdSettings();
 showUndoToast(previousMode===state.household.mode?"Foyer enregistré":state.household.mode==="solo"?"Mode seul activé":"Mode à deux activé")
});
document.getElementById("migrateLocalBtn").addEventListener("click",()=>{closeSettings();openOnboarding(true)});

document.getElementById("exportBtn").addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify({app:"Budget foyer",version:5,exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download=`budget-foyer-v5-${monthKey(state.selectedMonth)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
});

const importFile=document.getElementById("importFile");
document.getElementById("importBtn").addEventListener("click",()=>importFile.click());
importFile.addEventListener("change",async()=>{
 const file=importFile.files?.[0];if(!file)return;
 try{
  const next=await readStateFile(file);
  if(!confirm("Importer cette sauvegarde et remplacer les données actuelles du foyer partagé V2.5 ?"))return;
  installPreparedState(next);showUndoToast("Sauvegarde importée")
 }catch{alert("Ce fichier n’est pas une sauvegarde compatible de Budget foyer.")}
 finally{importFile.value=""}
});

document.getElementById("resetBtn").addEventListener("click",()=>{
 if(!confirm("Réinitialiser les données du foyer partagé V2.5 ? Cette modification sera synchronisée sur les autres appareils."))return;
 state=seedState();saveState();reloadUiFromState();closeSettings();openOnboarding(false)
});
