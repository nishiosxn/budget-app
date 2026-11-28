import assert from "node:assert/strict";
import test from "node:test";
import {createServer} from "node:http";
import {readFile,writeFile} from "node:fs/promises";
import {resolve,sep,extname,join} from "node:path";
import {pathToFileURL} from "node:url";

const contentTypes={".html":"text/html",".js":"text/javascript",".css":"text/css",
 ".webmanifest":"application/manifest+json",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon"};
const labFiles=["assistant-core","assistant-planner","assistant-voice","assistant-ui"];

test("the PWA updates on a local origin, purges old cache, and stays cloud-only offline",async t=>{
 const root=resolve("."),sdk=await readFile(process.env.SB_TEST_SDK);
 let revision=1,networkDown=false;
 const server=createServer(async(req,res)=>{
  if(networkDown){res.destroy();return}
  const pathname=new URL(req.url,"http://localhost").pathname;
  function send(type,body){
   res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store","X-Fixture-Revision":String(revision)});
   res.end(body);
  }
  if(pathname==="/seed")return send("text/html","<!doctype html><title>Local test origin</title>");
  if(pathname==="/sdk.js")return send("text/javascript",sdk);
  if(pathname==="/js/supabase-config.js")return send("text/javascript","const SUPABASE_PROJECT_URL = location.origin;");
  if(req.method!=="GET"){res.writeHead(405);res.end();return}
  const file=resolve(root,"."+(pathname==="/"?"/index.html":pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
  try{
   let body=await readFile(file);
   if(pathname==="/")body=body.toString("utf8").replace("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js","/sdk.js");
   if(pathname==="/sw.js"&&revision===2)body=body.toString("utf8")+"\n// Second disposable worker revision.\n";
   send(contentTypes[extname(file)]||"application/octet-stream",body);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 t.after(()=>server.close());
 const origin="http://127.0.0.1:"+server.address().port;
 const {chromium}=await import(pathToFileURL(process.env.SB_TEST_PLAYWRIGHT));
 const browser=await chromium.launch({args:["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"]});
 t.after(()=>browser.close());
 const results=[];
 for(let attempt=0;attempt<3;attempt++){
  const ctx=await browser.newContext({reducedMotion:"reduce"}),page=await ctx.newPage();
  if(attempt===0){
   await page.goto(origin+"/seed");
   await page.evaluate(async()=>{
    await caches.open("budget-foyer-v25-pwa-fixture-old");
    await caches.open("unrelated-fixture-cache");
   });
  }
  await page.goto(origin+"/");
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const timing=await page.evaluate(()=>{
   const navigation=performance.getEntriesByType("navigation")[0],resources=performance.getEntriesByType("resource");
   return {domMs:navigation.domContentLoadedEventEnd,loadMs:navigation.loadEventEnd,
    resources:resources.map(entry=>({path:new URL(entry.name).pathname,bytes:entry.decodedBodySize}))};
  });
  assert.ok(timing.loadMs>0);
  assert.ok(labFiles.every(name=>timing.resources.every(resource=>resource.path!=="/js/"+name+".js")));
  assert.match(await page.locator(".settings-version").textContent(),/^V3\.1 \(préversion\)/);
  results.push(timing);
  if(attempt!==0){await ctx.close();continue}
  assert.deepEqual(await page.evaluate(()=>caches.keys()),["unrelated-fixture-cache"]);
  assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.ready).updateViaCache),"none");

  const cdp=await ctx.newCDPSession(page);
  const manifest=await cdp.send("Page.getAppManifest");
  assert.deepEqual(manifest.errors,[]);
  const installability=await cdp.send("Page.getInstallabilityErrors");
  const manifestInfo=JSON.parse(manifest.data);
  assert.equal(manifestInfo.start_url,"./");
  assert.equal(manifestInfo.scope,"./");
  assert.equal(manifestInfo.display,"standalone");
  for(const file of manifestInfo.icons){
   assert.equal((await page.request.get(origin+"/"+file.src)).status(),200);
  }
  timing.installability=installability.installabilityErrors;
  await cdp.detach();
  await page.evaluate(()=>{
   document.querySelector(".assistant-local").open=true;
  });
  await page.waitForFunction(()=>!document.getElementById("sbAssistantForm").inert);
  assert.ok(await page.evaluate(()=>typeof SmartBudgetAssistantCore.validateResult==="function"));
  await page.evaluate(()=>document.querySelector(".assistant-local [data-assistant-suggestion]").click());
  assert.notEqual(await page.locator("#sbAssistantInput").inputValue(),"");

  revision=2;
  await page.evaluate(async()=>{
   const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener("controllerchange",resolve,{once:true}));
   await (await navigator.serviceWorker.ready).update();
   await changed;
  });
  assert.equal(await page.evaluate(async()=>(await fetch("index.html",{cache:"no-store"})).headers.get("X-Fixture-Revision")),"2");
  await ctx.setOffline(true);
  // Chromium can keep the worker connected to loopback despite page emulation.
  // Close the test origin's sockets as well to exercise a real transport failure.
  networkDown=true;
  assert.equal(await page.evaluate(()=>fetch("index.html",{cache:"no-store"}).then(()=>true,()=>false)),false);
  assert.deepEqual(await page.evaluate(()=>caches.keys()),["unrelated-fixture-cache"]);
  networkDown=false;
  await ctx.setOffline(false);
  assert.equal(await page.evaluate(()=>fetch("index.html",{cache:"no-store"}).then(response=>response.ok)),true);
  await ctx.close();
 }
 const deferredBytes=(await Promise.all(labFiles.map(name=>readFile(join(root,"js",name+".js"))))).reduce((sum,bytes)=>sum+bytes.length,0);
 const report={deferredBytes,measurements:results};
 console.log("PWA release metrics "+JSON.stringify({
  deferredBytes,samples:results.map(({domMs,loadMs,resources})=>({domMs,loadMs,count:resources.length,bytes:resources.reduce((sum,resource)=>sum+resource.bytes,0)})),
  installability:results[0].installability
 }));
 if(process.env.SB_VISUAL_OUTPUT)await writeFile(join(process.env.SB_VISUAL_OUTPUT,"pwa-performance.json"),JSON.stringify(report,null,2));
});
