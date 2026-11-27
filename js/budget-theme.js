(()=>{
 const picker=document.getElementById("budgetTheme");
 const system=matchMedia("(prefers-color-scheme: dark)");
 const key="smart-budget:assistant-theme";
 function apply(){
  let choice="system";
  try{const saved=localStorage.getItem(key);if(["dark","light"].includes(saved))choice=saved}catch{}
  if(picker)picker.value=choice;
  const theme=choice==="system"?(system.matches?"dark":"light"):choice;
  document.documentElement.dataset.budgetTheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#141414":"#f4f5f1");
 }
 picker?.addEventListener("change",()=>{try{localStorage.setItem(key,picker.value)}catch{}apply()});
 window.addEventListener("storage",e=>{if(e.key===key)apply()});
 system.addEventListener("change",apply);
 apply();
})();
