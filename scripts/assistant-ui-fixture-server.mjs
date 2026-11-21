// Local UI fixture server. No external requests, storage, or real credentials.
// Run from the repository root: node scripts/assistant-ui-fixture-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),box={}; vm.createContext(box);vm.runInContext(fs.readFileSync('js/assistant-core.js','utf8'),box);
const core=box.SmartBudgetAssistantCore;
const categories=[['fast','Restaurants / fast-food','expense'],['food','Courses','expense'],['home','Maison / entretien','expense'],['salary','Salaire','income'],['save','Épargne','saving'],['empty','Atelier Mecha','expense']].map(([id,name,kind],i)=>({id,name,kind,owner:'B',createdFrom:'2026-01',hiddenMonths:[],uuid:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`}));
const ctx={today:'2026-11-21',firstMonth:'2026-01',lastMonth:'2028-12',solo:true,actor:'B',members:{B:'Camille'},categories};
const quota={units:1662,requests:8};
const send=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
 if(req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;let body;try{body=JSON.parse(raw)}catch{return send(res,{error:'invalid_json'},400)}
  if(pathname==='/auth/v1/token')return send(res,{access_token:'local-fixture-only',user:{id:'20000000-0000-4000-8000-000000000000'}});
  if(pathname!=='/functions/v1/smart-assistant')return send(res,{error:'fixture_only'},404);
  if(body.action==='usage')return send(res,{quota});
  if(body.action?.startsWith('confirm'))return send(res,{commit:{requestId:body.requestId,kind:body.action==='confirm_category'?'category':'batch',count:body.draft?.operations?.length||1,expenseCreated:true,name:body.draft?.name}});
  const parsed=core.quickCommand(body.command,ctx)||core.quickExpense(body.command,ctx);
  if(!parsed?.ok)return send(res,{error:'invalid_model_result'},422);
  return send(res,{result:parsed.value,context:ctx,planPreviews:(parsed.value.operations||[]).flatMap((o,index)=>o.kind==='plan'?[{index,beforeCents:10000,afterCents:core.resolvePlanAmount(o,10000)?.afterCents}]:[]),metering:{source:'local-rules'},quota});
 }
 if(pathname.startsWith('/rest/v1/')){
  if(pathname.endsWith('/household_members'))return send(res,[{household_id:'30000000-0000-4000-8000-000000000000',slot:'B'}]);
  if(pathname.endsWith('/categories'))return send(res,categories.map(c=>({id:c.uuid,legacy_id:c.id,name:c.name,type:c.kind==='income'?'income':'expense',is_saving:c.kind==='saving',owner_slot:'B',created_from:c.createdFrom,excluded_months:[]})));
  if(pathname.endsWith('/budgets'))return send(res,url.searchParams.get('category_id')==='eq.'+categories[5].uuid?[]:[{month:'2026-11-01',planned_amount:100,scope:'forward'}]);
  if(pathname.endsWith('/transactions')||pathname.endsWith('/recurrences'))return send(res,[]);
  return send(res,[],404);
 }
 let name=decodeURIComponent(pathname),before=name.startsWith('/before/');if(before)name=name.slice(7);
 for(const folder of ['js','css','icons'])name=name.replace('/preview/assistant/'+folder+'/', '/'+folder+'/');
 if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return send(res,{},403);
 if(name.endsWith('/live/config.js')){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end('const PILOT_URL=location.origin; const PILOT_PUBLIC_KEY="local-fixture";')}
 try{
  let content=before&&['/preview/assistant/live/index.html','/preview/assistant/live/live-ui.js'].includes(name)?execFileSync('git',['-c','safe.directory='+root,'show','HEAD:'+name.slice(1)],{cwd:root}):fs.readFileSync(file);
  const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
  res.writeHead(200,{'Content-Type':types[ext]||'text/plain','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(8766,'127.0.0.1',()=>console.log('UI fixtures: http://127.0.0.1:8766/preview/assistant/live/ (no external network)'));
