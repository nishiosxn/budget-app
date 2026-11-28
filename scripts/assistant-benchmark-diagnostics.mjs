// Synthetic benchmark only. Never serialize raw HTTP responses, headers or credentials.
import {matchesExpected} from "./assistant-benchmark-fixtures.mjs";
const object=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const value=v=>v===null||typeof v==="boolean"||typeof v==="number"?v:typeof v==="string"?v.slice(0,160):undefined;
const fields=["kind","categoryId","owner","amountCents","date","frequency","planMode","label"];
const queryFields=["kind","query","month","compareMonth","categoryId","owner"];
function project(v){
 if(!object(v))return null;
 const out={};
 for(const k of [...queryFields,"message"])if(Object.hasOwn(v,k)&&value(v[k])!==undefined)out[k]=value(v[k]);
 if(Array.isArray(v.operations))out.operations=v.operations.slice(0,12).map(o=>{
  if(!object(o))return null;
  return Object.fromEntries([...fields,"categoryHint"].filter(k=>Object.hasOwn(o,k)&&value(o[k])!==undefined).map(k=>[k,value(o[k])]));
 });
 return out;
}
const get=(o,k)=>k==="planMode"&&o?.kind==="plan"?o.planMode||"set":o?.[k];
const cmp=(path,expected,actual)=>({path,expected:expected===undefined?null:expected,actual:actual===undefined?null:actual,expectedPresent:expected!==undefined,actualPresent:actual!==undefined});
export function fieldDifferences(expected,actual){
 if(!expected||!actual||expected.kind!==actual.kind)return [cmp("kind",expected?.kind,actual?.kind)];
 if(expected.kind==="draft"){
  if(!Array.isArray(expected.operations)||!Array.isArray(actual.operations))return [cmp("operations.length",expected.operations?.length,actual.operations?.length)];
  const differences=[];
  if(expected.operations.length!==actual.operations.length)differences.push(cmp("operations.length",expected.operations.length,actual.operations.length));
  const remaining=actual.operations.map((o,i)=>({o,i}));
  // Exact matches first; nearest unmatched action only for diagnostic pairing.
  const wanted=expected.operations.map((o,i)=>({o,i})).sort((a,b)=>Number(!!b.o?.label)-Number(!!a.o?.label));
  function keys(o){return fields.filter(k=>(k!=="label"||Object.hasOwn(o,"label"))&&(k!=="planMode"||o.kind==="plan"))}
  const unmatched=[];
  for(const e of wanted){
   const exact=remaining.findIndex(a=>a.o&&keys(e.o).every(k=>get(a.o,k)===get(e.o,k)));
   if(exact>=0)remaining.splice(exact,1);else unmatched.push(e);
  }
  for(const e of unmatched){
   const ks=keys(e.o);
   const score=a=>ks.reduce((n,k)=>n+Number(get(a.o,k)!==get(e.o,k)),0);
   remaining.sort((a,b)=>score(a)-score(b)||a.i-b.i);
   const a=remaining.shift();
   for(const k of ks)if(get(e.o,k)!==get(a?.o,k))differences.push({...cmp("operations["+e.i+"]."+k,get(e.o,k),get(a?.o,k)),actualIndex:a?.i??null});
  }
  return differences;
 }
 if(expected.kind==="query")return queryFields.filter(k=>expected[k]!==actual[k]).map(k=>cmp(k,expected[k],actual[k]));
 return typeof actual.message==="string"&&actual.message.trim()?[]:[cmp("message","nonempty",actual.message)];
}
export function diagnoseResponse(item,decoded,checked){
 const expected=project(item.expected),model=project(decoded),normalized=checked?.ok?project(checked.value):null;
 const rawDifferences=fieldDifferences(expected,model),normalizedDifferences=normalized?fieldDifferences(expected,normalized):null;
 // Official score remains the existing matcher against the validated result.
 const correct=checked?.ok===true&&matchesExpected(checked.value,item.expected);
 return {expected,model,normalized,rawDifferences,normalizedDifferences,
  normalizationDifferences:model&&normalized?fieldDifferences(model,normalized):null,
  normalizationAccepted:checked?.ok===true,
  validationError:checked?.ok===false?String(checked.error||"invalid").slice(0,160):null,
  correct};
}
// Five different intents, with a single explicit replay of the previously attempted case.
// Stable fixed identifiers; never reorder the original corpus or erase its ledger.
export const diagnosticIds=Object.freeze(["fr-2-1","fr-5-1","fr-7-4","fr-16-1","fr-17-1"]);
export const diagnosticRetestId="fr-2-1";
export const diagnosticRetestTag="8C.4-diagnostic-v1";
export function diagnosticSelection(fallback){
 return diagnosticIds.map(id=>{
  const item=fallback.find(x=>x.id===id);
  if(!item)throw Error("Diagnostic case not present in fallback corpus: "+id);
  return item;
 });
}
export function attemptEligible(journal,corpusHash,id,diagnostic=false){
 const previous=journal.filter(x=>x.corpusHash===corpusHash&&x.id===id);
 if(diagnostic&&id===diagnosticRetestId)return previous.some(x=>!x.retest)&&!previous.some(x=>x.retest===diagnosticRetestTag);
 return previous.length===0;
}
