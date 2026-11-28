import test from "node:test";
import assert from "node:assert/strict";
import {allowedPath,sanitize,checkReference} from "./prepare-v31-preview.mjs";
test("preview allowlist excludes backend, docs, secret files and other previews",()=>{
 for(const p of ["index.html","assistant/session.js","preview/assistant/live/config.js","css/style.css","icons/icon.svg"])assert.equal(allowedPath(p),true,p);
 for(const p of ["supabase/functions/smart-assistant/index.ts",".env","js/.env","docs/a.md","preview/assistant/live/index.html","preview/builder/index.html","scripts/test.mjs","js/../secret.js"])assert.equal(allowedPath(p),false,p);
});
test("all three browser configs are replaced, unexpected hosted URL refused",()=>{
 const cases=[
 ["js/supabase-config.js",'const SUPABASE_PROJECT_URL="https://old.supabase.co";',"127.0.0.1"],
 ["js/supabase-client.js",'const SUPABASE_PUBLISHABLE_KEY="old-key";',"sb_publishable_preview_fixture_only"],
 ["preview/assistant/live/config.js",'const PILOT_URL="https://old.supabase.co"; const PILOT_PUBLIC_KEY="old-key";',"127.0.0.1"]
 ];
 for(const [p,s,expected] of cases){const b=sanitize(p,Buffer.from(s)).toString();assert.ok(b.includes(expected));assert.ok(!b.includes("old-key")&&!b.includes("old.supabase.co"));}
 assert.throws(()=>sanitize("js/other.js",Buffer.from('fetch("https://old.supabase.co/rest/v1/x")')),/Hosted Supabase/);
 assert.throws(()=>sanitize("js/supabase-config.js",Buffer.from("const missing=1")),/declaration/);
});
test("relative dependencies cannot escape or silently omit a required asset",()=>{
 const files=new Set(["index.html","assistant/index.html","js/a.js","icons/icon.svg"]);
 for(const [p,r] of [["index.html","assistant/"],["assistant/index.html","../"],["assistant/index.html","../js/a.js?v=1"],["index.html","icons/icon.svg"],["index.html","https://cdn.example.test/x"]])assert.doesNotThrow(()=>checkReference(p,r,files));
 for(const r of ["missing.js","../secret.js","/index.html","http://example.test/x"])assert.throws(()=>checkReference("index.html",r,files));
});
