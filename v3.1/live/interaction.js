/* An explicit, keyboard-accessible discard choice. No draft data is persisted. */
(()=>{
 "use strict";
 const dialog=document.getElementById("pilotDiscardDialog"),message=document.getElementById("pilotDiscardMessage");
 let pending=false;
 function confirmDiscard(text){
  if(pending)return Promise.resolve(false);
  pending=true;message.textContent=text;dialog.returnValue="keep";
  return new Promise(resolve=>{
   dialog.addEventListener("close",()=>{pending=false;resolve(dialog.returnValue==="discard")},{once:true});
   dialog.showModal();
  });
 }
 globalThis.SmartBudgetAssistantInteraction=Object.freeze({confirmDiscard});
})();
