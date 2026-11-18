/* Smart Budget V3.1 — pure, fail-closed assistant contract. */
(function exposeSmartAssistantCore(root){
 "use strict";
 const kinds=new Set(["expense","income","saving","plan"]);
 const owners=new Set(["B","A","common"]);
 const queries=new Set(["summary","categories","transactions","comparison"]);
 const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
 const exact=(v,keys)=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const validDate=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v;
 const validMonth=v=>typeof v==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
 const clean=(s,n)=>typeof s==="string"&&s.trim().length>0&&s.length<=n&&!/[\u0000-\u001f\u007f]/.test(s);
 const fail=error=>({ok:false,error});
 const ownerOK=(v,ctx)=>owners.has(v)&&(!ctx.solo||v==="B");
 const catOf=(id,ctx)=>ctx.categories.find(c=>c.id===id);
 const monthOK=(m,ctx)=>validMonth(m)&&m>=ctx.firstMonth&&m<=ctx.lastMonth;
 const contextOK=c=>obj(c)&&Array.isArray(c.categories)&&c.categories.length<=300&&validMonth(c.firstMonth)&&validMonth(c.lastMonth)&&c.firstMonth<=c.lastMonth&&validDate(c.today)&&typeof c.solo==="boolean";
 function validateAssistantOp(v,c){
  if(!exact(v,["kind","categoryId","owner","amountCents","date","label","frequency"]))return fail("Champs invalides.");
  const cat=catOf(v.categoryId,c),m=String(v.date).slice(0,7);
  if(!kinds.has(v.kind)||!ownerOK(v.owner,c)||!validDate(v.date)||!clean(v.label,120))return fail("Type, personne, date ou libellé invalide.");
  if(!cat||!monthOK(m,c)||(cat.createdFrom&&m<cat.createdFrom)||(cat.hiddenMonths||[]).includes(m))return fail("Catégorie inconnue ou indisponible.");
  if(v.kind!=="plan"&&v.kind!==cat.kind)return fail("Type et catégorie incompatibles.");
  if(!Number.isSafeInteger(v.amountCents)||v.amountCents<(v.kind==="plan"?0:1)||v.amountCents>100000000)return fail("Montant invalide.");
  if(!["once","monthly"].includes(v.frequency)||(v.kind==="saving"&&v.frequency!=="once"))return fail("Récurrence non prise en charge.");
  if(v.kind==="plan"&&v.owner!==cat.owner)return fail("Attribution du budget prévu à préciser.");
  if(v.kind!=="plan"&&v.frequency==="once"&&v.date>c.today)return fail("Opération réelle future : préciser.");
  return {ok:true,value:{...v,label:v.label.trim()}};
 }
 function validateAssistantResult(v,c){
  if(!contextOK(c)||!obj(v))return fail("Contexte ou réponse invalide.");
  if(v.kind==="clarify"||v.kind==="answer"){
   return exact(v,["kind","message"])&&clean(v.message,800)?{ok:true,value:{kind:v.kind,message:v.message.trim()}}:fail("Message invalide.");
  }
  if(v.kind==="draft"){
   if(!exact(v,["kind","operations"])||!Array.isArray(v.operations)||!v.operations.length||v.operations.length>12)return fail("Lot invalide.");
   const operations=[],seen=new Set(),plans=new Set();
   for(const item of v.operations){
    const checked=validateAssistantOp(item,c);if(!checked.ok)return checked;
    const op=checked.value,key=JSON.stringify([op.kind,op.categoryId,op.owner,op.amountCents,op.date,op.label.toLowerCase(),op.frequency]);
    if(seen.has(key))return fail("Deux opérations identiques : précise la demande.");seen.add(key);
    if(op.kind==="plan"){const k=op.categoryId+"|"+op.date.slice(0,7);if(plans.has(k))return fail("Deux budgets concurrents.");plans.add(k)}
    operations.push(op);
   }
   return {ok:true,value:{kind:"draft",operations}};
  }
  if(v.kind==="query"){
   if(!exact(v,["kind","query","month","compareMonth","categoryId","owner"])||!queries.has(v.query)||!monthOK(v.month,c))return fail("Requête non autorisée.");
   if(v.query==="comparison"){if(!monthOK(v.compareMonth,c)||v.compareMonth===v.month)return fail("Comparaison invalide.")}
   else if(v.compareMonth!==null)return fail("Comparaison inattendue.");
   if(v.owner!==null&&!ownerOK(v.owner,c))return fail("Personne non autorisée.");
   if(v.categoryId!==null&&!catOf(v.categoryId,c))return fail("Catégorie inconnue.");
   if(["summary","comparison"].includes(v.query)&&(v.categoryId!==null||v.owner!==null))return fail("Filtre incompatible.");
   return {ok:true,value:{...v}};
  }
  return fail("Action non autorisée.");
 }
 const findDuplicates=(ops,existing)=>ops.filter(o=>o.kind!=="plan"&&existing.some(t=>t.kind===o.kind&&t.categoryId===o.categoryId&&t.owner===o.owner&&t.amountCents===o.amountCents&&t.date===o.date));
 // Unassigned proposals are permitted for display only. They can never pass validateResult.
 function validateReview(v,c){
  if(!contextOK(c)||!exact(v,["kind","operations"])||v.kind!=="draft"||!Array.isArray(v.operations)||!v.operations.length||v.operations.length>12)return fail("Brouillon invalide.");
  const operations=[],seen=new Set(),plans=new Set();
  for(const o of v.operations){
   if(!obj(o)||Object.keys(o).some(k=>!["kind","categoryId","owner","amountCents","date","label","frequency","planMode"].includes(k)))return fail("Champs invalides.");
   const {planMode,...base}=o;
   if(!exact(base,["kind","categoryId","owner","amountCents","date","label","frequency"]))return fail("Champs invalides.");
   if(planMode!==undefined&&(base.kind!=="plan"||!["set","increase","decrease"].includes(planMode)))return fail("Mode de budget invalide.");
   if(planMode&&planMode!=="set"&&base.amountCents<=0)return fail("Variation invalide.");
   if(base.categoryId===null){
    if(!kinds.has(base.kind)||!ownerOK(base.owner,c)||!validDate(base.date)||!monthOK(base.date.slice(0,7),c)||!clean(base.label,120)||!Number.isSafeInteger(base.amountCents)||base.amountCents<(base.kind==="plan"?0:1)||base.amountCents>100000000||!["once","monthly"].includes(base.frequency)||(base.kind==="saving"&&base.frequency!=="once")||(base.kind!=="plan"&&base.frequency==="once"&&base.date>c.today))return fail("Proposition incomplète invalide.");
   }else if(!validateAssistantOp(base,c).ok)return fail("Proposition invalide.");
   const key=JSON.stringify([base.kind,base.categoryId,base.owner,base.amountCents,base.date,base.label.trim().toLowerCase(),base.frequency,planMode||"set"]);
   if(seen.has(key))return fail("Doublon possible.");seen.add(key);
   if(base.kind==="plan"&&base.categoryId!==null){const key=base.categoryId+"|"+base.date.slice(0,7);if(plans.has(key))return fail("Budgets concurrents.");plans.add(key)}
   operations.push({...base,label:base.label.trim(),...(base.kind==="plan"?{planMode:planMode||"set"}:{})});
  }
  return {ok:true,value:{kind:"draft",operations}};
 }
 // Resolve a planned amount in integer cents; never ask the model to add up money.
 function resolvePlanAmount(op,beforeCents){
  if(op?.kind!=="plan"||!Number.isSafeInteger(op.amountCents)||op.amountCents<0||!Number.isSafeInteger(beforeCents)||beforeCents<0)return null;
  const mode=op.planMode||"set",after=mode==="increase"?beforeCents+op.amountCents:mode==="decrease"?beforeCents-op.amountCents:mode==="set"?op.amountCents:NaN;
  return Number.isSafeInteger(after)&&after>=0&&after<=100000000?{beforeCents,afterCents:after}:null;
 }
 root.SmartBudgetAssistantCore=Object.freeze({validateResult:validateAssistantResult,validateReview,resolvePlanAmount,validDate,validMonth,findDuplicates});
})(globalThis);
