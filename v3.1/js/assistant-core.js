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
 root.SmartBudgetAssistantCore=Object.freeze({validateResult:validateAssistantResult,validDate,validMonth,findDuplicates});
})(globalThis);
