// V2.2 — paramètres, migration V1, import/export et reset
const settingsBackdrop=document.getElementById("settingsBackdrop");function openSettings(){settingsBackdrop.classList.add("open");settingsBackdrop.setAttribute("aria-hidden","false")}function closeSettings(){settingsBackdrop.classList.remove("open");settingsBackdrop.setAttribute("aria-hidden","true")}document.getElementById("settingsBtn").addEventListener("click",openSettings);document.getElementById("closeSettings").addEventListener("click",closeSettings);settingsBackdrop.addEventListener("click",e=>{if(e.target===settingsBackdrop)closeSettings()});

function reloadUiFromState(){
 applyCategoryState();ensureMonthAvailable(state.selectedMonth);
 MONTHS.forEach(label=>{if(![...monthSelect.options].some(o=>o.value===label)){const o=document.createElement("option");o.value=label;o.textContent=label;monthSelect.appendChild(o)}});
 rebuildCustomSelect(monthSelect);monthSelect.value=state.selectedMonth;syncCustomSelect(monthSelect);trackingYear=Number(monthKey(state.selectedMonth).slice(0,4));updateMonthNav();render()
}
document.getElementById("copyV1Btn")?.addEventListener("click",()=>{
 try{
  const raw=localStorage.getItem(V1_STORAGE_KEY);if(!raw){alert("Aucune donnée V1 locale n’a été trouvée dans ce navigateur.");return}
  const candidate=JSON.parse(raw);if(!candidate||!Array.isArray(candidate.transactions)){alert("Les données V1 trouvées ne sont pas exploitables.");return}
  if(!confirm("Copier les données V1 dans cette V2 ? Les données V1 resteront intactes, mais les données actuelles de la V2 seront remplacées."))return;
  localStorage.setItem(STORAGE_KEY,JSON.stringify({...candidate,schemaVersion:4}));state=loadState();reloadUiFromState();showUndoToast("Données V1 copiées dans la V2");closeSettings()
 }catch{alert("Impossible de copier les données V1 dans cette V2.")}
});

document.getElementById("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({app:"Budget foyer",version:4,exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`budget-foyer-${monthKey(state.selectedMonth)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
function isPlainObject(v){return !!v&&typeof v==="object"&&!Array.isArray(v)}
function validateImportedState(candidate){
 if(!isPlainObject(candidate)||!Array.isArray(candidate.transactions)||typeof candidate.selectedMonth!=="string")return false;
 if(!/^(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre) \d{4}$/.test(candidate.selectedMonth))return false;
 const ownerOk=o=>o==null||["common","B","A"].includes(o);
 const txOk=t=>isPlainObject(t)&&typeof t.id==="string"&&["income","expense"].includes(t.type)&&typeof t.category==="string"&&Number.isFinite(Number(t.amount))&&/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||""))&&ownerOk(t.owner)&&(t.scope==null||t.scope==="forward")&&(t.excludedMonths==null||Array.isArray(t.excludedMonths))&&(t.overrides==null||isPlainObject(t.overrides));
 if(!candidate.transactions.every(txOk))return false;
 for(const key of ["customExpenseCategories","customIncomeCategories","deletedCategoriesGlobal","deletedIncomeCategoriesGlobal"]){if(candidate[key]!=null&&!Array.isArray(candidate[key]))return false}
 for(const key of ["categoryBudgets","incomeBudgets","categoryOwners","incomeCategoryOwners","categoryNames","incomeCategoryNames","expensePlanChanges","incomePlanChanges","deletedCategoryMonths","deletedIncomeCategoryMonths"]){if(candidate[key]!=null&&!isPlainObject(candidate[key]))return false}
 return true
}
const importFile=document.getElementById("importFile");document.getElementById("importBtn").addEventListener("click",()=>importFile.click());importFile.addEventListener("change",async()=>{const file=importFile.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()),candidate=parsed?.state||parsed;if(!validateImportedState(candidate))throw new Error("format");if(!confirm("Importer cette sauvegarde et remplacer les données locales actuelles ?")){importFile.value="";return}candidate.schemaVersion=4;localStorage.setItem(STORAGE_KEY,JSON.stringify(candidate));state=loadState();reloadUiFromState();showUndoToast("Sauvegarde importée")}catch{alert("Ce fichier n’est pas une sauvegarde valide de Budget foyer.")}finally{importFile.value=""}});
document.getElementById("resetBtn").addEventListener("click",()=>{if(confirm("Réinitialiser toutes les données avec la base de septembre 2026 ? Cette action efface les modifications locales.")){state=seedState();applyCategoryState();saveState();monthSelect.value=state.selectedMonth;syncCustomSelect(monthSelect);updateMonthNav();render();closeSettings()}});
