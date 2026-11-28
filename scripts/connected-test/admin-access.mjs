import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {spawn} from "node:child_process";
import {setTimeout as wait} from "node:timers/promises";
import {connected} from "./harness.mjs";
import {completeSetup} from "./financial-fixture.mjs";

test("real admin Edge requires authenticated operator role and denies privilege escalation",async t=>{
 const env=await connected(t);
 const status=JSON.parse(await fs.readFile(process.env.SB_STACK_STATUS,"utf8"));
 assert.equal(status.API_URL,"http://127.0.0.1:54321");
 const [operator,second,ordinary]=await Promise.all(env.users.map(u=>env.session(u)));
 const {h}=await completeSetup(ordinary,"solo");
 env.setAdmin(operator.user.id);env.setAdmin(second.user.id);
 const edge="http://127.0.0.1:8000";
 const child=spawn("deno",["run","--cached-only","--config","supabase/functions/admin-api/deno.json","--allow-env","--allow-net=0.0.0.0:8000,127.0.0.1:54321","supabase/functions/admin-api/index.ts"],{
  env:{...process.env,SUPABASE_URL:env.origin,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY},stdio:["ignore","ignore","inherit"]
 });
 t.after(()=>child.kill());
 let ready=false;
 for(let i=0;i<60&&child.exitCode===null;i++){
  ready=await fetch(edge,{signal:AbortSignal.timeout(1000)}).then(r=>r.status===405,()=>false);
  if(ready)break;
  await wait(200);
 }
 assert.ok(ready,"Local admin Edge did not start");
 const call=async(session,body,origin="https://nishiosxn.github.io")=>{
  const token=session?await session.page.evaluate(()=>JSON.parse(sessionStorage.getItem("test-session")).access_token):null;
  const response=await fetch(edge,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body),redirect:"error"});
  return {status:response.status,data:await response.json()};
 };
 assert.equal((await call(null,{action:"list"})).status,401);
 assert.equal((await call(ordinary,{action:"list"})).status,403);
 assert.equal((await call(ordinary,{action:"delete_household",household_id:h})).status,403);
 assert.equal((await call(operator,{action:"list"},"https://unapproved.example.test")).status,403);
 const overview=await call(operator,{action:"list"});
 assert.equal(overview.status,200);
 assert.ok(overview.data.users.some(x=>x.id===operator.user.id&&x.is_admin));
 assert.ok(overview.data.households.some(x=>x.id===h));
 for(const user of [operator.user,second.user]){
  assert.notEqual((await call(operator,{action:"set_user_disabled",user_id:user.id,disabled:true})).status,200);
  assert.notEqual((await call(operator,{action:"delete_user",user_id:user.id})).status,200);
 }
 for(const table of ["app_admins","admin_audit_log"]){
  const r=await ordinary.call("/rest/v1/"+table);
  assert.ok(!r.ok||Array.isArray(r.data)&&r.data.length===0);
 }
 assert.equal((await ordinary.call("/rest/v1/app_admins",{method:"POST",body:{user_id:ordinary.user.id}})).ok,false);
 env.setAdmin(operator.user.id,false);
 assert.equal((await call(operator,{action:"list"})).status,403);
 assert.equal((await call(second,{action:"list"})).status,200);
 assert.equal((await ordinary.call("/rest/v1/households?id=eq."+h)).data.length,1);
});
