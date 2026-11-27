// Optional separate hands-on model evaluation, never run by CI.
import fs from "node:fs";
import vm from "node:vm";
import {benchmarkScenarios as scenarios,sampleContext,matchesExpected} from "./assistant-benchmark-fixtures.mjs";
import {performance} from "node:perf_hooks";
import {makeModelRequest,decodeModelResponse,validModel} from "../supabase/functions/smart-assistant/gateway.mjs";
const flags=new Set(process.argv.slice(2));
const box=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL("../js/assistant-core.js",import.meta.url),"utf8"),box);
const core=box.SmartBudgetAssistantCore;
if(flags.has("--local")){
 const results=scenarios.map(item=>{
  const started=performance.now(),r=core.quickCommand(item.prompt,sampleContext);
  return {id:item.id,kind:item.expected.kind,local:r?.ok===true,correct:matchesExpected(r?.value,item.expected),
   ms:performance.now()-started};
 });
 const groups={};
 for(const row of results){
  const group=groups[row.kind]??={total:0,local:0,correct:0};
  group.total++;group.local+=Number(row.local);group.correct+=Number(row.correct);
 }
 console.log(JSON.stringify({
  engine:"local-rules",total:results.length,local:results.filter(r=>r.local).length,correct:results.filter(r=>r.correct).length,
  meanMs:results.reduce((n,r)=>n+r.ms,0)/results.length,groups,
  ...(flags.has("--details")?{incorrect:results.filter(r=>!r.correct).map(({id,local})=>[id,local])}:{})
 },null,2));
 process.exit(0);
}
if(!flags.has("--live")||process.env.SMART_ASSISTANT_BENCHMARK_FREE_CONFIRMED!=="yes"){
 console.log("Dry run:",scenarios.length,"synthetic French scenarios. Live test requires --live and explicit free-plan verification.");process.exit(0);
}
const account=process.env.SMART_ASSISTANT_CF_ACCOUNT_ID,token=process.env.SMART_ASSISTANT_CF_TOKEN,model=process.env.SMART_ASSISTANT_MODEL||"@cf/google/gemma-4-26b-a4b-it";
if(!account||!token||!/^[a-f0-9]{32}$/i.test(account)||!validModel(model))throw Error("Provider configuration missing or unapproved");
const offset=Number(process.env.SMART_ASSISTANT_BENCHMARK_OFFSET||0),limit=Number(process.env.SMART_ASSISTANT_BENCHMARK_LIMIT||5);
if(!Number.isInteger(offset)||offset<0||offset>=scenarios.length||!Number.isInteger(limit)||limit<1||limit>10)throw Error("Max 10 live cases per run; choose a valid offset");
let n=0,pass=0;for(const item of scenarios.slice(offset,offset+limit)){
 try{
  const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/"+model,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(makeModelRequest(item.prompt,sampleContext)),signal:AbortSignal.timeout(40000)});
  if(!r.ok){console.log(item.id,"provider error",r.status,"— stopped, no fallback");break}
  const parsed=decodeModelResponse(await r.json()),checked=parsed?.kind==="draft"?core.normalizeModelDraft(parsed,sampleContext,item.prompt):core.validateResult(parsed,sampleContext),ok=checked.ok&&matchesExpected(checked.value,item.expected);n++;if(ok)pass++;console.log(item.id,ok?"PASS":"FAIL");
 }catch{console.log(item.id,"network or parsing error — stopped");break}
}
console.log(JSON.stringify({model,offset,attempted:n,passed:pass,total:scenarios.length}));
