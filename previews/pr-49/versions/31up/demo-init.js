/* Local-only bootstrap for the original Catégories controls.
 * Deliberately has no fetch(), storage, credentials or network adapter.
 */
"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const select=document.getElementById("demoMonth");
 const theme=document.getElementById("themeToggle");
 const root=document.documentElement;
 select.addEventListener("change",()=>{
  state.selectedMonth=select.value;
  closeCategoryEditor();
  closeCategoryDelete();
  closeCategorySettings();
  render();
 });
 theme.addEventListener("click",()=>{
  const isDark=root.dataset.demoTheme!=="dark";
  root.dataset.demoTheme=isDark?"dark":"light";
  theme.setAttribute("aria-label",isDark?"Passer en mode clair":"Passer en mode sombre");
  theme.title=isDark?"Passer en mode clair":"Passer en mode sombre";
  theme.innerHTML=isDark?
   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42"/><circle cx="12" cy="12" r="4"/></svg>':
   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z"/></svg>';
 });
 // Keep the original category dialogs, adding a test-only focus contract.
 const backdrops=[categoryEditBackdrop,categoryDeleteBackdrop,categorySettingsBackdrop,demoTransactionBackdrop];
 let lastTrigger=null;
 let lastTriggerData=null;
 document.addEventListener("click",event=>{
  const button=event.target.closest?.("#categoryGrid button,#categoryDistribution button,[data-demo-add]");
  if(!button)return;
  lastTrigger=button.closest("#mobileQuickAdd")?document.getElementById("mobileAddButton"):button;
  lastTriggerData={
   action:button.dataset.demoSettings?"settings":button.dataset.editActual?"editActual":button.dataset.editPlanned?"editPlanned":
    button.dataset.deleteCategory?"deleteCategory":button.dataset.addCategory?"addCategory":
    button.dataset.addSaving?"addSaving":null,
   id:button.dataset.demoSettings||button.dataset.editActual||button.dataset.editPlanned||button.dataset.deleteCategory||"",
   section:button.dataset.addCategory||"",
   type:button.dataset.categoryType||"expense"
  };
 },true);
 function returnFocus(){
  let target=lastTrigger?.isConnected?lastTrigger:null;
  const d=lastTriggerData;
  if(!target&&d?.action){
   const selectors={
    settings:'[data-demo-settings]',editActual:'[data-edit-actual]',editPlanned:'[data-edit-planned]',
    deleteCategory:'[data-delete-category]',addCategory:'[data-add-category]',addSaving:'[data-add-saving]'
   };
   const selector=selectors[d.action];
   target=[...document.querySelectorAll("#categoryGrid "+selector)].find(node=>
    (node.dataset.demoSettings||node.dataset.editActual||node.dataset.editPlanned||node.dataset.deleteCategory||"")===d.id&&
    (node.dataset.addCategory||"")===d.section&&
    (node.dataset.categoryType||"expense")===d.type)||null;
  }
  if(!target){target=document.getElementById("categoryGrid");target.setAttribute("tabindex","-1")}
  target.focus({preventScroll:true});
 }
 for(const backdrop of backdrops){
  let wasOpen=backdrop.classList.contains("open");
  new MutationObserver(()=>{
   const isOpen=backdrop.classList.contains("open");
   if(wasOpen&&!isOpen&&!backdrops.some(el=>el.classList.contains("open"))){
    requestAnimationFrame(returnFocus);
   }
   wasOpen=isOpen;
  }).observe(backdrop,{attributes:true,attributeFilter:["class"]});
 }
 document.addEventListener("keydown",event=>{
  const active=backdrops.find(el=>el.classList.contains("open"));
  if(!active)return;
  if(event.key==="Escape"){
   event.preventDefault();
   if(active===categoryEditBackdrop)closeCategoryEditor();
   else if(active===categorySettingsBackdrop)closeCategorySettings();
   else if(active===demoTransactionBackdrop)closeDemoTransactionModal();
   else closeCategoryDelete();
   return;
  }
  if(event.key!=="Tab")return;
  const controls=[...active.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].
   filter(el=>!el.closest("[hidden]")&&el.getClientRects().length>0);
  if(!controls.length){event.preventDefault();active.focus();return}
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){
   event.preventDefault();last.focus();
  }else if(!event.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){
   event.preventDefault();first.focus();
  }
 });
 root.dataset.demoTheme="dark";
 theme.setAttribute("aria-label","Passer en mode clair");
 render();
});
