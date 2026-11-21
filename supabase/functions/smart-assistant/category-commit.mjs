/* 31ai: explicit, user-confirmed category + forward budget + optional initial expense. No inferred writes.
   Only the allowlisted, authenticated, one-user pilot household is authorized
   upstream. The service-only PostgreSQL RPC commits both records atomically. */
const uuid=value=>typeof value==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fail=(status,error)=>({status,body:{error}});
export function createCategoryCommit({validateCategoryDraft,recognizeCreation,writeCategory}){
 return async function commitCategory({token,householdId,userId,requestId,command,draft,context}){
  if(!uuid(householdId)||!uuid(userId)||!uuid(requestId)||typeof command!=="string"||!command.trim()||command.length>1600)
   return fail(400,"invalid_request");
  if(!context?.solo||context.actor!=="B"||!Array.isArray(context.categories))
   return fail(403,"household_not_authorized");
  // The server reinterprets the *original command*; a transaction or an
  // implicit "new category" suggestion is categorically not a create request.
  // Re-parse the authenticated original command without household categories.
  // Otherwise a successful first write appears as a duplicate on retry and
  // prevents the database from matching the same requestId after a lost reply.
  // The atomic RPC remains authoritative for current-household duplicates.
  const parseContext={...context,categories:[]};
  const recognized=recognizeCreation(command,parseContext);
  if(!recognized?.ok||recognized.value.kind!=="categoryDraft")
   return fail(422,"confirm_creation_not_requested");
  const checked=validateCategoryDraft(draft,parseContext);
  if(!checked.ok)return fail(409,checked.error?.includes("existe déjà")?"confirm_category_exists":"confirm_category_invalid");
  const value=checked.value;
  if(value.owner!=="B"||value.budgetCents===null||!Number.isSafeInteger(value.budgetCents)||
     (value.expenseCents!==null&&(!Number.isSafeInteger(value.expenseCents)||value.expenseCents<=0||value.date>context.today||value.date.slice(0,7)!==value.month)))
   return fail(422,"confirm_category_not_supported");
  try{
   const r=await writeCategory({token,householdId,userId,requestId,
    name:value.name,month:value.month+"-01",budgetCents:value.budgetCents,
    expenseCents:value.expenseCents,expenseDate:value.expenseCents===null?null:value.date});
   const state=r?.status;
   if(state==="duplicate")return fail(409,"confirm_category_exists");
   if(state==="conflict")return fail(409,"confirm_conflict");
   if(state==="limit")return fail(409,"confirm_category_limit");
   if(state==="invalid")return fail(422,"confirm_category_invalid");
   if(state==="forbidden")return fail(403,"household_not_authorized");
   if(!["created","same"].includes(state)||!uuid(r.categoryId)||r.name!==value.name||
      r.expenseCreated!==(value.expenseCents!==null))
    return fail(503,"confirm_unavailable");
   return {status:200,body:{commit:{kind:"category",requestId,categoryId:r.categoryId,name:r.name,
    created:state==="created",expenseCreated:r.expenseCreated,month:value.month,budgetCents:value.budgetCents}}};
  }catch{return fail(503,"confirm_unavailable")}
 };
}
