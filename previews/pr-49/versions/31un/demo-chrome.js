/* Smart Budget PR49 — isolated navigation + transaction form preview.
 * This file NEVER calls fetch, storage, Supabase or any account API.
 * All entries are fictitious and live only in demo-state's current memory.
 */
"use strict";
const demoTransactionBackdrop=document.getElementById("modalBackdrop");
const demoTransactionForm=document.getElementById("demoTransactionForm");
const demoQuickAdd=document.getElementById("mobileQuickAdd");
let demoTransactionType="expense";
let demoOwner="common";
let demoScope="month";
const demoMonths=Object.entries(MONTHS);
const demoSelect=document.getElementById("demoMonth");

function demoUpdateMonths(){
 const index=demoSelect.selectedIndex;
 document.getElementById("prevMonth").disabled=index<=0;
 document.getElementById("nextMonth").disabled=index>=demoSelect.options.length-1;
}
function demoChangeMonth(delta){
 const next=demoSelect.selectedIndex+delta;
 if(next<0||next>=demoSelect.options.length)return;
 demoSelect.selectedIndex=next;
 demoSelect.dispatchEvent(new Event("change",{bubbles:true}));
}
function demoToggleQuickAdd(force){
 const button=document.getElementById("mobileAddButton");
 const open=typeof force==="boolean"?force:!demoQuickAdd.classList.contains("open");
 demoQuickAdd.classList.toggle("open",open);
 demoQuickAdd.setAttribute("aria-hidden",open?"false":"true");
 button.setAttribute("aria-expanded",String(open));
 if(open)demoQuickAdd.querySelector("[data-demo-add]")?.focus();
}
function demoTransactionCategories(type){
 if(type==="income")return visibleIncomeCategories().map(c=>({...c,group:"Revenus"}));
 return [...visibleExpenseCategories().map(c=>({...c,group:categorySectionOf(c)})),
  ...visibleSavingCategories().map(c=>({...c,group:"Épargne"}))];
}
function demoFillCategoryOptions(type){
 const select=document.getElementById("categorySelect");
 select.replaceChildren();
 const categories=demoTransactionCategories(type);
 const sections=type==="income"?["Revenus"]:["Obligatoires","Abonnements","Vie courante","Autres","Épargne"];
 for(const group of sections){
  const listed=categories.filter(c=>c.group===group);
  if(!listed.length)continue;
  const optgroup=document.createElement("optgroup");
  optgroup.label=group;
  for(const c of listed){
   const option=document.createElement("option");
   option.value=c.id;option.textContent=c.name;
   optgroup.appendChild(option);
  }
  select.appendChild(optgroup);
 }
 select.disabled=!categories.length;
}
function demoDateWithinSelectedMonth(){
 const yearMonth=monthKey(state.selectedMonth);
 const day=Math.min(22,new Date(Number(yearMonth.slice(0,4)),Number(yearMonth.slice(5,7)),0).getDate());
 return yearMonth+"-"+String(day).padStart(2,"0");
}
function demoUpdateDateLimits(){
 const date=document.getElementById("transactionDateInput"),month=monthKey(state.selectedMonth);
 const lastDay=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
 date.min=month+"-01";
 date.max=month+"-"+String(lastDay).padStart(2,"0");
 date.value=demoDateWithinSelectedMonth();
}
function demoSetOwner(owner){
 demoOwner=["common","B","A"].includes(owner)?owner:"common";
 demoTransactionBackdrop.querySelectorAll("[data-owner]").forEach(b=>{
  const on=b.dataset.owner===demoOwner;
  b.classList.toggle("active",on);
  b.setAttribute("aria-pressed",String(on));
 });
}
function demoSetScope(scope){
 demoScope=scope==="forward"?"forward":"month";
 demoTransactionBackdrop.querySelectorAll("[data-transaction-scope]").forEach(b=>{
  const on=b.dataset.transactionScope===demoScope;
  b.classList.toggle("active",on);
  b.setAttribute("aria-pressed",String(on));
 });
 document.getElementById("transactionScopeHint").textContent=demoScope==="forward"?
  "Une opération fictive par mois, à partir du mois affiché (dans les mois disponibles).":
  "Cette opération sera comptée uniquement sur le mois affiché.";
}
function openDemoTransactionModal(type){
 demoTransactionType=type==="income"?"income":"expense";
 const income=demoTransactionType==="income";
 demoToggleQuickAdd(false);
 document.getElementById("modalTitle").textContent=income?"Ajouter une rentrée d'argent":"Ajouter une dépense";
 document.getElementById("modalKind").textContent=income?"Revenu":"Dépense";
 document.getElementById("ownerSwitchLabel").textContent=income?"QUI A REÇU ?":"QUI A PAYÉ ?";
 const submit=document.getElementById("saveTransaction");
 submit.textContent=income?"Ajouter le revenu":"Ajouter la dépense";
 submit.classList.toggle("btn-income",income);
 submit.classList.toggle("btn-expense",!income);
 demoTransactionForm.reset();
 demoFillCategoryOptions(demoTransactionType);
 demoUpdateDateLimits();
 demoSetOwner("common");
 demoSetScope("month");
 const amount=document.getElementById("amountInput");
 amount.value="";
 amount.setCustomValidity("");
 demoTransactionBackdrop.classList.add("open");
 demoTransactionBackdrop.setAttribute("aria-hidden","false");
 amount.focus({preventScroll:true});
}
function closeDemoTransactionModal(){
 demoTransactionBackdrop.classList.remove("open");
 demoTransactionBackdrop.setAttribute("aria-hidden","true");
}
function demoMonthDates(baseDate,scope){
 if(scope==="month")return [baseDate];
 const start=baseDate.slice(0,7),day=Number(baseDate.slice(8,10));
 return demoMonths.map(([,value])=>value).filter(month=>month>=start).map(month=>{
  const last=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  return month+"-"+String(Math.min(day,last)).padStart(2,"0");
 });
}
function demoSaveTransaction(event){
 event.preventDefault();
 const amountInput=document.getElementById("amountInput");
 const raw=Number(amountInput.value);
 if(!Number.isFinite(raw)||raw<=0||raw>99999999){
  amountInput.setCustomValidity("Indiquez un montant positif");
  amountInput.reportValidity();
  amountInput.focus();
  return;
 }
 amountInput.setCustomValidity("");
 const category=document.getElementById("categorySelect").value;
 const current=demoTransactionCategories(demoTransactionType).find(c=>c.id===category);
 if(!current){document.getElementById("categorySelect").focus();return}
 const dateInput=document.getElementById("transactionDateInput"),date=dateInput.value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.slice(0,7)!==monthKey(state.selectedMonth)||
    date<dateInput.min||date>dateInput.max){
  dateInput.setCustomValidity("Choisissez une date du mois affiché");
  dateInput.reportValidity();dateInput.focus();return;
 }
 dateInput.setCustomValidity("");
 const label=document.getElementById("transactionLabel").value.trim()||current.name;
 const amount=Math.round(raw*100)/100,recurrenceId=demoScope==="forward"?uid():null;
 const dates=demoMonthDates(date,demoScope);
 const created=dates.map(at=>{
  const tx=record(demoTransactionType,category,amount,demoOwner,at,label);
  if(recurrenceId){tx.recurrenceId=recurrenceId;tx.recurrent=true}
  state.transactions.push(tx);
  return tx.id;
 });
 saveState();
 closeDemoTransactionModal();
 render();
 showUndoToast(created.length>1?"Opération fictive ajoutée sur "+created.length+" mois":"Opération fictive ajoutée",()=>{
  const ids=new Set(created);
  state.transactions=state.transactions.filter(t=>!ids.has(t.id));
  saveState();render();
 });
}
document.addEventListener("DOMContentLoaded",()=>{
 document.getElementById("prevMonth").addEventListener("click",()=>demoChangeMonth(-1));
 document.getElementById("nextMonth").addEventListener("click",()=>demoChangeMonth(1));
 demoSelect.addEventListener("change",()=>{
  closeDemoTransactionModal();
  demoToggleQuickAdd(false);
  demoUpdateMonths();
 });
 demoUpdateMonths();
 document.getElementById("settingsBtn").addEventListener("click",()=>{
  showUndoToast("Paramètres : aperçu visuel uniquement");
 });
 const mobileAdd=document.getElementById("mobileAddButton");
 mobileAdd.addEventListener("click",()=>demoToggleQuickAdd());
 demoQuickAdd.querySelector(".mobile-quick-add__scrim").addEventListener("click",()=>demoToggleQuickAdd(false));
 document.addEventListener("click",event=>{
  const btn=event.target.closest?.("[data-demo-add]");
  if(btn)openDemoTransactionModal(btn.dataset.demoAdd);
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&demoQuickAdd.classList.contains("open")){
   demoToggleQuickAdd(false);mobileAdd.focus();
  }
 });
 document.getElementById("closeModal").addEventListener("click",closeDemoTransactionModal);
 demoTransactionBackdrop.addEventListener("click",event=>{
  if(event.target===demoTransactionBackdrop)closeDemoTransactionModal();
 });
 demoTransactionBackdrop.addEventListener("click",event=>{
  const owner=event.target.closest("[data-owner]");
  if(owner)demoSetOwner(owner.dataset.owner);
  const scope=event.target.closest("[data-transaction-scope]");
  if(scope)demoSetScope(scope.dataset.transactionScope);
 });
 document.getElementById("amountInput").addEventListener("input",event=>event.target.setCustomValidity(""));
 document.getElementById("transactionDateInput").addEventListener("input",event=>event.target.setCustomValidity(""));
 for(const [id,dir] of [["amountUp",1],["amountDown",-1]]){
  document.getElementById(id).addEventListener("click",()=>{
   const amount=document.getElementById("amountInput");
   const old=Number(amount.value)||0;
   amount.value=(Math.max(.01,Math.round((old+dir)*100)/100)).toFixed(2);
   amount.setCustomValidity("");
  });
 }
 demoTransactionForm.addEventListener("submit",demoSaveTransaction);
});
