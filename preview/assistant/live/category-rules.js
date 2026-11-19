((root)=>{
 "use strict";
 const core=root.SmartBudgetAssistantCore;
 if(!core)throw Error("Smart Budget category core unavailable");
 const norm=value=>core.normalizeCategory(value);
 const validId=value=>typeof value==="string"&&value.length>0&&value.length<=120;
 const isoMonth=value=>typeof value==="string"&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);
 function fromRows(rows){
  if(!Array.isArray(rows)||rows.length>300)throw Error("Catalogue trop volumineux");
  const seen=new Set(),categories=[];
  for(const row of rows){
   if(!row||typeof row!=="object")continue;
   const id=row.legacy_id||row.id,name=row.name;
   if(!validId(id)||typeof name!=="string"||!name.trim()||name.length>120||seen.has(id))continue;
   const kind=row.type==="income"?"income":row.is_saving===true?"saving":"expense";
   const createdFrom=typeof row.created_from==="string"&&isoMonth(row.created_from.slice(0,7))?row.created_from.slice(0,7):null;
   const hiddenMonths=Array.isArray(row.excluded_months)?row.excluded_months.filter(isoMonth).slice(0,240):[];
   categories.push({id,name:name.trim(),kind,createdFrom,hiddenMonths,owner:["A","B"].includes(row.owner_slot)?row.owner_slot:"B"});
   seen.add(id);
  }
  return categories;
 }
 function match(op,categories,rules){
  if(!op||!Array.isArray(categories)||!rules||typeof rules!=="object"||op.kind==="plan")return null;
  const label=norm(op.label),month=String(op.date||"").slice(0,7);if(!label||!isoMonth(month))return null;
  const candidates=[];
  for(const [term,id] of Object.entries(rules)){
   const key=norm(term);
   if(!key||key.length>80||!validId(id))continue;
   if(label!==key&&!(" "+label+" ").includes(" "+key+" "))continue;
   const cat=categories.find(c=>c.id===id&&c.kind===op.kind&&(!c.createdFrom||c.createdFrom<=month)&&!(c.hiddenMonths||[]).includes(month));
   if(cat)candidates.push({id:cat.id,size:key.length,exact:label===key});
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||b.size-a.size);
  const first=candidates[0],conflicting=candidates.some(c=>c.exact===first.exact&&c.size===first.size&&c.id!==first.id);
  return conflicting?null:first.id;
 }
 root.SmartBudgetCategoryRules=Object.freeze({fromRows,match});
})(globalThis);
