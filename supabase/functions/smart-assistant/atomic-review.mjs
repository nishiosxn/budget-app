const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const version=v=>typeof v==="string"&&v.length<=48&&Number.isFinite(Date.parse(v));
const bad=(status,error)=>({status,body:{error}});

export function createAtomicReview({validateReview,validateMixedDraft,validateCategoryDraft,recognize,normalizeCategory,write}){
 return async function atomicReview({action,householdId,userId,requestId,command,draft,expectedPlans,categoryVersions,context}){
  if(context?.movementCommit!==true)return bad(403,"household_not_authorized");
  let actions=null;
  if(action==="prepare"){
   const creations=draft?.kind==="categoryDraft"?[draft]:draft?.kind==="mixedDraft"?draft.categories:[];
   const ops=draft?.kind==="categoryDraft"?[]:draft?.operations;
   if(!Array.isArray(ops)||!Array.isArray(creations)||!Array.isArray(expectedPlans)||!Array.isArray(categoryVersions)||
      ops.length+creations.length<1||ops.length+creations.length>12||
      expectedPlans.length!==ops.filter(o=>o?.kind==="plan").length||categoryVersions.length!==ops.length)
    return bad(400,"invalid_request");
   const categories=new Map(context.categories.map(c=>[c.id,c]));
   if(ops.some((op,i)=>!version(categoryVersions[i])||categories.get(op?.categoryId)?.version!==categoryVersions[i]))
    return bad(409,"confirm_category_changed");
   const checked=draft.kind==="categoryDraft"?validateCategoryDraft(draft,context):
    draft.kind==="mixedDraft"?validateMixedDraft(draft,context):validateReview(draft,context);
   if(!checked.ok)return bad(422,"confirm_not_supported");
   if(expectedPlans.length&&!/\b(?:budget|prevu)\b/.test(normalizeCategory(command)))
    return bad(422,"confirm_not_supported");
   const original=creations.length?recognize(command,context):null;
   const offer=original?.missingCategory;
   const reviewedMissing=draft.kind==="categoryDraft"&&offer&&
    draft.owner===offer.owner&&draft.date===offer.date&&draft.month===offer.month&&draft.expenseCents===offer.amountCents;
   if(creations.length&&(!original?.ok||original.value?.kind!==draft.kind&&!reviewedMissing))
    return bad(422,"confirm_creation_not_requested");

   const baselines=new Map();
   for(const p of expectedPlans){
    if(!p||Object.keys(p).sort().join(",")!=="beforeCents,budgetVersion,index"||!cents(p.beforeCents)||
       !(p.budgetVersion===null||version(p.budgetVersion))||!Number.isInteger(p.index)||ops[p.index]?.kind!=="plan"||baselines.has(p.index))
     return bad(400,"invalid_request");
    baselines.set(p.index,p);
   }
   actions=[];
   for(const [i,op] of (checked.value.operations||[]).entries()){
    if(op.kind==="plan"&&!op.date.endsWith("-01"))return bad(422,"confirm_not_supported");
    const baseline=baselines.get(i);
    actions.push({...op,categoryVersion:categoryVersions[i],...(baseline?{
     beforeCents:baseline.beforeCents,budgetVersion:baseline.budgetVersion
    }:{})});
   }
   for(const cat of checked.value.categories||(creations.length?[checked.value]:[])){
    if(!normalizeCategory(cat.name))return bad(422,"confirm_category_not_supported");
    actions.push({...cat,kind:"create_category"});
   }
  }
  try{
   const result=await write({action,householdId,userId,requestId,actions});
   if(result?.status==="forbidden")return bad(403,"household_not_authorized");
   if(result?.status==="conflict")return bad(409,"confirm_conflict");
   if(result?.status==="rejected")return bad(409,"confirm_stale");
   if(result?.status==="invalid")return bad(422,"confirm_not_supported");
   if(["prepared","missing","expired"].includes(result?.status))return {status:200,body:{confirmation:result.status,requestId}};
   if(result?.status!=="complete"||!Number.isInteger(result.count)||result.count<1||result.count>12||
      !Number.isInteger(result.categoriesCreated)||result.categoriesCreated<0||result.categoriesCreated>result.count)
    return bad(503,"confirm_unavailable");
   return {status:200,body:{confirmation:"complete",commit:{kind:"batch",requestId,count:result.count,categoriesCreated:result.categoriesCreated}}};
  }catch{return bad(503,"confirm_unavailable")}
 };
}
