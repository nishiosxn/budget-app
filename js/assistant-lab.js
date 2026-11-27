// The optional laboratory does not need to download its engine on the budget landing page.
(()=>{
 const panel=document.querySelector(".assistant-local");
 if(!panel)return;
 const form=panel.querySelector("form"),status=panel.querySelector('[role="status"]');
 const suggestions=panel.querySelectorAll("[data-assistant-suggestion]");
 const initialStatus=status.textContent;
 const pendingScripts=new Map();
 let loading=false,ready=false;

 function loadScript(path){
  if(pendingScripts.has(path))return pendingScripts.get(path);
  const script=document.createElement("script");
  script.src=path;
  const promise=new Promise((resolve,reject)=>{
   script.onload=resolve;
   script.onerror=()=>{
    script.remove();
    pendingScripts.delete(path);
    reject(new Error("Assistant asset unavailable"));
   };
  });
  pendingScripts.set(path,promise);
  document.head.appendChild(script);
  return promise;
 }
 function lock(value){
  for(const item of [form,...suggestions])item.inert=value;
 }
 async function prepare(){
  if(!panel.open||loading||ready)return;
  loading=true;
  status.textContent="Chargement de l’assistant…";
  try{
   await Promise.all(["assistant-core","assistant-planner","assistant-voice"].map(name=>loadScript("js/"+name+".js?v=31at")));
   await loadScript("js/assistant-ui.js?v=31at");
   if(status.textContent==="Chargement de l’assistant…")status.textContent=initialStatus;
   ready=true;
   lock(false);
  }catch{
   status.textContent="Assistant indisponible. Referme puis rouvre le laboratoire pour réessayer.";
  }finally{loading=false}
 }
 lock(true);
 panel.addEventListener("toggle",prepare);
 prepare();
})();
