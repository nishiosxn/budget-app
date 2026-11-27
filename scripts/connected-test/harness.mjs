import fs from "node:fs/promises";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";

export async function connected(t){
 const status=JSON.parse(await fs.readFile(process.env.SB_STACK_STATUS,"utf8"));
 const origin="http://127.0.0.1:54321";
 assert.equal(status.API_URL,origin,"A disposable local Supabase stack is required");
 assert.match(status.DB_URL,/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres$/);
 assert.ok(status.ANON_KEY&&status.SERVICE_ROLE_KEY&&status.ANON_KEY!==status.SERVICE_ROLE_KEY);
 const {chromium}=await import(pathToFileURL(process.env.SB_TEST_PLAYWRIGHT));
 const browser=await chromium.launch();
 t.after(()=>browser.close());
 const prefix=randomUUID();
 const synthetic=label=>({email:label+"-"+prefix+"@example.test",password:randomUUID()+"Bb!7"});
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
 }

 async function session(user){
  const ctx=await browser.newContext();
  // All network access from the browser stays within the disposable stack.
  await ctx.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await ctx.newPage();
  await page.goto(origin+"/auth/v1/health");
  const call=(path,options={})=>page.evaluate(async ({path,options,anon})=>{
   const auth=JSON.parse(sessionStorage.getItem("test-session")||"null");
   const r=await fetch(path,{method:options.method||"GET",headers:{apikey:anon,
    ...(auth?{Authorization:"Bearer "+auth.access_token}:{}),"Content-Type":"application/json",
    "x-smart-budget-sync-version":"20261116-hf1",...(options.headers||{})},
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
  return {call,context:ctx,page,user,login,logout,
   rpc:(name,body)=>call("/rest/v1/rpc/"+name,{method:"POST",body})};
 }
 return {origin,users,session};
}
