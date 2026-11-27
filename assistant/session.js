/* Same SDK and storage key as the application. Tokens stay in memory here. */
(()=>{
 let initial=null;
 async function current(){
  const householdId=localStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
  if(!cloudClient||!householdId)throw Error("Ouvre Smart Assistant depuis un foyer connecté.");
  const {data,error}=await cloudClient.auth.getSession();
  const auth=data?.session;
  if(error||!auth?.user?.id||!auth.access_token)throw Error("Connecte-toi dans Smart Budget pour continuer.");
  if(householdId!==localStorage.getItem(ACTIVE_HOUSEHOLD_KEY))throw Error("Le foyer actif a changé.");
  const active={householdId,userId:auth.user.id,token:auth.access_token};
  initial??={householdId,userId:active.userId};
  if(initial.householdId!==householdId||initial.userId!==active.userId)throw Error("La session a changé. Reviens dans Smart Budget.");
  return active;
 }
 function onChange(invalidate){
  cloudClient?.auth.onAuthStateChange((event,auth)=>{
   if(event==="SIGNED_OUT"||(initial&&auth&&auth.user.id!==initial.userId))invalidate();
  });
  window.addEventListener("storage",e=>{if(e.key===ACTIVE_HOUSEHOLD_KEY||e.key===null)invalidate()});
  window.addEventListener("pageshow",e=>{if(e.persisted&&initial)current().catch(invalidate)});
 }
 function context(){
  const selectedMonth=new URLSearchParams(location.search).get("month");
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)?{selectedMonth}:{};
 }
 globalThis.SmartBudgetAssistantSession=Object.freeze({current,onChange,context});
})();
