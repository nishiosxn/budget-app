import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync("supabase/functions/admin-api/index.ts","utf8");
const cors=source.slice(source.indexOf("const allowedOrigins"),source.indexOf("function json("));
const context=vm.createContext({});
vm.runInContext(cors+"\nglobalThis.getHeaders=corsHeaders;globalThis.allowed=isAllowedOrigin;",context);
const headers=context.getHeaders({headers:{get:()=> "https://nishiosxn.github.io"}});
test("admin preflight permits the sync-version and SDK headers",()=>{
 const client=fs.readFileSync("js/supabase-client.js","utf8");
 assert.match(client,/x-smart-budget-sync-version/);
 const allowed=headers["Access-Control-Allow-Headers"].split(",").map(x=>x.trim());
 for(const h of ["authorization","apikey","content-type","x-client-info","x-smart-budget-sync-version","x-retry-count","traceparent","tracestate","baggage"])assert.ok(allowed.includes(h),h);
 assert.equal(headers["Access-Control-Allow-Origin"],"https://nishiosxn.github.io");
 assert.equal(headers["Access-Control-Allow-Methods"],"POST, OPTIONS");
});
test("origin restriction and server-side admin authorization remain",()=>{
 assert.equal(context.allowed("https://untrusted.example"),false);
 assert.equal(context.allowed("http://localhost:8080"),true);
 assert.match(source,/admin\.auth\.getUser\(token\)/);
 assert.match(source,/\.from\("app_admins"\)/);
 assert.match(source,/if \(!role\) return \{ error: "Administrator role required", status: 403 \}/);
});
