/* PR49 offline interactions — built around the existing Smart Budget category API.
 * No backend, persistence or authenticated household access.
 */
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
function prototypeBulkActual(type,section,operation){
 const categories=prototypeSectionCategories(type,section);
 const previous=categoryTransactionSnapshot();
 const totals=totalsByCategory(type);
 const group=type==="income"?"Revenus":section==="__savings__"?"Épargne":section;
 const groupId="bulk-"+uid();
 let updated=0;
 for(const c of categories){
  const actual=Number(totals[c.id]||0),planned=Number(c.budget||0);
  if(operation==="fill"&&planned<=.005)continue;
  const target=operation==="fill"?planned:0;
  if(Math.abs(target-actual)<.005)continue;
  const label=operation==="fill"?"Réel aligné au prévu":"Remise à zéro";
  if(setCategoryActual(c.id,target,type,label,{bulkGroupId:groupId,bulkLabel:group+" · "+label}))updated++;
 }
 if(!updated){
  showUndoToast(operation==="fill"?"Montants déjà renseignés":"Montants déjà à zéro");
  return 0;
 }
 saveState();render();
 showUndoToast(updated+" montant"+(updated>1?"s":"")+" "+(operation==="fill"?"aligné"+(updated>1?"s":"")+" au prévu":"remis à zéro"),()=>restoreCategoryTransactions(previous));
 return updated;
}
function prototypeSettingsField(id){return document.getElementById(id)}
function openCategorySettings(id,type="expense"){
 const base=catById(id,type);
 if(!base)return;
 const c=categoryView(base,type);
 const actual=Number(totalsByCategory(type)[id]||0);
 categorySettingsTarget={id,type};
 prototypeSettingsField("categorySettingsTitle").textContent=c.name;
 prototypeSettingsField("categorySettingsName").value=c.name;
 prototypeSettingsField("categorySettingsActual").value=actual.toFixed(2);
 prototypeSettingsField("categorySettingsPlanned").value=Number(c.budget||0).toFixed(2);
 prototypeSettingsField("categorySettingsOwner").value=c.owner||"common";
 const groupField=prototypeSettingsField("categorySettingsSectionField");
 const section=prototypeSettingsField("categorySettingsSection");
 groupField.hidden=type==="income"||!!base.saving;
 section.value=categorySectionOf(base);
 prototypeSettingsField("categorySettingsScope").value="month";
 categorySettingsBackdrop.classList.add("open");
 categorySettingsBackdrop.setAttribute("aria-hidden","false");
 prototypeSettingsField("categorySettingsName").focus();
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
 if(event.target instanceof HTMLInputElement)event.target.setCustomValidity("");
});
categorySettingsForm.addEventListener("submit",event=>{
 event.preventDefault();
 if(!categorySettingsTarget)return;
 const {id,type}=categorySettingsTarget;
 const base=catById(id,type);
 if(!base)return;
 const current=categoryView(base,type);
 const name=prototypeSettingsField("categorySettingsName").value.trim();
 if(!name){prototypeSettingsField("categorySettingsName").focus();return}
 const planned=prototypeReadAmount("categorySettingsPlanned");
 const actual=prototypeReadAmount("categorySettingsActual");
 if(planned===null||actual===null)return;
 const owner=prototypeSettingsField("categorySettingsOwner").value;
 const scope=prototypeSettingsField("categorySettingsScope").value==="forward"?"forward":"month";
 const newSection=prototypeSettingsField("categorySettingsSection").value;
 if(name!==current.name)renameCategory(id,type,name);
 if(Math.abs(planned-Number(current.budget||0))>=.005||owner!==(current.owner||"common")){
  setCategoryPlan(id,type,planned,owner,scope);
 }
 if(type==="expense"&&!base.saving&&newSection!==categorySectionOf(base)){
  base.section=newSection;
  const custom=state.customExpenseCategories.find(c=>c.id===id);
  if(custom)custom.section=newSection;
 }
 if(Math.abs(actual-Number(totalsByCategory(type)[id]||0))>=.005){
  setCategoryActual(id,actual,type,"Ajustement depuis les paramètres");
 }
 saveState();closeCategorySettings();render();
});
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
 const fill=event.target.closest("[data-demo-fill-all]");
 if(fill){
  clearTimeout(clearArmTimer);
  prototypeBulkActual(fill.dataset.categoryType||"expense",fill.dataset.section||"","fill");
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
 });
 clear.dataset.demoArmed="true";
 clear.querySelector("span").textContent="Confirmer";
 clearArmTimer=setTimeout(()=>{
  if(!clear.isConnected)return;
  clear.dataset.demoArmed="false";
  clear.querySelector("span").textContent="Tout vider";
 },4500);
});
