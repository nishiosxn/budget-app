"use strict";
const categorySettingsBackdrop=document.getElementById("categorySettingsBackdrop");
const categorySettingsForm=document.getElementById("categorySettingsForm");
let categorySettingsTarget=null;
let clearArmTimer=null;

function prototypeSectionCategories(type,section){
 if(type==="income")return visibleIncomeCategories();
 if(section==="__savings__")return visibleSavingCategories();
 return visibleExpenseCategories().filter(c=>categorySectionOf(c)===section);
}
function revertPrototypeAdjustments(ids){
 // Remove ONLY the adjustments created by this action, never restore a global snapshot.
 if(!ids.length)return;
 const created=new Set(ids);
 state.transactions=state.transactions.filter(t=>!created.has(t.id));
 saveState();render();
}
function prototypeWriteActual(id,target,type,label,meta={}){
 const before=state.transactions.length;
 if(!setCategoryActual(id,target,type,label,meta))return null;
 const transaction=state.transactions[state.transactions.length-1];
 return state.transactions.length>before?transaction.id:null;
}
function prototypeBulkActual(type,section,operation){
 if(operation!=="fill-empty"&&operation!=="clear")return 0;
 const categories=prototypeSectionCategories(type,section);
 const totals=totalsByCategory(type);
 const group=type==="income"?"Revenus":section==="__savings__"?"Épargne":section;
 const groupId="bulk-"+uid(),created=[];
 for(const c of categories){
  const actual=Number(totals[c.id]||0),planned=Number(c.budget||0);
  // "Remplir les vides" must never overwrite a real amount, including an overrun.
  if(operation==="fill-empty"&&(Math.abs(actual)>=.005||planned<=.005))continue;
  if(operation==="clear"&&Math.abs(actual)<.005)continue;
  const target=operation==="fill-empty"?planned:0;
  const label=operation==="fill-empty"?"Remplissage d'un montant vide":"Remise du réel à zéro";
  const id=prototypeWriteActual(c.id,target,type,label,{bulkGroupId:groupId,bulkLabel:group+" · "+label});
  if(id)created.push(id);
 }
 if(!created.length){
  showUndoToast(operation==="fill-empty"?"Aucun montant vide à compléter":"Montants déjà à zéro");
  return 0;
 }
 saveState();render();
 const changed=created.length;
 const message=operation==="fill-empty"?changed+" montant"+(changed>1?"s":"")+" vide"+(changed>1?"s":"")+" complété"+(changed>1?"s":""):
  changed+" réel"+(changed>1?"s":"")+" remis à zéro · opérations conservées";
 showUndoToast(message,()=>revertPrototypeAdjustments(created));
 return changed;
}
function prototypeFillOne(id,type,button){
 const c=categoryCurrentView(id,type);
 if(!c||Number(c.budget||0)<=.005)return;
 const current=Number(totalsByCategory(type)[id]||0),planned=Number(c.budget);
 if(Math.abs(current-planned)<.005)return;
 if(Math.abs(current)>=.005&&button?.dataset.demoArmed!=="true"){
  button.dataset.demoArmed="true";
  button.dataset.initialReal=String(current);
  const baseLabel=button.getAttribute?.("aria-label")||"Aligner sur le prévu";
  button.textContent="Confirmer";
  button.setAttribute("aria-label","Confirmer l’alignement du réel de "+c.name+" sur "+euro(planned));
  button.focus();
  setTimeout(()=>{if(button.isConnected&&button.dataset.demoArmed==="true"){
   button.dataset.demoArmed="false";
   button.innerHTML=categoryActionIcon("check");
   button.setAttribute("aria-label",baseLabel);
  }},4500);
  return;
 }
 if(button?.dataset.demoArmed==="true"&&Math.abs(Number(button.dataset.initialReal)-current)>=.005){
  button.dataset.demoArmed="false";
  render();return;
 }
 const created=prototypeWriteActual(id,planned,type,"Réel aligné au prévu (confirmé)");
 if(!created)return;
 saveState();render();
 showUndoToast(c.name+" : réel aligné au prévu",()=>revertPrototypeAdjustments([created]));
}
function prototypeSettingsField(id){return document.getElementById(id)}
function openCategorySettings(id,type="expense",focusField="name"){
 const base=catById(id,type);
 if(!base)return;
 const c=categoryView(base,type);
 const actual=Number(totalsByCategory(type)[id]||0);
 categorySettingsTarget={id,type,month:state.selectedMonth,household:activeHouseholdId,actual,planned:c.budget,owner:c.owner,name:c.name};
 prototypeSettingsField("categorySettingsTitle").textContent=c.name;
 prototypeSettingsField("categorySettingsName").value=c.name;
 prototypeSettingsField("categorySettingsActual").value=actual.toFixed(2);
 prototypeSettingsField("categorySettingsPlanned").value=Number(c.budget||0).toFixed(2);
 prototypeSettingsField("categorySettingsOwner").value=c.owner||"common";
 const groupField=prototypeSettingsField("categorySettingsSectionField");
 const section=prototypeSettingsField("categorySettingsSection");
 groupField.hidden=type==="income"||!!base.saving;
 section.value=categorySectionOf(c);section.disabled=true;
 const ownerSelect=prototypeSettingsField("categorySettingsOwner");
 for(const option of ownerSelect.options){option.textContent=ownerLabel(option.value);option.disabled=state.household.mode==="solo"&&option.value!=="B"}
 prototypeSettingsField("categorySettingsScope").value="month";
 categorySettingsBackdrop.classList.add("open");
 categorySettingsBackdrop.setAttribute("aria-hidden","false");
 prototypeSettingsField(focusField==="actual"?"categorySettingsActual":focusField==="planned"?"categorySettingsPlanned":"categorySettingsName").focus();
}
function closeCategorySettings(){
 categorySettingsBackdrop.classList.remove("open");
 categorySettingsBackdrop.setAttribute("aria-hidden","true");
 categorySettingsTarget=null;
}
function prototypeReadAmount(id){
 const field=prototypeSettingsField(id);
 const value=field.value.trim();
 if(value===""||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>99999999){
  field.focus();
  field.setCustomValidity("Montant invalide");
  field.reportValidity();
  return null;
 }
 field.setCustomValidity("");
 return Math.round(Number(value)*100)/100;
}
categorySettingsForm.addEventListener("input",event=>{
 if(typeof event.target?.setCustomValidity==="function")event.target.setCustomValidity("");
});
categorySettingsForm.addEventListener("submit",event=>{
 event.preventDefault();
 if(!categorySettingsTarget)return;
 const {id,type}=categorySettingsTarget;
 const base=catById(id,type);
 if(!base)return;
 const current=categoryView(base,type);
 if(categorySettingsTarget.household!==activeHouseholdId||categorySettingsTarget.month!==state.selectedMonth||
    categorySettingsTarget.actual!==Number(totalsByCategory(type)[id]||0)||categorySettingsTarget.planned!==current.budget||
    categorySettingsTarget.name!==current.name||categorySettingsTarget.owner!==current.owner){
  closeCategorySettings();showUndoToast("Le budget a changé. Rouvre les paramètres.");return;
 }
 const name=prototypeSettingsField("categorySettingsName").value.trim();
 if(!name){prototypeSettingsField("categorySettingsName").focus();return}
 const planned=prototypeReadAmount("categorySettingsPlanned");
 const actual=prototypeReadAmount("categorySettingsActual");
 if(planned===null||actual===null)return;
 const owner=prototypeSettingsField("categorySettingsOwner").value;
 const scope=prototypeSettingsField("categorySettingsScope").value==="forward"?"forward":"month";
 if(name!==current.name)renameCategory(id,type,name);
 if(Math.abs(planned-Number(current.budget||0))>=.005||owner!==(current.owner||"common")){
  setCategoryPlan(id,type,planned,owner,scope);
 }
 if(Math.abs(actual-Number(totalsByCategory(type)[id]||0))>=.005){
  setCategoryActual(id,actual,type,"Ajustement depuis les paramètres");
 }
 saveState();closeCategorySettings();render();
});
// Existing real, planned and chart edits share this dialog; the original editor
// is retained for creating a category, without copying its legacy edit UI.
const originalCategoryEditorForCreate=openCategoryEditor;
openCategoryEditor=function(id=null,section=null,mode="planned",type="expense",origin="categories"){
 if(id&&(mode==="actual"||mode==="planned")){
  openCategorySettings(id,type,mode);return;
 }
 return originalCategoryEditorForCreate(id,section,mode,type,origin);
};
categorySettingsBackdrop.addEventListener("click",event=>{
 if(event.target===categorySettingsBackdrop)closeCategorySettings();
});
document.getElementById("categorySettingsClose").addEventListener("click",closeCategorySettings);
categoryGrid.addEventListener("click",event=>{
 const settings=event.target.closest("[data-demo-settings]");
 if(settings){
  openCategorySettings(settings.dataset.demoSettings,settings.dataset.categoryType||"expense");
  return;
 }
 const single=event.target.closest("[data-demo-fill-category]");
 if(single){
  prototypeFillOne(single.dataset.demoFillCategory,single.dataset.categoryType||"expense",single);
  return;
 }
 const fill=event.target.closest("[data-demo-fill-all]");
 if(fill){
  clearTimeout(clearArmTimer);
  prototypeBulkActual(fill.dataset.categoryType||"expense",fill.dataset.section||"","fill-empty");
  return;
 }
 const clear=event.target.closest("[data-demo-clear-all]");
 if(!clear)return;
 if(clear.dataset.demoArmed==="true"){
  clearTimeout(clearArmTimer);
  clear.dataset.demoArmed="false";
  prototypeBulkActual(clear.dataset.categoryType||"expense",clear.dataset.section||"","clear");
  return;
 }
 categoryGrid.querySelectorAll("[data-demo-clear-all]").forEach(button=>{
  button.dataset.demoArmed="false";
  button.querySelector("span").textContent="Tout vider";
  button.setAttribute("aria-label","Remettre tous les réels à zéro");
 });
 clear.dataset.demoArmed="true";
 clear.setAttribute("aria-label","Confirmer la remise à zéro des montants réels");
 clear.querySelector("span").textContent="Confirmer";
 clearArmTimer=setTimeout(()=>{
  if(!clear.isConnected)return;
  clear.dataset.demoArmed="false";
  clear.querySelector("span").textContent="Tout vider";
  clear.setAttribute("aria-label","Remettre tous les réels à zéro");
 },4500);
});

document.addEventListener("keydown",event=>{if(event.key==="Escape"&&categorySettingsTarget)closeCategorySettings()});
