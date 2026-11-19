((root)=>{
 "use strict";
 const core=root.SmartBudgetAssistantCore,fail=error=>({ok:false,error});
 function cents(value,optional=false){
  const s=String(value??"").trim().replace(",",".");
  if(!s&&optional)return null;
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(s))return NaN;
  const [whole,frac=""]=s.split("."),n=Number(whole)*100+Number(frac.padEnd(2,"0"));
  return Number.isSafeInteger(n)&&n<=100000000?n:NaN;
 }
 const money=n=>n===null?"":(n/100).toFixed(2).replace(".",",");
 function choices(op,ctx){
  if(!core.validDate(op.date))return [];
  const existing=core.availableCategories(op,ctx).map(c=>({value:"id:"+c.id,name:c.name,owner:c.owner}));
  const missing=core.categoryRules.filter(r=>core.draftCategorySuggestion({...op,categoryId:null},ctx,r.key)).map(r=>({value:"rule:"+r.key,name:"Créer "+r.name,owner:ctx.actor}));
  return [...existing,...missing];
 }
 const selected=e=>e.op.categoryId?"id:"+e.op.categoryId:e.ruleKey?"rule:"+e.ruleKey:"";
 const key=op=>op.categoryId?op.categoryId+"|"+op.date.slice(0,7):null;
 function planPreview(entry){
  if(entry.op.kind!=="plan")return null;
  if(entry.op.categoryId===null)return entry.ruleKey?core.resolvePlanAmount(entry.op,0):null;
  return entry.baseline?.key===key(entry.op)?core.resolvePlanAmount(entry.op,entry.baseline.beforeCents):null;
 }
 function fromFields(entry,fields,ctx){
  const o=entry.op,amountCents=cents(fields.amount),name=String(fields.name??"").trim(),detail=String(fields.detail??"").trim();
  if(!name||name.includes(" · ")||detail.includes(" · ")||/[\u0000-\u001f\u007f]/.test(name+detail))return fail("Renseigne un nom et un libellé valides.");
  const label=o.kind==="expense"&&detail?name+" · "+detail:name;
  if(label.length>120)return fail("Le nom et le libellé ne doivent pas dépasser 120 caractères.");
  const date=fields.date,frequency=fields.frequency,op={...o,label,amountCents,date,frequency};
  if(o.kind==="plan")op.planMode=fields.planMode;
  else op.owner=fields.owner;
  const available=choices(op,ctx),target=available.find(x=>x.value===fields.category);
  if(!target)return fail("Choisis une catégorie disponible à cette date.");
  let ruleKey=null;
  if(target.value.startsWith("id:"))op.categoryId=target.value.slice(3);
  else{op.categoryId=null;ruleKey=target.value.slice(5)}
  if(o.kind==="plan")op.owner=target.owner;
  const validated=core.validateReview({kind:"draft",operations:[op]},ctx);
  if(!validated.ok)return validated;
  return {ok:true,entry:{op:validated.value.operations[0],ruleKey,baseline:entry.baseline&&entry.baseline.key===key(op)?entry.baseline:null}};
 }
 function categoryFromFields(original,fields,ctx){
  const next={...original,name:String(fields.name??"").trim(),month:fields.month,budgetCents:cents(fields.budget,true),expenseCents:cents(fields.expense,true)};
  return core.validateCategoryDraft(next,ctx);
 }
 function validate(entries,ctx){
  const checked=core.validateReview({kind:"draft",operations:entries.map(e=>e.op)},ctx);if(!checked.ok)return checked;
  const plans=new Set();
  for(const e of entries){
   if(e.op.categoryId===null&&!core.draftCategorySuggestion(e.op,ctx,e.ruleKey))return fail("Choisis une catégorie pour chaque opération.");
   if(e.op.kind==="plan"){
    const identity=(e.op.categoryId?"id:"+e.op.categoryId:"rule:"+e.ruleKey)+"|"+e.op.date.slice(0,7);
    if(plans.has(identity))return fail("Deux budgets concurrents.");plans.add(identity);
    if(!planPreview(e))return fail("Budget actuel indisponible ou variation invalide.");
   }
  }
  return checked;
 }
 function totals(entries){
  let income=0,expense=0,saving=0;
  for(const {op:o} of entries){if(o.frequency!=="once")continue;if(o.kind==="income")income+=o.amountCents;else if(o.kind==="expense")expense+=o.amountCents;else if(o.kind==="saving")saving+=o.amountCents}
  return {income,expense,saving,net:income-expense,available:income-expense-saving};
 }
 root.SmartBudgetReviewEditor=Object.freeze({cents,money,choices,selected,key,planPreview,fromFields,categoryFromFields,validate,totals});
})(globalThis);
