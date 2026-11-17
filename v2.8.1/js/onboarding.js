// V2.7 — migration locale et import des anciennes sauvegardes
const onboardingBackdrop=document.getElementById("onboardingBackdrop");
const legacySourceList=document.getElementById("legacySourceList");
const onboardingStatus=document.getElementById("onboardingStatus");
const onboardingImportFile=document.getElementById("onboardingImportFile");

function setOnboardingStatus(message,type=""){
 onboardingStatus.textContent=message||"";onboardingStatus.className=`onboarding-status ${type}`.trim()
}
function renderLegacySources(){
 const sources=availableLegacySources();
 legacySourceList.innerHTML=sources.length?sources.map(source=>`<button class="legacy-source" type="button" data-legacy-key="${escapeHtml(source.key)}"><span><strong>Migrer ${escapeHtml(source.label)}</strong><small>Données trouvées dans ce navigateur</small></span><span>→</span></button>`).join(""):`<div class="legacy-empty">Aucune ancienne version locale détectée sur ce navigateur.</div>`
}
function openOnboarding(migrationOnly=false){
 renderLegacySources();setOnboardingStatus("");
 const closeBtn=document.getElementById("closeOnboardingBtn");
 if(closeBtn)closeBtn.style.display=state.onboardingComplete?"inline-flex":"none";
 onboardingBackdrop.classList.add("open");onboardingBackdrop.setAttribute("aria-hidden","false");
 if(migrationOnly)setOnboardingStatus("Choisis une version locale ou une sauvegarde à copier vers V2.7.")
}
function closeOnboarding(){
 if(!state.onboardingComplete)return;
 onboardingBackdrop.classList.remove("open");onboardingBackdrop.setAttribute("aria-hidden","true")
}
function initOnboarding(){
 renderLegacySources();
 if(!state.onboardingComplete)openOnboarding(false)
}
legacySourceList.addEventListener("click",async e=>{
 const button=e.target.closest("[data-legacy-key]");if(!button)return;
 const source=LEGACY_STORAGE_SOURCES.find(s=>s.key===button.dataset.legacyKey);if(!source)return;
 const oldText=button.innerHTML;button.disabled=true;button.textContent="Migration en cours…";setOnboardingStatus("Lecture de l’ancienne version…");
 try{
  await migrateLegacySource(source);setOnboardingStatus(`${source.label} copiée vers V2.7.`,"success");closeOnboarding();showUndoToast(`${source.label} migrée vers V2.7`)
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
