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
  render();
 });
 theme.addEventListener("click",()=>{
  const isDark=root.dataset.demoTheme!=="dark";
  root.dataset.demoTheme=isDark?"dark":"light";
  theme.textContent=isDark?"Mode clair":"Mode sombre";
  theme.setAttribute("aria-label",isDark?"Passer en mode clair":"Passer en mode sombre");
 });
 document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if(categoryEditBackdrop.classList.contains("open")){
   closeCategoryEditor();event.preventDefault();return;
  }
  if(categoryDeleteBackdrop.classList.contains("open")){
   closeCategoryDelete();event.preventDefault();return;
  }
 });
 root.dataset.demoTheme="dark";
 theme.setAttribute("aria-label","Passer en mode clair");
 render();
});
