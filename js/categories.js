// V2.3 — gestion des catégories et budgets
const categoryGrid=document.getElementById("categoryGrid"),categoryEditBackdrop=document.getElementById("categoryEditBackdrop"),categoryEditTitle=document.getElementById("categoryEditTitle"),categoryEditKind=document.getElementById("categoryEditKind"),categoryNameField=document.getElementById("categoryNameField"),categoryNameInput=document.getElementById("categoryNameInput"),categorySectionField=document.getElementById("categorySectionField"),categorySectionButtons=[...document.querySelectorAll("[data-category-section]")],categoryOwnerField=document.getElementById("categoryOwnerField"),categoryOwnerLabel=document.getElementById("categoryOwnerLabel"),categoryOwnerButtons=[...document.querySelectorAll("[data-category-owner]")],categoryBudgetInput=document.getElementById("categoryBudgetInput"),categoryAmountLabel=document.getElementById("categoryAmountLabel"),categoryPlanScopeField=document.getElementById("categoryPlanScopeField"),categoryPlanScopeButtons=[...document.querySelectorAll("[data-plan-scope]")],categoryPlanScopeHint=document.getElementById("categoryPlanScopeHint"),saveCategoryEdit=document.getElementById("saveCategoryEdit");
let categoryEditMode="planned",categoryEditId=null,categoryEditSection=null,categoryEditType="expense",categoryEditOwner="common",categoryPlanScope="forward",categoryEditOrigin="categories";
function setCategoryEditOwner(owner){categoryEditOwner=owner;categoryOwnerButtons.forEach(b=>b.classList.toggle("active",b.dataset.categoryOwner===owner))}
function setCategoryEditSection(section){categoryEditSection=section;categorySectionButtons.forEach(b=>b.classList.toggle("active",b.dataset.categorySection===section))}
function setCategoryPlanScope(scope){categoryPlanScope=scope;categoryPlanScopeButtons.forEach(b=>b.classList.toggle("active",b.dataset.planScope===scope));categoryPlanScopeHint.textContent=scope==="month"?`Ce changement concerne uniquement ${state.selectedMonth}.`:`Le nouveau prévu s'appliquera à ${state.selectedMonth} et aux mois suivants.`}
categoryOwnerButtons.forEach(b=>b.addEventListener("click",()=>setCategoryEditOwner(b.dataset.categoryOwner)));categorySectionButtons.forEach(b=>b.addEventListener("click",()=>setCategoryEditSection(b.dataset.categorySection)));categoryPlanScopeButtons.forEach(b=>b.addEventListener("click",()=>setCategoryPlanScope(b.dataset.planScope)));
function categoriesForType(type){return type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES}
function openCategoryEditor(id=null,section=null,mode="planned",type="expense",origin="categories"){
 closeCustomSelects();categoryEditId=id;categoryEditSection=section;categoryEditMode=id?mode:"add";categoryEditType=type;categoryEditOrigin=origin;const ownerEditable=categoryEditMode==="add"||categoryEditMode==="planned";categoryOwnerField.style.display=ownerEditable?"block":"none";categoryPlanScopeField.style.display=categoryEditMode==="planned"?"block":"none";categorySectionField.style.display=categoryEditMode==="add"&&type==="expense"&&origin==="transaction"?"block":"none";categoryOwnerLabel.textContent=type==="income"?"ATTRIBUTION DU REVENU":"ATTRIBUTION DE LA DÉPENSE";
 if(id){const base=categoriesForType(type).find(x=>x.id===id);if(!base)return;const c=categoryView(base,type);categoryEditKind.textContent=c.name;categoryNameField.style.display=mode==="planned"?"block":"none";categoryNameInput.value=c.name;if(ownerEditable)setCategoryEditOwner(c.owner||"common");if(mode==="actual"){const m=metrics(),a=(type==="income"?m.incMap:m.expMap)[c.id]||0,isSaving=type==="expense"&&!!base.saving;categoryEditTitle.textContent=isSaving?"Modifier l’épargne":type==="income"?"Modifier le revenu réel":"Modifier le réel";categoryAmountLabel.textContent=isSaving?"MONTANT RÉEL ÉPARGNÉ":type==="income"?"MONTANT RÉEL REÇU":"MONTANT RÉEL DÉPENSÉ";categoryBudgetInput.value=Number(a).toFixed(2);saveCategoryEdit.textContent=isSaving?"Enregistrer l’épargne":"Enregistrer le réel";saveCategoryEdit.className=type==="income"||isSaving?"btn btn-income save":"btn btn-ghost save"}else{setCategoryPlanScope("forward");categoryEditTitle.textContent=base.saving?"Modifier l’épargne prévue":"Modifier le prévu";categoryAmountLabel.textContent=base.saving?"MONTANT D’ÉPARGNE PRÉVU":"MONTANT PRÉVU";categoryBudgetInput.value=Number(c.budget||0).toFixed(2);saveCategoryEdit.textContent="Enregistrer le prévu";saveCategoryEdit.className="btn btn-income save"}}
 else{setCategoryEditOwner("common");if(type==="expense")setCategoryEditSection(section||"Vie courante");categoryPlanScopeField.style.display="none";categoryEditTitle.textContent=type==="income"?"Créer un revenu":"Créer une dépense";categoryEditKind.textContent=origin==="transaction"?"Nouveau champ pour cette opération":section||"Catégorie";categoryNameField.style.display="block";categoryNameInput.value="";categoryAmountLabel.textContent="MONTANT PRÉVU";categoryBudgetInput.value="";saveCategoryEdit.textContent="Créer le champ";saveCategoryEdit.className="btn btn-income save"}
 categoryEditBackdrop.classList.add("open");categoryEditBackdrop.setAttribute("aria-hidden","false");setTimeout(()=>{(id?categoryBudgetInput:categoryNameInput).focus()},70);
}
function closeCategoryEditor(){categoryEditBackdrop.classList.remove("open");categoryEditBackdrop.setAttribute("aria-hidden","true")}
function setCategoryActual(id,amount,type="expense",label="Ajustement manuel",meta={}){
 const current=totalsByCategory(type)[id]||0,target=Math.max(0,Math.round((Number(amount)||0)*100)/100),delta=Math.round((target-current)*100)/100;if(Math.abs(delta)<.005)return false;const c=catById(id,type),owner=c?planForCategory(c,state.selectedMonth,type).owner:"common";state.transactions.push({id:uid(),type,category:id,owner,amount:delta,date:transactionDateForSelectedMonth(),seed:false,adjustment:true,adjustmentLabel:label,...meta});return true
}
function categoryTransactionSnapshot(){return cloneData(state.transactions)}
function restoreCategoryTransactions(snapshot){state.transactions=cloneData(snapshot);saveState();render()}
function categoryCurrentView(id,type){
 const base=categoriesForType(type).find(x=>x.id===id);
 return base?categoryView(base,type):null;
}
function fillCategoryActualFromPlan(id,type="expense"){
 const c=categoryCurrentView(id,type);
 if(!c||Number(c.budget)<=.005)return;
 const snapshot=categoryTransactionSnapshot();
 if(!setCategoryActual(id,c.budget,type,"Réel aligné au prévu"))return;
 saveState();render();
 showUndoToast(`${c.name} renseigné à ${euro(c.budget)}`,()=>restoreCategoryTransactions(snapshot));
}
function setSectionActual(type,section,mode){
 const cats=type==="income"?visibleIncomeCategories():section==="__savings__"?visibleSavingCategories():visibleExpenseCategories().filter(c=>c.section===section);
 const totals=totalsByCategory(type),snapshot=categoryTransactionSnapshot(),groupName=type==="income"?"Revenus":section==="__savings__"?"Épargne":section,groupId=`bulk-${uid()}`;
 const isFillEmpty=mode==="fill-empty",action=isFillEmpty?"Remplissage des vides":"Remise à zéro",bulkLabel=`${groupName} · ${isFillEmpty?"remplissage des vides":"tout vider"}`;
 let changed=0;
 cats.forEach(c=>{
  const current=Number(totals[c.id]||0),planned=Number(c.budget)||0;
  if(isFillEmpty){
   if(Math.abs(current)>=.005||planned<=.005)return;
   if(setCategoryActual(c.id,planned,type,action,{bulkGroupId:groupId,bulkLabel}))changed++;
  }else{
   if(Math.abs(current)<.005)return;
   if(setCategoryActual(c.id,0,type,action,{bulkGroupId:groupId,bulkLabel}))changed++;
  }
 });
 if(!changed){
  showUndoToast(isFillEmpty?"Aucun montant vide à renseigner":"Tous les montants sont déjà à zéro");
  return;
 }
 saveState();render();
 showUndoToast(isFillEmpty?`${changed} montant${changed>1?"s":""} renseigné${changed>1?"s":""}`:`${changed} montant${changed>1?"s":""} remis à zéro`,()=>restoreCategoryTransactions(snapshot));
}
function categoryMenuRoot(menu){return menu?.closest(".cat-item,.cat-section-menu-wrap")||null}
function setCategoryMenuOpen(menu,open){
 if(!menu)return;
 const root=categoryMenuRoot(menu),trigger=root?.querySelector("[data-category-menu-trigger],[data-section-menu-trigger]");
 menu.hidden=!open;
 root?.classList.toggle("menu-open",open);
 trigger?.setAttribute("aria-expanded",open?"true":"false");
}
function resetBulkClearButtons(scope=categoryGrid){
 scope.querySelectorAll("[data-bulk-clear][data-confirm-clear='1']").forEach(button=>{
  button.dataset.confirmClear="0";
  button.textContent="Tout vider…";
  button.classList.remove("armed");
 });
}
function closeCategoryMenus(except=null){
 categoryGrid.querySelectorAll("[data-category-menu],[data-section-menu]").forEach(menu=>{if(menu!==except)setCategoryMenuOpen(menu,false)});
 if(!except)resetBulkClearButtons();
}
function toggleCategoryMenu(menu){
 const open=menu.hidden;
 closeCategoryMenus(menu);
 setCategoryMenuOpen(menu,open);
}
function armBulkClear(button){
 if(button.dataset.confirmClear==="1"){
  const type=button.dataset.categoryType||"expense",section=button.dataset.section||"";
  closeCategoryMenus();
  setSectionActual(type,section,"clear");
  return;
 }
 button.dataset.confirmClear="1";
 button.textContent="Confirmer tout vider";
 button.classList.add("armed");
 setTimeout(()=>{
  if(!button.isConnected||button.dataset.confirmClear!=="1")return;
  button.dataset.confirmClear="0";
  button.textContent="Tout vider…";
  button.classList.remove("armed");
 },4000);
}

categoryGrid.addEventListener("click",e=>{
 const rowMenuTrigger=e.target.closest("[data-category-menu-trigger]");
 if(rowMenuTrigger){toggleCategoryMenu(rowMenuTrigger.closest(".cat-item")?.querySelector("[data-category-menu]"));return}
 const sectionMenuTrigger=e.target.closest("[data-section-menu-trigger]");
 if(sectionMenuTrigger){toggleCategoryMenu(sectionMenuTrigger.closest(".cat-section-menu-wrap")?.querySelector("[data-section-menu]"));return}
 const bulkClear=e.target.closest("[data-bulk-clear]");
 if(bulkClear){armBulkClear(bulkClear);return}
 const bulk=e.target.closest("[data-bulk-action]");
 if(bulk){closeCategoryMenus();setSectionActual(bulk.dataset.categoryType||"expense",bulk.dataset.section||"",bulk.dataset.bulkAction);return}
 const fill=e.target.closest("[data-fill-category]");
 if(fill){closeCategoryMenus();fillCategoryActualFromPlan(fill.dataset.fillCategory,fill.dataset.categoryType||"expense");return}
 const actual=e.target.closest("[data-edit-actual]");
 if(actual){closeCategoryMenus();openCategoryEditor(actual.dataset.editActual,null,"actual",actual.dataset.categoryType||"expense");return}
 const planned=e.target.closest("[data-edit-planned]");
 if(planned){closeCategoryMenus();openCategoryEditor(planned.dataset.editPlanned,null,"planned",planned.dataset.categoryType||"expense");return}
 const del=e.target.closest("[data-delete-category]");
 if(del){closeCategoryMenus();openCategoryDelete(del.dataset.deleteCategory,del.dataset.categoryType||"expense");return}
 const add=e.target.closest("[data-add-category]");
 if(add){closeCategoryMenus();openCategoryEditor(null,add.dataset.addCategory,"planned",add.dataset.categoryType||"expense");return}
 const addSaving=e.target.closest("[data-add-saving]");
 if(addSaving){closeCategoryMenus();openModal("saving")}
});
document.addEventListener("click",e=>{
 if(e.target.closest("[data-category-menu-trigger],[data-section-menu-trigger],[data-category-menu],[data-section-menu]"))return;
 closeCategoryMenus();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCategoryMenus()});
function renameCategory(id,type,name){name=String(name||"").trim();if(!name)return;const map=type==="income"?(state.incomeCategoryNames=state.incomeCategoryNames||{}):(state.categoryNames=state.categoryNames||{});map[id]=name;const custom=type==="income"?state.customIncomeCategories:state.customExpenseCategories,found=custom.find(c=>c.id===id);if(found)found.name=name;const c=catById(id,type);if(c)c.name=name}
document.getElementById("closeCategoryEdit").addEventListener("click",closeCategoryEditor);categoryEditBackdrop.addEventListener("click",e=>{if(e.target===categoryEditBackdrop)closeCategoryEditor()});
saveCategoryEdit.addEventListener("click",()=>{const amount=Math.max(0,Math.round((Number(categoryBudgetInput.value)||0)*100)/100);let createdId=null;if(categoryEditMode==="planned"){const c=categoriesForType(categoryEditType).find(x=>x.id===categoryEditId);if(!c)return;const newName=categoryNameInput.value.trim();if(newName)renameCategory(c.id,categoryEditType,newName);setCategoryPlan(c.id,categoryEditType,amount,categoryEditOwner,categoryPlanScope)}else if(categoryEditMode==="actual"){const c=catById(categoryEditId,categoryEditType),label=c?.saving?"Ajustement épargne":"Ajustement manuel";setCategoryActual(categoryEditId,amount,categoryEditType,label)}else{const name=categoryNameInput.value.trim();if(!name)return categoryNameInput.focus();const createdFrom=monthKey(state.selectedMonth);if(categoryEditType==="income"){const c={id:`custom-income-${uid()}`,name,budget:amount,owner:categoryEditOwner,custom:true,createdFrom};createdId=c.id;INCOME_CATEGORIES.push(c);state.customIncomeCategories.push({...c});state.incomeBudgets[c.id]=amount;state.incomeCategoryOwners[c.id]=categoryEditOwner}else{const c={id:`custom-${uid()}`,name,budget:amount,section:categoryEditSection||"Vie courante",owner:categoryEditOwner,custom:true,createdFrom};createdId=c.id;EXPENSE_CATEGORIES.push(c);state.customExpenseCategories.push({...c});state.categoryBudgets[c.id]=amount;state.categoryOwners[c.id]=categoryEditOwner}}saveState();closeCategoryEditor();render();if(createdId&&categoryEditOrigin==="transaction")selectCreatedTransactionCategory(createdId)});

let categoryDeleteId=null,categoryDeleteType="expense";const categoryDeleteBackdrop=document.getElementById("categoryDeleteBackdrop"),categoryDeleteName=document.getElementById("categoryDeleteName"),categoryDeleteKind=document.getElementById("categoryDeleteKind");
function openCategoryDelete(id,type="expense"){const c=categoriesForType(type).find(x=>x.id===id);if(!c)return;categoryDeleteId=id;categoryDeleteType=type;categoryDeleteName.textContent=c.name;categoryDeleteKind.textContent=state.selectedMonth;categoryDeleteBackdrop.classList.add("open");categoryDeleteBackdrop.setAttribute("aria-hidden","false")}
function closeCategoryDelete(){categoryDeleteBackdrop.classList.remove("open");categoryDeleteBackdrop.setAttribute("aria-hidden","true");categoryDeleteId=null;categoryDeleteType="expense"}
function deleteCategoryForMonth(){if(!categoryDeleteId)return;const key=monthKey(state.selectedMonth),store=categoryDeleteType==="income"?(state.deletedIncomeCategoryMonths=state.deletedIncomeCategoryMonths||{}):(state.deletedCategoryMonths=state.deletedCategoryMonths||{});const list=new Set(store[key]||[]);list.add(categoryDeleteId);store[key]=[...list];saveState();closeCategoryDelete();render()}
function deleteCategoryForAllMonths(){if(!categoryDeleteId)return;const globalKey=categoryDeleteType==="income"?"deletedIncomeCategoriesGlobal":"deletedCategoriesGlobal",monthKeyName=categoryDeleteType==="income"?"deletedIncomeCategoryMonths":"deletedCategoryMonths";state[globalKey]=Array.isArray(state[globalKey])?state[globalKey]:[];if(!state[globalKey].includes(categoryDeleteId))state[globalKey].push(categoryDeleteId);Object.keys(state[monthKeyName]||{}).forEach(key=>{state[monthKeyName][key]=(state[monthKeyName][key]||[]).filter(id=>id!==categoryDeleteId);if(!state[monthKeyName][key].length)delete state[monthKeyName][key]});saveState();closeCategoryDelete();render()}
document.getElementById("closeCategoryDelete").addEventListener("click",closeCategoryDelete);document.getElementById("cancelCategoryDelete").addEventListener("click",closeCategoryDelete);document.getElementById("deleteCategoryMonth").addEventListener("click",deleteCategoryForMonth);document.getElementById("deleteCategoryAll").addEventListener("click",deleteCategoryForAllMonths);categoryDeleteBackdrop.addEventListener("click",e=>{if(e.target===categoryDeleteBackdrop)closeCategoryDelete()});
