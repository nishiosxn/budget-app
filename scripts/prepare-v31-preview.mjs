// Build-only, never deploys. Read immutable tracked blobs, not the working tree.
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const entries=["index.html","assistant/index.html","admin/index.html"];
const required=[
 ...entries,"manifest.webmanifest","sw.js","icons/icon.svg","icons/favicon.ico","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png",
 "assistant/shared-rules.js","assistant/session.js","admin/admin.css","admin/admin.js",
 "js/supabase-config.js","js/supabase-client.js","js/assistant-core.js","js/assistant-planner.js","js/assistant-voice.js","js/assistant-ui.js",
 "preview/assistant/preview.css",
 ...["live.css","design-system.css","native-dark.css","unslop.css","category-rules.js","config.js","review-editor.js","interaction.js","appearance.js","confirmation.js","live-ui.js"].map(x=>"preview/assistant/live/"+x)
];
const fixed=new Set(required);
const textFile=p=>/\.(?:html|js|css|svg|webmanifest)$/i.test(p);
export const allowedPath=p=>fixed.has(p)||/^(?:js\/[a-zA-Z0-9_-]+\.js|css\/[a-zA-Z0-9_-]+\.css|icons\/[a-zA-Z0-9_.-]+\.(?:svg|png|ico|webp))$/.test(p);
const sha=b=>createHash("sha256").update(b).digest("hex");
const inside=(p,root)=>p===root||p.startsWith(root+path.sep);
const fixtureUrl="http://127.0.0.1:54321";
const fixtureKey="sb_publishable_preview_fixture_only";
const replacements={
 "js/supabase-config.js":{SUPABASE_PROJECT_URL:fixtureUrl},
 "js/supabase-client.js":{SUPABASE_PUBLISHABLE_KEY:fixtureKey},
 "preview/assistant/live/config.js":{PILOT_URL:fixtureUrl,PILOT_PUBLIC_KEY:fixtureKey}
};
export function sanitize(p,bytes){
 if(!textFile(p))return bytes;
 let s=bytes.toString("utf8");
 for(const [name,value] of Object.entries(replacements[p]||{})){
  const re=new RegExp("\\bconst\\s+"+name+"\\s*=\\s*([\"'])([^\"'\\r\\n]*)\\1","g");
  if([...s.matchAll(re)].length!==1)throw Error("Configuration declaration missing or ambiguous: "+p+" "+name);
  s=s.replace(re,()=> "const "+name+" = "+JSON.stringify(value));
 }
 // Reject remaining hosted Supabase origins, including unexpected hardcoded fallbacks.
 if(/https?:\/\/[a-z0-9.-]+\.supabase\.co\b/i.test(s))throw Error("Hosted Supabase URL remains in "+p);
 return Buffer.from(s);
}
export function checkReference(from,ref,files){
 ref=ref.trim();
 if(!ref||ref.startsWith("#")||/^(?:https:|data:|mailto:|tel:)/i.test(ref))return;
 if(/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(ref))throw Error("Non-relative preview resource in "+from);
 const local=decodeURIComponent(ref.split(/[?#]/)[0]);
 if(!local)return;
 let resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),local));
 if(resolved==="."||resolved.endsWith("/"))resolved=path.posix.join(resolved,"index.html");
 if(resolved===".."||resolved.startsWith("../")||!files.has(resolved))throw Error("Missing preview dependency: "+from+" -> "+ref+" ("+resolved+")");
}
export function buildPreview({root=process.cwd(),output}={}){
 root=fs.realpathSync(root);
 if(!output)throw Error("New output directory outside checkout required");
 const parent=fs.realpathSync(path.dirname(path.resolve(output)));
 const out=path.join(parent,path.basename(output));
 if(inside(out,root)||fs.existsSync(out))throw Error("Output must be a new directory outside checkout");
 const git=(args,encoding)=>execFileSync("git",args,{cwd:root,encoding,maxBuffer:32*1024*1024});
 const sourceSha=git(["rev-parse","HEAD"],"utf8").trim();
 if(!/^[0-9a-f]{40}$/.test(sourceSha))throw Error("Invalid source SHA");
 const listing=git(["ls-tree","-rz","--full-tree",sourceSha],"utf8").split("\0").filter(Boolean);
 const files=new Map();
 for(const line of listing){
  const m=line.match(/^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/s);
  if(!m)throw Error("Invalid tracked entry");
  const [,mode,type,blob,p]=m;
  if(!allowedPath(p))continue;
  if(type!=="blob"||!["100644","100755"].includes(mode))throw Error("Non-regular preview file: "+p);
  files.set(p,sanitize(p,git(["cat-file","blob",blob])));
 }
 for(const p of required)if(!files.has(p))throw Error("Missing required file: "+p);
 for(const [p,bytes] of files){
  if(!/\.(html|css)$/.test(p))continue;
  const s=bytes.toString("utf8");
  const refs=p.endsWith(".html")?[...s.matchAll(/\b(?:src|href|action)\s*=\s*["']([^"'<>]+)["']/gi)].map(m=>m[1]):[...s.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(m=>m[1]);
  for(const ref of refs)checkReference(p,ref,files);
 }
 const manifest=JSON.parse(files.get("manifest.webmanifest").toString("utf8"));
 for(const ref of [manifest.start_url,manifest.scope,manifest.id,...manifest.icons.map(x=>x.src)])checkReference("manifest.webmanifest",ref,files);
 if(manifest.scope!=="./"||manifest.start_url!=="./"||manifest.id!=="./")throw Error("Preview PWA scope must remain relative");
 const hashes=Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b)).map(([p,b])=>[p,sha(b)]));
 const report={sourceSha,kind:"isolated-preview-package",target:"loopback-fixture-only",readyForHostedUse:false,deploy:false,files:hashes,packageSha256:sha(JSON.stringify(hashes))};
 fs.mkdirSync(out);
 try{
  for(const [p,b] of files){const dest=path.join(out,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);}
  fs.writeFileSync(path.join(out,"preview-source.json"),JSON.stringify(report,null,2)+"\n");
 }catch(error){fs.rmSync(out,{recursive:true,force:true});throw error;}
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error("Expected exactly one new output directory");
 const report=buildPreview({output:process.argv[2]});
 console.log(JSON.stringify({sourceSha:report.sourceSha,target:report.target,files:Object.keys(report.files).length,packageSha256:report.packageSha256,deploy:false},null,2));
}
