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
 function catalogOptions(categories=[]){
  const known=new Set(core.categoryRules.flatMap(r=>[r.name,...r.aliases].map(norm)));
  return [
   ...core.categoryRules.map(r=>({value:"rule:"+r.key,name:r.name,kind:r.kind,standard:true})),
   ...categories.filter(c=>!known.has(norm(c.name))).map(c=>({value:"id:"+c.id,name:c.name,kind:c.kind,standard:false}))
  ];
 }
 function resolve(op,categories,rules){
  if(!op||!Array.isArray(categories)||!rules||typeof rules!=="object"||op.kind==="plan")return null;
  const label=norm(op.label),month=String(op.date||"").slice(0,7);
  if(!label||!isoMonth(month))return null;
  const available=c=>c.kind===op.kind&&(!c.createdFrom||c.createdFrom<=month)&&!(c.hiddenMonths||[]).includes(month);
  const candidates=[];
  for(const [term,value] of Object.entries(rules)){
   const key=norm(term);
   if(!key||key.length>80||!validId(value)||label!==key&&!(' '+label+' ').includes(' '+key+' '))continue;
   let selected=null;
   if(value.startsWith("rule:")){
    const rule=core.categoryRules.find(r=>r.key===value.slice(5)&&r.kind===op.kind);
    if(!rule)continue;
    const names=new Set([rule.name,...rule.aliases].map(norm));
    const matches=categories.filter(c=>names.has(norm(c.name))&&available(c));
    if(matches.length===1)selected={categoryId:matches[0].id,ruleKey:rule.key,source:"catalog"};
    else if(!matches.length&&!categories.some(c=>names.has(norm(c.name))&&c.kind===rule.kind))selected={categoryId:null,ruleKey:rule.key,source:"new"};
   }else{
    const id=value.startsWith("id:")?value.slice(3):value;
    const category=categories.find(c=>c.id===id&&available(c));
    if(category)selected={categoryId:category.id,ruleKey:null,source:"personal"};
   }
   if(selected)candidates.push({...selected,exact:label===key,size:key.length});
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||b.size-a.size);
  const first=candidates[0];
  const tied=candidates.some(c=>c.exact===first.exact&&c.size===first.size&&(c.categoryId!==first.categoryId||c.ruleKey!==first.ruleKey));
  return tied?null:{categoryId:first.categoryId,ruleKey:first.ruleKey,source:first.source};
 }
 function match(op,categories,rules){return resolve(op,categories,rules)?.categoryId??null}
 root.SmartBudgetCategoryRules=Object.freeze({fromRows,catalogOptions,resolve,match});
})(globalThis);
