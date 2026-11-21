/* Appearance preference is isolated to the assistant; no financial state. */
(()=>{
 "use strict";
 const select=document.getElementById("pilotTheme"),media=window.matchMedia("(prefers-color-scheme: dark)"),key="smart-budget:assistant-theme";
 let choice="system";
 try{const saved=localStorage.getItem(key);if(["system","light","dark"].includes(saved))choice=saved}catch{}
 function apply(){document.documentElement.dataset.assistantTheme=choice==="system"?(media.matches?"dark":"light"):choice;select.value=choice}
 select.addEventListener("change",()=>{choice=select.value;apply();try{localStorage.setItem(key,choice)}catch{}});
 if(media.addEventListener)media.addEventListener("change",apply);else media.addListener(apply);
 apply();
})();
