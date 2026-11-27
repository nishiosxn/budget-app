/* One revision per household. An edit never replaces another device's snapshot. */
(()=>{
 function createSharedRules(current,transport){
  let revision=null,scope=null,sequence=0;
  function reset(){scope=null;revision=null;sequence++}
  function accept(snapshot,identity,ticket){
   if(ticket!==sequence||current()!==identity)return null;
   if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||!snapshot.rules||typeof snapshot.rules!=="object"||Array.isArray(snapshot.rules))throw Error("Réponse de synchronisation invalide.");
   scope=identity;revision=snapshot.revision;
   return Object.assign(Object.create(null),snapshot.rules);
  }
  async function load(){
   const identity=current(),ticket=++sequence;
   if(!identity)return null;
   const res=await transport("/rest/v1/smart_assistant_household_rules?select=revision,rules&household_id=eq."+encodeURIComponent(identity.householdId),{method:"GET"});
   if(!res.ok||!Array.isArray(res.body)||res.body.length>1)throw Error("Règles partagées indisponibles.");
   return accept(res.body[0]||{revision:0,rules:{}},identity,ticket);
  }
  async function edit(operation,term=null,target=null){
   const identity=current(),ticket=++sequence;
   if(!identity||scope!==identity||revision===null)throw Error("Recharge les règles du foyer avant de les modifier.");
   const res=await transport("/rest/v1/rpc/edit_smart_assistant_rule",{method:"POST",body:JSON.stringify({p_household_id:identity.householdId,p_revision:revision,p_operation:operation,p_term:term,p_target:target})});
   if(!res.ok||!["ok","conflict"].includes(res.body?.status))throw Error("Modification non vérifiée. Recharge les règles pour vérifier leur état.");
   return {rules:accept(res.body,identity,ticket),conflict:res.body.status==="conflict"};
  }
  return {load,edit,reset};
 }
 globalThis.createSmartBudgetSharedRules=createSharedRules;
})();
