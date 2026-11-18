import "../_shared/smart-assistant-core.js";
import {createAssistantGateway} from "./gateway.mjs";

const originAllowed="https://nishiosxn.github.io";
const env=(name:string)=>Deno.env.get(name)||"";
const supabaseUrl=env("SUPABASE_URL").replace(/\/$/,"");
const publishable=env("SMART_ASSISTANT_SUPABASE_PUBLISHABLE")||env("SUPABASE_ANON_KEY");
const cfg={enabled:env("SMART_ASSISTANT_ENABLED")==="true",model:env("SMART_ASSISTANT_MODEL")||"@cf/google/gemma-4-26b-a4b-it",account:env("SMART_ASSISTANT_CF_ACCOUNT_ID"),token:env("SMART_ASSISTANT_CF_TOKEN")};
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const allowlist=new Set(env("SMART_ASSISTANT_TEST_HOUSEHOLDS").split(",").map(s=>s.trim()).filter(x=>uuidPattern.test(x)));
const allowedUsers=new Set(env("SMART_ASSISTANT_TEST_USERS").split(",").map(s=>s.trim()).filter(x=>uuidPattern.test(x)));
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const headersFor=(token:string)=>({apikey:publishable,Authorization:"Bearer "+token,"Content-Type":"application/json"});
const timeout=()=>AbortSignal.timeout(10000);
async function rest(token:string,path:string,params:Record<string,string>={}){
 const url=new URL(supabaseUrl+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const r=await fetch(url,{headers:headersFor(token),signal:timeout()});
 if(!r.ok)throw Error("REST rejected");
 return await r.json();
}
function nowInParis(){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const get=(k:string)=>parts.find(p=>p.type===k)?.value;
 return [get("year"),get("month"),get("day")].join("-");
}
async function authorize(token:string,householdId:string,input:Record<string,unknown>){
 if(!allowlist.has(householdId)||!supabaseUrl||!publishable)return null;
 // Verify the bearer token with Supabase Auth; never trust user_metadata or body ownership.
 const a=await fetch(supabaseUrl+"/auth/v1/user",{headers:headersFor(token),signal:timeout()});
 if(!a.ok)return null;
 const user=await a.json();
 if(!uuidPattern.test(user?.id||"")||!allowedUsers.has(user.id))return null;
 const member=await rest(token,"/rest/v1/household_members",{select:"slot",household_id:"eq."+householdId,user_id:"eq."+user.id,limit:"2"});
 if(!Array.isArray(member)||member.length!==1||!["A","B"].includes(member[0].slot))return null;
 const [households,rows]=await Promise.all([
  rest(token,"/rest/v1/households",{select:"person_b_label,person_a_label,household_mode",id:"eq."+householdId,limit:"1"}),
  rest(token,"/rest/v1/categories",{select:"id,legacy_id,name,type,is_saving,owner_slot,created_from,excluded_months",household_id:"eq."+householdId,archived_at:"is.null",limit:"301"})
 ]);
 if(!Array.isArray(households)||households.length!==1||!Array.isArray(rows)||rows.length>300)return null;
 const h=households[0],solo=h.household_mode==="solo",actor=member[0].slot;
 if(!solo||actor!=="B")return null;
 const pilotMembers=await rest(token,"/rest/v1/household_members",{select:"user_id",household_id:"eq."+householdId,limit:"2"});
 if(!Array.isArray(pilotMembers)||pilotMembers.length!==1||pilotMembers[0].user_id!==user.id)return null;
 const current=nowInParis(),currentMonth=current.slice(0,7);
 const selectedMonth=typeof input.selectedMonth==="string"&&monthPattern.test(input.selectedMonth)?input.selectedMonth:currentMonth;
 const categories=rows.map(row=>({id:row.legacy_id||row.id,name:String(row.name).slice(0,120),kind:row.type==="income"?"income":row.is_saving?"saving":"expense",owner:solo?"B":row.owner_slot==="A"||row.owner_slot==="B"?row.owner_slot:"common",createdFrom:String(row.created_from).slice(0,7),hiddenMonths:(Array.isArray(row.excluded_months)?row.excluded_months:[]).filter(x=>typeof x==="string"&&monthPattern.test(x)).slice(0,240)})).filter(c=>c.id&&monthPattern.test(c.createdFrom));
 const firstMonth=categories.map(c=>c.createdFrom).sort()[0]||currentMonth;
 const lastMonth=String(Number(currentMonth.slice(0,4))+2)+"-12";
 if(selectedMonth<firstMonth||selectedMonth>lastMonth)return null;
 return {context:{today:current,firstMonth,lastMonth,selectedMonth,solo,actor,members:{B:String(h.person_b_label||"Personne 1").slice(0,60),A:solo?null:String(h.person_a_label||"Personne 2").slice(0,60)},categories}};
}
async function reserve(_token:string,_householdId:string,units:number){
 // This RPC is server-only. The gateway has already authenticated and authorized
 // the user and household; no user JWT can reserve quota directly.
 const key=env("SUPABASE_SERVICE_ROLE_KEY");
 if(!key||!Number.isInteger(units)||units<1||units>1000)throw Error("Quota configuration unavailable");
 const r=await fetch(supabaseUrl+"/rest/v1/rpc/reserve_smart_assistant_quota_v1",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_units:units}),signal:timeout()});
 if(!r.ok)throw Error("Quota RPC unavailable");
 return (await r.json())===true;
}
async function infer(model:string,payload:unknown){
 if(!/^[a-f0-9]{32}$/i.test(cfg.account)||!cfg.token)throw Error("Provider not configured");
 const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+cfg.account+"/ai/run/"+model,{method:"POST",headers:{Authorization:"Bearer "+cfg.token,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)});
 if(!r.ok){console.warn("smart-assistant provider HTTP",r.status);throw Error("Provider rejected");}
 return await r.json();
}
async function planPreview(token:string,householdId:string,result:any,context:any){
 const plans=result.operations.map((o:any,i:number)=>({o,i})).filter(({o}:any)=>o.kind==="plan"&&o.categoryId!==null);
 if(!plans.length)return [];
 const cats=await rest(token,"/rest/v1/categories",{select:"id,legacy_id",household_id:"eq."+householdId,archived_at:"is.null",limit:"301"});
 if(!Array.isArray(cats)||cats.length>300)return [];
 const previews=[];
 for(const {o,i} of plans){
  const matches=cats.filter((c:any)=>(c.legacy_id||c.id)===o.categoryId);if(matches.length!==1)continue;
  const month=o.date.slice(0,7)+"-01";
  const rows=await rest(token,"/rest/v1/budgets",{select:"month,planned_amount,scope",household_id:"eq."+householdId,category_id:"eq."+matches[0].id,archived_at:"is.null",month:"lte."+month,order:"month.desc",limit:"301"});
  if(!Array.isArray(rows)||rows.length>300)continue;
  const before=(globalThis as any).SmartBudgetAssistantCore.readBudgetCents(rows,month.slice(0,7));if(before===null)continue;
  const computed=(globalThis as any).SmartBudgetAssistantCore.resolvePlanAmount(o,before);
  if(computed)previews.push({index:i,...computed});
 }
 return previews;
}
async function queryPreview(token:string,householdId:string,result:any,context:any){
 if(result.query!=="categories"||!result.categoryId||result.owner!==null||result.month>context.today.slice(0,7))return null;
 const cat=context.categories.find((c:any)=>c.id===result.categoryId&&c.kind==="expense");
 if(!cat||result.month<cat.createdFrom||cat.hiddenMonths.includes(result.month))return null;
 const cats=await rest(token,"/rest/v1/categories",{select:"id,legacy_id",household_id:"eq."+householdId,archived_at:"is.null",limit:"301"});
 if(!Array.isArray(cats)||cats.length>300)return null;
 const matches=cats.filter((c:any)=>(c.legacy_id||c.id)===cat.id);if(matches.length!==1)return null;
 const categoryUuid=matches[0].id,month=result.month+"-01";
 const [y,m]=result.month.split("-").map(Number),next=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
 const [budgets,transactions,recurrences]=await Promise.all([
  rest(token,"/rest/v1/budgets",{select:"month,planned_amount,scope",household_id:"eq."+householdId,category_id:"eq."+categoryUuid,archived_at:"is.null",month:"lte."+month,limit:"1000"}),
  rest(token,"/rest/v1/transactions",{select:"category_id,transaction_date,amount,metadata",household_id:"eq."+householdId,category_id:"eq."+categoryUuid,archived_at:"is.null",and:"(transaction_date.gte."+month+",transaction_date.lt."+next+")",limit:"1000"}),
  rest(token,"/rest/v1/recurrences",{select:"category_id,amount,start_month,end_month,excluded_months,overrides,metadata",household_id:"eq."+householdId,archived_at:"is.null",start_month:"lte."+month,limit:"1000"})
 ]);
 if([budgets,transactions,recurrences].some(r=>!Array.isArray(r)||r.length>=1000))return null;
 const totals=(globalThis as any).SmartBudgetAssistantCore.categoryReport({month:result.month,categoryId:cat.id,categoryUuid,budgets,transactions,recurrences});
 return totals?{name:cat.name,month:result.month,...totals}:null;
}
const quickExpense=(command:string,context:unknown)=>(globalThis as any).SmartBudgetAssistantCore.quickCommand(command,context);
const normalizeDraft=(value:unknown,context:unknown,command:string)=>(globalThis as any).SmartBudgetAssistantCore.normalizeModelDraft(value,context,command);
const validateReview=(value:unknown,context:unknown)=>(globalThis as any).SmartBudgetAssistantCore.validateReview(value,context);
const validate=(value:unknown,context:unknown)=>(globalThis as any).SmartBudgetAssistantCore.validateResult(value,context);
const handle=createAssistantGateway({enabled:cfg.enabled&&env("SMART_ASSISTANT_FREE_PLAN_CONFIRMED")==="true"&&allowlist.size===1&&allowedUsers.size===1&&!!cfg.account&&!!cfg.token,model:cfg.model,authorize,reserve,infer,validate,validateReview,normalizeDraft,quickExpense,planPreview,queryPreview});
function headers(req:Request){
 return {"Access-Control-Allow-Origin":req.headers.get("origin")===originAllowed?originAllowed:"null","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-smart-budget-sync-version, x-retry-count, traceparent, tracestate, baggage","Vary":"Origin","Cache-Control":"no-store","Content-Type":"application/json"};
}
Deno.serve(async req=>{
 const h=headers(req);
 if(req.headers.get("origin")&&req.headers.get("origin")!==originAllowed)return new Response(null,{status:403,headers:h});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});
 if(req.method!=="POST")return new Response(null,{status:405,headers:h});
 const authorization=req.headers.get("authorization")||"";
 if(!authorization.startsWith("Bearer "))return new Response(JSON.stringify({error:"authentication_required"}),{status:401,headers:h});
 let body;
 try{
  const contentLength=Number(req.headers.get("content-length")||0);
  if(contentLength>90000)throw Error("Too large");
  const stream=req.body?.getReader();if(!stream)throw Error("Missing body");
  const decoder=new TextDecoder("utf-8",{fatal:true});let total=0,input="";
  for(;;){const {done,value}=await stream.read();if(done)break;total+=value.byteLength;if(total>90000){await stream.cancel();throw Error("Too large")}input+=decoder.decode(value,{stream:true})}
  input+=decoder.decode();body=JSON.parse(input);
 }catch{return new Response(JSON.stringify({error:"invalid_request"}),{status:400,headers:h})}
 const result=await handle({token:authorization.slice(7),body});
 return new Response(JSON.stringify(result.body),{status:result.status,headers:h});
});
