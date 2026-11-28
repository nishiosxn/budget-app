/* Explicit pilot confirmation; insert-only, no inference, authenticated RLS. */
const uuid=v=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail=(status,error)=>({status,body:{error}});
const ok=(requestId,count)=>({status:200,body:{commit:{requestId,count}}});
export function canCommitTransactions(draft,context,validateReview){
 if(!context?.solo||context.actor!=="B")return null;
 const checked=validateReview(draft,context);
 if(!checked.ok||checked.value.operations.some(o=>!["expense","income"].includes(o.kind)||o.frequency!=="once"||o.categoryId===null||o.owner!=="B"))return null;
 return checked.value.operations;
}
async function hash(value){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
}
async function rowId(householdId,requestId,i){
 const h=(await hash("smart-assistant/v1/"+householdId+"/"+requestId+"/"+i)).slice(0,32);
 return h.slice(0,8)+"-"+h.slice(8,12)+"-5"+h.slice(13,16)+"-8"+h.slice(17,20)+"-"+h.slice(20);
}
function sameRow(r,w){
 return r&&r.id===w.id&&r.household_id===w.household_id&&r.category_id===w.category_id&&r.legacy_id===w.legacy_id&&r.owner_slot===w.owner_slot&&r.transaction_date===w.transaction_date&&r.label===w.label&&Math.round(Number(r.amount)*100)===Math.round(w.amount*100)&&r.archived_at==null&&r.metadata?.type===w.metadata.type&&r.metadata?.assistantRequestId===w.metadata.assistantRequestId&&r.metadata?.assistantBatchDigest===w.metadata.assistantBatchDigest;
}
export function createTransactionCommit({validateReview,readCategories,readRows,insertRows}){
 return async function commit({token,householdId,requestId,draft,context}){
  if(!uuid(householdId)||!uuid(requestId))return fail(400,"invalid_request");
  const operations=canCommitTransactions(draft,context,validateReview);
  if(!operations)return fail(422,"confirm_not_supported");
  try{
   const categories=await readCategories(token,householdId);
   if(!Array.isArray(categories)||categories.length>300)return fail(503,"confirm_unavailable");
   const mapped=[];
   for(const o of operations){
    const matches=categories.filter(c=>(c.legacy_id||c.id)===o.categoryId&&uuid(c.id)&&c.type===o.kind&&!c.is_saving);
    if(matches.length!==1)return fail(409,"confirm_category_changed");
    mapped.push({categoryId:matches[0].id,kind:o.kind,owner:o.owner,amountCents:o.amountCents,date:o.date,label:o.label});
   }
   const digest=await hash(JSON.stringify(mapped));
   const rows=await Promise.all(mapped.map(async (o,i)=>({
    id:await rowId(householdId,requestId,i),household_id:householdId,category_id:o.categoryId,
    legacy_id:"smart-assistant-"+requestId+"-"+i,owner_slot:"B",amount:o.amountCents/100,
    transaction_date:o.date,label:o.label,metadata:{type:o.kind,assistantRequestId:requestId,assistantBatchDigest:digest}
   })));
   // Query all possible slot IDs, including archived ones, so shortening a replay
   // cannot be accepted. Max 12 operations. Same request never adds a second lot.
   const ids=await Promise.all(Array.from({length:12},(_,i)=>rowId(householdId,requestId,i)));
   const verify=existing=>{
    if(!Array.isArray(existing))return "unavailable";
    if(!existing.length)return "absent";
    return existing.length===rows.length&&rows.every(w=>sameRow(existing.find(r=>r.id===w.id),w))?"same":"conflict";
   };
   const before=verify(await readRows(token,householdId,ids));
   if(before==="same")return ok(requestId,rows.length);
   if(before==="conflict")return fail(409,"confirm_conflict");
   if(before!=="absent")return fail(503,"confirm_unavailable");
   // One plain POST: PostgreSQL rolls back the entire insert on conflict.
   // A lost response is resolved by reading the exact registered batch.
   try{await insertRows(token,rows)}catch{}
   const after=verify(await readRows(token,householdId,ids));
   if(after==="same")return ok(requestId,rows.length);
   if(after==="conflict")return fail(409,"confirm_conflict");
   return fail(503,"confirm_unavailable");
  }catch{return fail(503,"confirm_unavailable")}
 };
}
