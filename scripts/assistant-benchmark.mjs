// Optional separate hands-on model evaluation, never run by CI.
import fs from "node:fs";
import vm from "node:vm";
import {benchmarkScenarios as scenarios,sampleContext,matchesExpected} from "./assistant-benchmark-fixtures.mjs";
import {performance} from "node:perf_hooks";
import {execFileSync} from "node:child_process";
import * as gateway from "../supabase/functions/smart-assistant/gateway.mjs";
const {makeModelRequest,decodeModelResponse,validModel,estimateReservation,extractTokenUsage}=gateway;
const flags=new Set(process.argv.slice(2));
const loadCore=source=>{
 const box=vm.createContext({});
 vm.runInContext(source,box);
 return box.SmartBudgetAssistantCore;
};
const core=loadCore(fs.readFileSync(new URL("../js/assistant-core.js",import.meta.url),"utf8"));
const baseline=process.argv.find(arg=>arg.startsWith("--compare="))?.split("=")[1];
const average=(rows,key)=>rows.length?rows.reduce((sum,row)=>sum+row[key],0)/rows.length:null;
const max=(rows,key)=>rows.length?Math.max(...rows.map(row=>row[key])):null;
function score(engine,routing){
 const results=scenarios.map(item=>{
  const started=performance.now(),r=engine.quickCommand(item.prompt,sampleContext);
  return {id:item.id,kind:item.expected.kind,local:r?.ok===true,correct:matchesExpected(r?.value,item.expected),
   ms:performance.now()-started};
 });
 const groups={};
 for(const row of results){
  const group=groups[row.kind]??={total:0,local:0,correct:0};
  group.total++;group.local+=Number(row.local);group.correct+=Number(row.correct);
 }
 const enc=new TextEncoder();
 const payloads=scenarios.map(item=>{
  const payload=routing.makeModelRequest(item.prompt,sampleContext);
  return {systemBytes:enc.encode(payload.messages[0].content).length,bytes:enc.encode(JSON.stringify(payload)).length,
   estimate:routing.estimateReservation(payload)};
 });
 const fallback=payloads.filter((p,i)=>!results[i].local&&p.estimate!==null);
 return {
  engine:"local-rules",total:results.length,local:results.filter(r=>r.local).length,correct:results.filter(r=>r.correct).length,
  meanMs:average(results,"ms"),groups,
  systemBytes:payloads[0].systemBytes,avgPayloadBytes:average(payloads,"bytes"),
  fallbackEstimatedNeurons:{requests:fallback.length,mean:average(fallback,"estimate"),max:max(fallback,"estimate")},
  ...(flags.has("--details")?{incorrect:results.filter(r=>!r.correct).map(({id,local})=>[id,local])}:{})
 };
}
if(flags.has("--local")){
 let before;
 if(baseline){
  if(!/^[a-f0-9]{7,40}$/i.test(baseline))throw Error("Use a local Git commit hash");
  const read=path=>execFileSync("git",["show",baseline+":"+path]);
  const previous=await import("data:text/javascript;base64,"+read("supabase/functions/smart-assistant/gateway.mjs").toString("base64"));
  before=score(loadCore(read("js/assistant-core.js").toString("utf8")),previous);
 }
 console.log(JSON.stringify(before?{baseline,before,after:score(core,gateway)}:score(core,gateway),null,2));
 process.exit(0);
}
if(!flags.has("--live")||process.env.SMART_ASSISTANT_BENCHMARK_FREE_CONFIRMED!=="yes"){
 console.log("Dry run:",scenarios.length,"synthetic French scenarios. Live test requires --live and explicit free-plan verification.");process.exit(0);
}
const account=process.env.SMART_ASSISTANT_CF_ACCOUNT_ID,token=process.env.SMART_ASSISTANT_CF_TOKEN,model=process.env.SMART_ASSISTANT_MODEL||"@cf/google/gemma-4-26b-a4b-it";
if(!account||!token||!/^[a-f0-9]{32}$/i.test(account)||!validModel(model))throw Error("Provider configuration missing or unapproved");
const offset=Number(process.env.SMART_ASSISTANT_BENCHMARK_OFFSET||0),limit=Number(process.env.SMART_ASSISTANT_BENCHMARK_LIMIT||5);
if(!Number.isInteger(offset)||offset<0||offset>=scenarios.length||!Number.isInteger(limit)||limit<1||limit>10)throw Error("Max 10 live cases per run; choose a valid offset");
const attempts=[];
let totalReserved=0;
for(const item of scenarios.slice(offset,offset+limit)){
 const payload=makeModelRequest(item.prompt,sampleContext),reservedNeurons=estimateReservation(payload);
 if(reservedNeurons===null||totalReserved+reservedNeurons>2000)break;
 totalReserved+=reservedNeurons;
 const started=performance.now(),attempt={id:item.id,reservedNeurons};
 attempts.push(attempt);
 try{
  const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/"+model,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000),redirect:"error"});
  attempt.httpStatus=r.status;
  if(!r.ok){attempt.outcome="provider_http_error";break}
  const raw=await r.json();
  attempt.tokens=extractTokenUsage(raw);
  try{
   const parsed=decodeModelResponse(raw);
   const checked=parsed?.kind==="draft"?core.normalizeModelDraft(parsed,sampleContext,item.prompt):core.validateResult(parsed,sampleContext);
   attempt.outcome=checked.ok?(matchesExpected(checked.value,item.expected)?"correct":"interpretation_error"):"validation_error";
  }catch{attempt.outcome="invalid_response"}
 }catch(error){attempt.outcome=error?.name==="TimeoutError"?"timeout":"transport_error";break}
 finally{attempt.ms=performance.now()-started}
}
const tokenRows=attempts.map(a=>a.tokens).filter(Boolean);
console.log(JSON.stringify({model,offset,attempted:attempts.length,passed:attempts.filter(a=>a.outcome==="correct").length,
 meanMs:average(attempts,"ms"),estimatedNeurons:{totalReserved,mean:average(attempts,"reservedNeurons"),max:max(attempts,"reservedNeurons")},
 reportedTokens:{samples:tokenRows.length,...Object.fromEntries(["input","output","total"].map(k=>[k,{mean:average(tokenRows,k),max:max(tokenRows,k)}]))},
 measuredProviderNeurons:null,attempts},null,2));
