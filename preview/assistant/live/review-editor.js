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
  const existing=core.availableCategories(op,ctx).map(c=>({value:"id:"+c.id,name:c.name,owner:c.owner,group:"Catégories du foyer"}));
  const missing=core.categoryRules.filter(r=>core.draftCategorySuggestion({...op,categoryId:null},ctx,r.key)).map(r=>({value:"rule:"+r.key,name:"Créer "+r.name,owner:ctx.actor,group:"Catégories à créer"}));
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

 // Category/month projection includes the entire pending batch, never writes.
 function expenseBudget(entry,entries,report){
  const o=entry.op,target=selected(entry),month=String(o.date).slice(0,7);
  if(o.kind!=="expense"||!target||!core.validMonth(month))return null;
  const fresh=target.startsWith("rule:");
  if(!fresh&&(!report||!Number.isSafeInteger(report.actualCents)||report.actualCents<0||!Number.isSafeInteger(report.plannedCents)||report.plannedCents<0||typeof report.hasBudget!=="boolean"))return null;
  const actual=fresh?0:report.actualCents;
  const same=entries.filter(e=>selected(e)===target);
  const applies=e=>e.op.date.slice(0,7)===month||(e.op.frequency==="monthly"&&e.op.date.slice(0,7)<month);
  const proposed=same.filter(e=>e.op.kind==="expense"&&applies(e)).reduce((sum,e)=>sum+e.op.amountCents,0);
  const plans=same.filter(e=>e.op.kind==="plan"&&applies(e));
  // Forward budget changes spanning different months need a full recurrence
  // projection; do not reuse a baseline from another month.
  if(plans.length>1||plans.some(e=>e.op.date.slice(0,7)!==month))return null;
  const projected=plans.length?planPreview(plans[0]):null;
  if(plans.length&&!projected)return null;
  const budget=projected?projected.afterCents:fresh||!report.hasBudget?null:report.plannedCents;
  const used=actual+proposed;
  if(!Number.isSafeInteger(used)||!Number.isSafeInteger(proposed))return null;
  return {month,budget,actual,proposed,used,remaining:budget===null?null:budget-used,hasPlan:plans.length>0,percent:budget===null?0:budget===0?(used>0?100:0):Math.min(100,Math.max(0,used/budget*100))};
 }
 function newBudgetEntry(entry,amount,ctx){
  const o=entry.op,amountCents=cents(amount),rule=core.draftCategorySuggestion(o,ctx,entry.ruleKey);
  if(o.kind!=="expense"||!rule||!Number.isSafeInteger(amountCents))return fail("Budget invalide.");
  const op={kind:"plan",categoryId:null,owner:ctx.actor,amountCents,date:o.date.slice(0,7)+"-01",label:rule.name,frequency:"once",planMode:"set"};
  const checked=core.validateReview({kind:"draft",operations:[op]},ctx);
  return checked.ok?{ok:true,entry:{op:checked.value.operations[0],ruleKey:rule.key,baseline:null}}:checked;
 }
 root.SmartBudgetReviewEditor=Object.freeze({cents,money,choices,selected,key,planPreview,fromFields,categoryFromFields,validate,totals,expenseBudget,newBudgetEntry});
})(globalThis);
