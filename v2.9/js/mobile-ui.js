/* V2.8 — Navigation mobile et menu de saisie rapide.
   Réutilise les onglets et les modales existantes : aucune logique financière dupliquée. */
(()=>{
  const fab=document.getElementById("mobileAddButton");
  const menu=document.getElementById("mobileQuickAdd");
  const panel=menu?.querySelector(".mobile-quick-add__panel");
  const items=[...document.querySelectorAll("[data-mobile-tab]")];
  if(!fab||!menu||!panel||!items.length)return;

  const isOpen=()=>menu.classList.contains("open");
  const syncActiveTab=()=>{
    const active=document.querySelector(".nav-row .tab.active")?.dataset.tab||"overview";
    items.forEach(button=>{
      const selected=button.dataset.mobileTab===active;
      button.classList.toggle("is-active",selected);
      if(selected)button.setAttribute("aria-current","page");
      else button.removeAttribute("aria-current");
    });
  };
  const closeQuickAdd=(restoreFocus=true)=>{
    if(!isOpen())return;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden","true");
    fab.setAttribute("aria-expanded","false");
    if(restoreFocus)fab.focus();
  };
  const openQuickAdd=()=>{
    menu.classList.add("open");
    menu.setAttribute("aria-hidden","false");
    fab.setAttribute("aria-expanded","true");
    panel.querySelector("[data-add]")?.focus();
  };

  fab.addEventListener("click",()=>isOpen()?closeQuickAdd():openQuickAdd());
  menu.querySelector(".mobile-quick-add__scrim")?.addEventListener("click",()=>closeQuickAdd());
  menu.querySelectorAll("[data-add]").forEach(button=>{
    button.addEventListener("click",()=>closeQuickAdd(false));
  });

  items.forEach(button=>button.addEventListener("click",()=>{
    closeQuickAdd(false);
    const desktopTab=document.querySelector('.nav-row .tab[data-tab="'+button.dataset.mobileTab+'"]');
    desktopTab?.click();
    syncActiveTab();
    window.scrollTo({top:0,behavior:"auto"});
  }));
  document.querySelectorAll(".nav-row .tab").forEach(tab=>tab.addEventListener("click",syncActiveTab));
  document.addEventListener("keydown",event=>{
    if(!isOpen())return;
    if(event.key==="Escape"){event.preventDefault();closeQuickAdd();return}
    if(event.key!=="Tab")return;
    const actions=[...panel.querySelectorAll("[data-add]")];
    if(!actions.length)return;
    if(event.shiftKey&&document.activeElement===actions[0]){event.preventDefault();actions[actions.length-1].focus()}
    else if(!event.shiftKey&&document.activeElement===actions[actions.length-1]){event.preventDefault();actions[0].focus()}
  });
  window.matchMedia("(min-width: 56.251rem)").addEventListener("change",event=>{
    if(event.matches)closeQuickAdd(false);
  });
  syncActiveTab();
})();