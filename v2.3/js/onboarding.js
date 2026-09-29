// V2.3 — onboarding local et migration depuis les anciennes versions
const onboardingBackdrop=document.getElementById("onboardingBackdrop");
const legacySourceList=document.getElementById("legacySourceList");
const onboardingStatus=document.getElementById("onboardingStatus");
const setupHouseholdName=document.getElementById("setupHouseholdName");
const setupPersonB=document.getElementById("setupPersonB");
const setupPersonA=document.getElementById("setupPersonA");
const onboardingImportFile=document.getElementById("onboardingImportFile");

function personalizeTemplateNames(target){
 const b=target.household.personB,a=target.household.personA;
 target.baseIncomeCategories.forEach(c=>{c.name=String(c.name).replace(/personne 1/gi,b).replace(/personne 2/gi,a)});
 target.baseExpenseCategories.forEach(c=>{c.name=String(c.name).replace(/personne 1/gi,b).replace(/personne 2/gi,a)})
}
function setOnboardingStatus(message,type=""){
 onboardingStatus.textContent=message||"";onboardingStatus.className=`onboarding-status ${type}`.trim()
}
function renderLegacySources(){
 const sources=availableLegacySources();
 legacySourceList.innerHTML=sources.length?sources.map(source=>`<button class="legacy-source" type="button" data-legacy-key="${escapeHtml(source.key)}"><span><strong>Migrer ${escapeHtml(source.label)}</strong><small>Données trouvées dans ce navigateur</small></span><span>→</span></button>`).join(""):`<div class="legacy-empty">Aucune ancienne version locale détectée sur ce navigateur.</div>`
}
function openOnboarding(migrationOnly=false){
 renderLegacySources();setOnboardingStatus("");
 const household=normalizeHousehold(state.household);
 setupHouseholdName.value=state.onboardingComplete?household.name:"";
 setupPersonB.value=state.onboardingComplete?household.personB:"";
 setupPersonA.value=state.onboardingComplete?household.personA:"";
 document.getElementById("closeOnboardingBtn").style.display=state.onboardingComplete?"inline-flex":"none";
 onboardingBackdrop.classList.add("open");onboardingBackdrop.setAttribute("aria-hidden","false");
 if(migrationOnly)setOnboardingStatus("Choisis une version locale ou une sauvegarde à copier vers V2.3.")
}
function closeOnboarding(){
 if(!state.onboardingComplete)return;
 onboardingBackdrop.classList.remove("open");onboardingBackdrop.setAttribute("aria-hidden","true")
}
function initOnboarding(){
 renderLegacySources();
 if(!state.onboardingComplete)openOnboarding(false)
}
document.getElementById("createNewBudgetBtn").addEventListener("click",()=>{
 const next=seedState();
 next.household=normalizeHousehold({name:setupHouseholdName.value,personB:setupPersonB.value,personA:setupPersonA.value});
 next.onboardingComplete=true;personalizeTemplateNames(next);installPreparedState(next);closeOnboarding();showUndoToast("Nouveau budget créé")
});
legacySourceList.addEventListener("click",async e=>{
 const button=e.target.closest("[data-legacy-key]");if(!button)return;
 const source=LEGACY_STORAGE_SOURCES.find(s=>s.key===button.dataset.legacyKey);if(!source)return;
 const oldText=button.innerHTML;button.disabled=true;button.textContent="Migration en cours…";setOnboardingStatus("Lecture de l’ancienne version…");
 try{
  await migrateLegacySource(source);setOnboardingStatus(`${source.label} copiée vers V2.3.`,"success");closeOnboarding();showUndoToast(`${source.label} migrée vers V2.3`)
 }catch{
  button.disabled=false;button.innerHTML=oldText;setOnboardingStatus("Impossible de migrer cette version locale.","error")
 }
});
document.getElementById("onboardingImportBtn").addEventListener("click",()=>onboardingImportFile.click());
onboardingImportFile.addEventListener("change",async()=>{
 const file=onboardingImportFile.files?.[0];if(!file)return;
 setOnboardingStatus("Import de la sauvegarde…");
 try{
  const next=await readStateFile(file);installPreparedState(next);setOnboardingStatus("Sauvegarde importée.","success");closeOnboarding();showUndoToast("Sauvegarde importée")
 }catch{setOnboardingStatus("Sauvegarde incompatible.","error")}
 finally{onboardingImportFile.value=""}
});
document.getElementById("closeOnboardingBtn").addEventListener("click",closeOnboarding);
