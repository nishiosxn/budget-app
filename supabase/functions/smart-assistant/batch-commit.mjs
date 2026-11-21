/* 31aj: a single reviewed, authenticated, replay-safe batch of budget edits,
   optionally with regular transactions or explicitly created categories.
   The service-role SQL function, not the browser, is the final authority. */
const uuid=s=>typeof s==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const failure=(status,error)=>({status,body:{error}});
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
export function createBatchCommit({validateReview,validateMixedDraft,recognize,readCategories,writeBatch}){
 return async function commitBatch({token,householdId,userId,requestId,command,draft,expectedPlans,context}){
  if(!uuid(householdId)||!uuid(userId)||!uuid(requestId)||typeof command!=="string"||!command.trim()||command.length>1600
     ||!Array.isArray(expectedPlans)||expectedPlans.length>12)
   return failure(400,"invalid_request");
  if(!context?.solo||context.actor!=="B"||!Array.isArray(context.categories))
   return failure(403,"household_not_authorized");
  const mixed=draft?.kind==="mixedDraft";
  const checked=mixed?validateMixedDraft(draft,context):validateReview(draft,context);
  if(!checked?.ok)return failure(422,"confirm_not_supported");
  const v=checked.value,ops=v.operations,categories=mixed?v.categories:[];
  if(!Array.isArray(ops)||!ops.length||ops.length+categories.length>12
    ||!ops.some(o=>o.kind==="plan")&&!categories.length)
   return failure(422,"confirm_not_supported");
  if(mixed){
   const original=recognize(command,context);
   if(original?.ok!==true||original.value.kind!=="mixedDraft"
      ||original.value.categories.length!==categories.length)
    return failure(422,"confirm_creation_not_requested");
  }
  // Reject plan proposals for an unrelated command. Editing an existing review
  // is permitted, but submitting a pure expense as a budget action is not.
  if(!/budget|prévu|prevu/i.test(command))return failure(422,"confirm_not_supported");
  const expectations=new Map();
  for(const item of expectedPlans){
   if(!item||Object.keys(item).sort().join(",")!=="beforeCents,index"||!Number.isInteger(item.index)
      ||item.index<0||item.index>=ops.length||!cents(item.beforeCents)||expectations.has(item.index))
    return failure(400,"invalid_request");
   expectations.set(item.index,item.beforeCents);
  }
  if(expectations.size!==ops.filter(o=>o.kind==="plan").length)
   return failure(422,"confirm_budget_baseline_required");
  for(const [i,op] of ops.entries()){
   if(op.kind==="plan"?!expectations.has(i):expectations.has(i))
    return failure(422,"confirm_budget_baseline_required");
  }
  try{
   const rows=await readCategories(token,householdId);
   if(!Array.isArray(rows)||rows.length>300)return failure(503,"confirm_unavailable");
   const actions=[],planCategories=new Set();
   for(const [i,op] of ops.entries()){
    if(!["plan","expense","income"].includes(op.kind)||op.owner!=="B"||op.categoryId===null
       ||!cents(op.amountCents)||(op.kind!=="plan"&&op.amountCents===0))
     return failure(422,"confirm_not_supported");
    const candidates=rows.filter(r=>(r.legacy_id||r.id)===op.categoryId
      &&uuid(r.id)&&!r.is_saving&&r.owner_slot==="B"&&r.type===(op.kind==="plan"?r.type:op.kind));
    if(candidates.length!==1)return failure(409,"confirm_category_changed");
    const row=candidates[0];
    if(op.kind==="plan"){
     if(!["expense","income"].includes(row.type)||!["set","increase","decrease"].includes(op.planMode)
        ||!["once","monthly"].includes(op.frequency)||op.date.slice(8)!=="01"
        ||planCategories.has(row.id))
      return failure(422,"confirm_not_supported");
     planCategories.add(row.id);
     actions.push({kind:"plan",categoryId:row.id,month:op.date.slice(0,7),frequency:op.frequency,
       planMode:op.planMode,amountCents:op.amountCents,beforeCents:expectations.get(i)});
    }else{
     if(op.frequency!=="once"||!op.date||op.date>context.today||typeof op.label!=="string"||!op.label.trim())
      return failure(422,"confirm_not_supported");
     actions.push({kind:op.kind,categoryId:row.id,amountCents:op.amountCents,date:op.date,label:op.label});
    }
   }
   for(const cat of categories){
    if(cat.owner!=="B"||cat.budgetCents===null||!cents(cat.budgetCents)
       ||cat.expenseCents!==null&&(!cents(cat.expenseCents)||cat.expenseCents===0||cat.date>context.today))
     return failure(422,"confirm_category_not_supported");
    actions.push({kind:"create_category",name:cat.name,month:cat.month,
      budgetCents:cat.budgetCents,expenseCents:cat.expenseCents,
      expenseDate:cat.expenseCents===null?null:cat.date});
   }
   const result=await writeBatch({token,householdId,userId,requestId,actions});
   if(result?.status==="conflict")return failure(409,"confirm_conflict");
   if(result?.status==="invalid")return failure(422,"confirm_not_supported");
   if(result?.status==="forbidden")return failure(403,"household_not_authorized");
   if(!["created","same"].includes(result?.status)||result.count!==actions.length
      ||result.categoriesCreated!==categories.length)
    return failure(503,"confirm_unavailable");
   return {status:200,body:{commit:{kind:"batch",requestId,count:actions.length,
      categoriesCreated:categories.length,created:result.status==="created"}}};
  }catch{return failure(503,"confirm_unavailable")}
 };
}
