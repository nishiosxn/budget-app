/* Pure transaction change planner; no storage, cloud calls or UI writes.
 * Must be called only after confirmation, with freshly hydrated data and validated identity.
 * Not connected to the live save path until sandbox integration tests pass.
 */
(function exposeAssistantPlanner(root){
 "use strict";
 const copy=v=>JSON.parse(JSON.stringify(v));
 const fail=error=>({ok:false,error});
 const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 function expandProposal(op,lastMonth){
  if(op.frequency!=="monthly")return [op];
  const start=op.date.slice(0,7),day=Number(op.date.slice(8,10));
  const [sy,sm]=start.split("-").map(Number),[ey,em]=lastMonth.split("-").map(Number);
  const count=(ey-sy)*12+em-sm+1;
  if(count<1||count>120)throw Error("Horizon de récurrence invalide.");
  return Array.from({length:count},(_,i)=>{
   const n=sy*12+sm-1+i,y=Math.floor(n/12),m=n%12+1;
   const end=new Date(Date.UTC(y,m,0)).getUTCDate();
   return {...op,date:String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(Math.min(day,end)).padStart(2,"0")};
  });
 }
 function requiredMonths(result,context){
  const validated=root.SmartBudgetAssistantCore?.validateResult(result,context);
  if(!validated?.ok||validated.value.kind!=="draft")return null;
  try{return [...new Set(validated.value.operations.filter(o=>o.kind!=="plan").flatMap(o=>expandProposal(o,context.lastMonth).map(x=>x.date.slice(0,7))))].sort()}catch{return null}
 }
 function prepareAssistantBatch({result,context,snapshot,existingOccurrences,approval,batchId}){
  const core=root.SmartBudgetAssistantCore;
  if(!core||approval!==true||!uuid(batchId))return fail("Confirmation obligatoire.");
  if(!snapshot||!Array.isArray(snapshot.transactions)||!Array.isArray(existingOccurrences))return fail("État du foyer incomplet.");
  const validated=core.validateResult(result,context);
  if(!validated.ok||validated.value.kind!=="draft")return fail(validated.error||"Brouillon invalide.");
  const ops=validated.value.operations;
  const ids=ops.map((_,i)=>"assistant-"+batchId+"-"+i);
  if(snapshot.transactions.some(t=>ids.includes(t.id)))return fail("Ce lot a déjà été préparé ou enregistré.");
  // The integration must supply actual occurrences for every month returned by requiredMonths.
  // Expand proposed series using the same month-end clamping as calculations.js.
  let proposed;try{proposed=ops.filter(o=>o.kind!=="plan").flatMap(o=>expandProposal(o,context.lastMonth))}catch{return fail("Horizon de récurrence invalide.")}
  if(core.findDuplicates(proposed,existingOccurrences).length)return fail("Doublon possible : vérifie le brouillon dans l’historique.");
  const seen=new Set();
  for(const o of proposed){const key=JSON.stringify([o.kind,o.categoryId,o.owner,o.amountCents,o.date]);if(seen.has(key))return fail("Deux opérations du brouillon se recouvrent.");seen.add(key);}
  const next={transactions:copy(snapshot.transactions),incomePlanChanges:copy(snapshot.incomePlanChanges||{}),expensePlanChanges:copy(snapshot.expensePlanChanges||{})};
  const changes=[];
  for(const [i,op] of ops.entries()){
   // Only trusted fields, never copy arbitrary model keys into state.
   const cat=context.categories.find(c=>c.id===op.categoryId);
   if(op.kind==="plan"){
    const store=cat.kind==="income"?next.incomePlanChanges:next.expensePlanChanges,month=op.date.slice(0,7),record=store[op.categoryId]||(store[op.categoryId]={forward:{},month:{}});
    record.forward=record.forward||{};record.month=record.month||{};
    const scope=op.frequency==="monthly"?"forward":"month";
    // Mirror setCategoryPlan; the later bridge must confirm against the current owner and previous amount.
    const before=record[scope][month]||null;
    record[scope][month]={budget:op.amountCents/100,owner:op.owner};
    if(scope==="forward")delete record.month[month];
    changes.push({kind:"plan",categoryId:op.categoryId,month,scope,before,after:record[scope][month]});
   }else{
    const id=ids[i],t={id,type:op.kind==="income"?"income":"expense",category:op.categoryId,owner:op.owner,amount:op.amountCents/100,date:op.date,label:op.label,seed:false};
    if(op.frequency==="monthly"){t.scope="forward";t.seriesId=id;t.excludedMonths=[];t.overrides={}}
    next.transactions.push(t);changes.push({kind:op.kind,id,date:op.date,frequency:op.frequency});
   }
  }
  return {ok:true,patch:next,changes};
 }
 root.SmartBudgetAssistantPlanner=Object.freeze({prepareBatch:prepareAssistantBatch,requiredMonths});
})(globalThis);
