import fs from "node:fs/promises";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {spawn,execFileSync} from "node:child_process";
import {setTimeout as wait} from "node:timers/promises";
import {resolve,sep,extname} from "node:path";

export async function connected(t,{baseline=false}={}){
 const status=JSON.parse(await fs.readFile(process.env.SB_STACK_STATUS,"utf8"));
 const origin="http://127.0.0.1:54321";
 const edge="http://127.0.0.1:8000";
 assert.equal(status.API_URL,origin,"A disposable local Supabase stack is required");
 assert.match(status.DB_URL,/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres$/);
 assert.ok(status.ANON_KEY&&status.SERVICE_ROLE_KEY&&status.ANON_KEY!==status.SERVICE_ROLE_KEY);
 const {chromium}=await import(pathToFileURL(process.env.SB_TEST_PLAYWRIGHT));
 const browser=await chromium.launch();
 t.after(()=>browser.close());
 const prefix=randomUUID();
 const synthetic=label=>({email:label+"-"+prefix+"@example.test",password:randomUUID()+"Bb!7"});
 // Only the verified loopback disposable DB is eligible for fixture enrollment.
 const sql=statement=>execFileSync("psql",[status.DB_URL,"-X","-v","ON_ERROR_STOP=1","-c",statement],{stdio:"pipe"});
 const uuid=id=>{assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);return "'"+id+"'::uuid"};
 const setBuilderPilot=(id,enabled=true)=>sql(enabled
  ?"insert into private.v31_pilot_builder_users(user_id) values("+uuid(id)+") on conflict do nothing"
  :"delete from private.v31_pilot_builder_users where user_id="+uuid(id));
 const users=[];
 for(const label of ["owner","partner","outsider"]){
  const credentials=synthetic(label);
  const r=await fetch(origin+"/auth/v1/admin/users",{method:"POST",headers:{
   apikey:status.SERVICE_ROLE_KEY,Authorization:"Bearer "+status.SERVICE_ROLE_KEY,"Content-Type":"application/json"
  },body:JSON.stringify({...credentials,email_confirm:true})});
  assert.ok(r.ok,"local Auth account creation returned "+r.status);
  const data=await r.json();
  assert.ok(data.id);
  users.push({...credentials,id:data.id});
  if(!baseline)setBuilderPilot(data.id);
 }

 async function session(user){
  const ctx=await browser.newContext({serviceWorkers:"block",reducedMotion:"reduce"});
  let dropAction=null;
  let legacyLogin=false;
  // All network access from the browser stays within the disposable stack.
  await ctx.route("**/*",async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(legacyLogin&&url.pathname==="/auth/v1/token"&&route.request().method()==="POST"){
    const body=route.request().postDataJSON();
    if(body?.email==="testtest@id.budget-foyer.example.com")return route.continue({postData:JSON.stringify({...body,email:user.email})});
   }
   if(!["/__assistant_for_test","/functions/v1/smart-assistant"].includes(url.pathname))return route.continue();
   // Same-origin bridge to the real local Edge process, without modifying its production CORS policy.
   const headers=await route.request().allHeaders();
   delete headers.origin;delete headers.host;
   const response=await route.fetch({url:edge,headers,maxRedirects:0});
   if(dropAction==="*"||dropAction&&route.request().postDataJSON()?.action===dropAction){
    dropAction=null;return route.abort("connectionreset");
   }
   return route.fulfill({response});
  });
  const page=await ctx.newPage();
  await page.goto(origin+"/auth/v1/health");
  const call=(path,options={})=>page.evaluate(async ({path,options,anon})=>{
   const auth=JSON.parse(sessionStorage.getItem("test-session")||"null");
   const r=await fetch(path,{method:options.method||"GET",headers:{apikey:anon,
    ...(auth?{Authorization:"Bearer "+auth.access_token}:{}),"Content-Type":"application/json",
    ...(options.omitSyncVersion?{}:{"x-smart-budget-sync-version":"20261116-hf1"}),...(options.headers||{})},
    ...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
   const txt=await r.text();
   return {ok:r.ok,status:r.status,data:txt?JSON.parse(txt):null};
  },{path,options,anon:status.ANON_KEY});
  async function login(){
   const auth=await call("/auth/v1/token?grant_type=password",{method:"POST",body:{email:user.email,password:user.password}});
   assert.ok(auth.ok,"local Auth login returned "+auth.status);
   assert.equal(auth.data.user.id,user.id);
   await page.evaluate(auth=>sessionStorage.setItem("test-session",JSON.stringify(auth)),auth.data);
   const verified=await call("/auth/v1/user");
   assert.equal(verified.data.id,user.id);
  }
  async function logout(){
   const r=await call("/auth/v1/logout?scope=local",{method:"POST"});
   assert.ok(r.ok,"local Auth logout returned "+r.status);
   await page.evaluate(()=>sessionStorage.removeItem("test-session"));
   assert.equal((await call("/auth/v1/user")).ok,false);
  }
  await login();
  let appRoutes=false;
  async function openApp(h,path="",fixtureRoot=".",{historicalLogin=false}={}){
   legacyLogin=historicalLogin;
   const app=origin+"/__app/";
   if(!appRoutes){
    const sdk=await fs.readFile(process.env.SB_TEST_SDK);
    const root=resolve(fixtureRoot);
    const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
     ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",
     ".ico":"image/x-icon",".json":"application/json",".webmanifest":"application/manifest+json"};
    await ctx.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js",
     route=>route.fulfill({contentType:types[".js"],body:sdk}));
    await ctx.route(app+"**",async route=>{
     const url=new URL(route.request().url()),relative=decodeURIComponent(url.pathname.slice("/__app/".length));
     const file=resolve(root,relative.endsWith("/")||!relative?relative+"index.html":relative);
     if(!file.startsWith(root+sep)||route.request().method()!=="GET")return route.abort();
     try{
      let body=await fs.readFile(file);
      const config={
       "js/supabase-config.js":{SUPABASE_PROJECT_URL:origin},
       "js/supabase-client.js":{SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY},
       "preview/assistant/live/config.js":{PILOT_URL:origin,PILOT_PUBLIC_KEY:status.ANON_KEY}
      }[relative];
      if(config){
       body=body.toString("utf8");
       for(const [name,value] of Object.entries(config))
        body=body.replace(new RegExp("const "+name+'\\s*=\\s*"[^"]*"'),"const "+name+" = "+JSON.stringify(value));
      }
      return route.fulfill({contentType:types[extname(file)]||"application/octet-stream",body});
     }catch{return route.fulfill({status:404,body:"Missing local fixture asset"});}
    });
    appRoutes=true;
   }
   await page.evaluate(({h})=>{
    const session=JSON.parse(sessionStorage.getItem("test-session"));
    localStorage.setItem("sb-127-auth-token",JSON.stringify(session));
    localStorage.setItem("budget-foyer-v2.5-active-household",h);
   },{h});
   await page.goto(app+path);
   return page;
  }
  return {call,context:ctx,page,user,login,logout,
   openApp,
   rpc:(name,body)=>call("/rest/v1/rpc/"+name,{method:"POST",body}),
   assistant:body=>call("/__assistant_for_test",{method:"POST",body}),
   dropNextAssistantResponse:(action="*")=>{dropAction=action},
   watchTransactions:h=>page.evaluate(({anon,h})=>new Promise((resolve,reject)=>{
    const jwt=JSON.parse(sessionStorage.getItem("test-session")).access_token;
    const url=new URL("/realtime/v1/websocket",location.href);url.protocol="ws:";
    url.search=new URLSearchParams({apikey:anon,vsn:"1.0.0"});
    const socket=new WebSocket(url),topic="realtime:pilot-test";
    globalThis.fixtureChanges=[];globalThis.fixtureRealtimeEvents=[];
    const timeout=setTimeout(()=>reject(Error("Realtime subscription timeout")),15000);
    socket.onerror=()=>reject(Error("Realtime socket unavailable"));
    socket.onopen=()=>socket.send(JSON.stringify({topic,event:"phx_join",ref:"1",payload:{access_token:jwt,
     config:{private:false,broadcast:{ack:false,self:false},presence:{enabled:false,key:""},
      postgres_changes:[{event:"INSERT",schema:"public",table:"transactions",filter:"household_id=eq."+h}]}}}));
    socket.onmessage=e=>{
     const msg=JSON.parse(e.data);
     globalThis.fixtureRealtimeEvents.push([msg.event,msg.payload?.status,msg.payload?.extension,msg.payload?.message]);
     if(msg.event==="phx_reply"&&msg.ref==="1"){
      if(msg.payload.status!=="ok"){clearTimeout(timeout);reject(Error("Realtime join rejected"))}
     }
     if(msg.event==="system"&&msg.payload.extension==="postgres_changes"){
      clearTimeout(timeout);
      if(msg.payload.status==="ok")resolve();else reject(Error("Realtime PostgreSQL subscription rejected"));
     }
     if(msg.event==="postgres_changes"||msg.event==="INSERT")
      globalThis.fixtureChanges.push(msg.payload.data?.record||msg.payload.record);
    };
   }),{anon:status.ANON_KEY,h})};
 }
 async function startAssistant(h,actors,{legacy=false}={}){
  if(legacy){assert.equal(actors.length,1);assert.ok(process.env.SB_TEST_EDGE30_ROOT,"Pinned v30 source is required");}
  if(!legacy)for(const id of actors)sql("insert into private.v31_pilot_rule_members(household_id,user_id) values("+uuid(h)+","+uuid(id)+") on conflict do nothing");
  const env={...process.env,SUPABASE_URL:origin,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,
   SMART_ASSISTANT_SUPABASE_PUBLISHABLE:status.ANON_KEY,SMART_ASSISTANT_MODEL:"@cf/google/gemma-4-26b-a4b-it",
   SMART_ASSISTANT_ENABLED:"true",SMART_ASSISTANT_EXTENDED_MOVEMENTS:"true",SMART_ASSISTANT_ATOMIC_REVIEW:"true",
   SMART_ASSISTANT_TEST_HOUSEHOLDS:h,SMART_ASSISTANT_TEST_USERS:actors.join(","),
   // v30 requires nonempty provider config even for local commands. These are deliberately fake;
   // Deno network permissions below deny all access to the real provider.
   SMART_ASSISTANT_FREE_PLAN_CONFIRMED:legacy?"true":"false",SMART_ASSISTANT_CF_ACCOUNT_ID:legacy?"00000000000000000000000000000000":"",SMART_ASSISTANT_CF_TOKEN:legacy?"fixture-only-not-a-credential":""};
  const entry=legacy?resolve(process.env.SB_TEST_EDGE30_ROOT,"supabase/functions/smart-assistant/index.ts"):"supabase/functions/smart-assistant/index.ts";
  const processHandle=spawn("deno",["run","--allow-env","--allow-net=0.0.0.0:8000,127.0.0.1:54321",entry],
   {env,stdio:"ignore"});
  let failed=false;
  processHandle.on("error",()=>{failed=true});
  t.after(()=>processHandle.kill());
  for(let i=0;i<50&&!failed&&processHandle.exitCode===null;i++){
   if(await fetch(edge,{signal:AbortSignal.timeout(1000)}).then(r=>r.status===405,()=>false))return;
   await wait(150);
  }
  throw Error("Disposable Edge Function failed to start.");
 }
 function setAdmin(id,enabled=true){
  sql(enabled?"insert into public.app_admins(user_id) values("+uuid(id)+") on conflict do nothing":"delete from public.app_admins where user_id="+uuid(id));
 }
 function upgradeV31(){
  assert.ok(baseline,"Only the baseline fixture can be upgraded here");
  execFileSync("psql",[status.DB_URL,"-X","-v","ON_ERROR_STOP=1","-f","scripts/connected-test/upgrade-v31.sql"],{stdio:"pipe"});
 }
 return {origin,users,session,startAssistant,setBuilderPilot,setAdmin,upgradeV31};
}
