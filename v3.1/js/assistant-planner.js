/* Pure transaction change planner; no storage, cloud calls or UI writes.
 * Must be called only after confirmation, with freshly hydrated data and validated identity.
 * Not connected to the live save path until sandbox integration tests pass.
 */
(function exposeAssistantPlanner(root){
 "use strict";
 const copy=v=>JSON.parse(JSON.stringify(v));
 const fail=error=>({ok:false,error});
 const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 function prepareAssistantBatch({result,context,snapshot,existingOccurrences,approval,batchId}){
  const core=root.SmartBudgetAssistantCore;
  if(!core||approval!==true||!uuid(batchId))return fail("Confirmation obligatoire.");
  if(!snapshot||!Array.isArray(snapshot.transactions)||!Array.isArray(existingOccurrences))return fail("État du foyer incomplet.");
  const validated=core.validateResult(result,context);
  if(!validated.ok||validated.value.kind!=="draft")return fail(validated.error||"Brouillon invalide.");
  const ops=validated.value.operations;
  const ids=ops.map((_,i)=>"assistant-"+batchId+"-"+i);
  if(snapshot.transactions.some(t=>ids.includes(t.id)))return fail("Ce lot a déjà été préparé ou enregistré.");
  // existingOccurrences must include recurrence expansions for every target month.
  // Hidden, deleted, stale or ambiguous categories are rejected before this stage.
  if(core.findDuplicates(ops,existingOccurrences).length)return fail("Doublon possible : vérifie le brouillon dans l’historique.");
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
 root.SmartBudgetAssistantPlanner=Object.freeze({prepareBatch:prepareAssistantBatch});
})(globalThis);
