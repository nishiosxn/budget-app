(function exposeAssistantConfirmation(root){
 "use strict";
 const validId=value=>typeof value==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
 function createAssistantConfirmation({identity,storage,send}){
  const prefix="smart-budget:assistant-confirmation:"+identity.userId+":"+identity.householdId+":";
  const key=id=>prefix+id;
  const forget=id=>{try{storage.removeItem(key(id))}catch{}};
  function pending(){
   try{
    return Array.from({length:storage.length},(_,i)=>storage.key(i))
     .filter(k=>typeof k==="string"&&k.startsWith(prefix)&&validId(k.slice(prefix.length)))
     .map(k=>k.slice(prefix.length)).sort();
   }catch{return []}
  }
  async function check(action,id,review){
   const result=await send({action:action+"_atomic",householdId:identity.householdId,requestId:id,...(review||{})});
   if(!result.ok){
    const error=result.body?.error;
    const terminal=error==="confirm_stale"||action==="prepare"&&(result.status===400||result.status===422||error==="confirm_category_changed");
    if(terminal){forget(id);return {...result,outcome:"rejected"}}
    throw Error("Résultat de confirmation indisponible.");
   }
   const data=result.body;
   if(data?.confirmation==="complete"){
    const receipt=data.commit;
    if(receipt?.kind!=="batch"||receipt.requestId!==id||!Number.isInteger(receipt.count)||receipt.count<1||receipt.count>12||
       !Number.isInteger(receipt.categoriesCreated)||receipt.categoriesCreated<0||receipt.categoriesCreated>receipt.count)
     throw Error("Reçu invalide.");
    return {...result,outcome:"complete"};
   }
   if(data?.requestId!==id||!["prepared","expired","missing"].includes(data.confirmation))
    throw Error("Résultat de confirmation invalide.");
   return {...result,outcome:data.confirmation};
  }
  function settle(id,result,expected){
   if(result.outcome==="complete"){
    const receipt=result.body.commit;
    if(expected&&(receipt.count!==expected.count||receipt.categoriesCreated!==expected.categoriesCreated))
     throw Error("Le reçu ne correspond pas au lot.");
    forget(id);
   }else if(["expired","missing"].includes(result.outcome))forget(id);
   return result;
  }
  const running=new Map();
  function run(id,job){
   if(!validId(id))throw Error("Identifiant de confirmation invalide.");
   if(!running.has(id))running.set(id,job().finally(()=>running.delete(id)));
   return running.get(id);
  }
  return {
   pending,
   submit:(id,review,expected)=>run(id,async()=>{
    let state;
    if(storage.getItem(key(id))!==null)state=await check("status",id);
    else storage.setItem(key(id),"1");
    if(!state||state.outcome==="missing")state=await check("prepare",id,review);
    if(state.outcome==="prepared")state=await check("commit",id);
    return settle(id,state,expected);
   }),
   recover:(id,resume=false)=>run(id,async()=>{
    let state=await check("status",id);
    if(resume&&state.outcome==="prepared")state=await check("commit",id);
    return settle(id,state);
   })
  };
 }
 root.createSmartBudgetAssistantConfirmation=createAssistantConfirmation;
})(globalThis);
