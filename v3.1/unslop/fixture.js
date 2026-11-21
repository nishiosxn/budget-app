(()=>{'use strict';
const cats=[['fast','Restaurants / fast-food','expense'],['food','Courses','expense'],['home','Maison / entretien','expense'],['salary','Salaire','income'],['save','Épargne','saving'],['empty','Atelier Mecha','expense']].map(([id,name,kind],i)=>({id,name,kind,owner:'B',createdFrom:'2026-01',hiddenMonths:[],uuid:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`}));
const today=new Date().toLocaleDateString('sv-SE');const year=Number(today.slice(0,4));
const ctx={today,firstMonth:`${year-1}-01`,lastMonth:`${year+2}-12`,solo:true,actor:'B',members:{B:'Camille'},categories:cats};const quota={units:0,requests:0};
const ok=body=>({ok:true,status:200,body});
async function request(path,options={}){
 if(path.startsWith('/auth/v1/'))return ok({access_token:'simulation-locale',user:{id:'20000000-0000-4000-8000-000000000000'}});
 if(path.startsWith('/rest/v1/household_members'))return ok([{household_id:'30000000-0000-4000-8000-000000000000',slot:'B'}]);
 if(path.startsWith('/rest/v1/categories'))return ok(cats.map(c=>({id:c.uuid,legacy_id:c.id,name:c.name,type:c.kind==='income'?'income':'expense',is_saving:c.kind==='saving',owner_slot:'B',created_from:c.createdFrom,excluded_months:[]})));
 if(path.startsWith('/rest/v1/budgets'))return ok([{month:today.slice(0,7)+'-01',planned_amount:100,scope:'forward'}]);
 if(path.startsWith('/rest/v1/transactions')||path.startsWith('/rest/v1/recurrences'))return ok([]);
 if(path==='/functions/v1/smart-assistant'){
  let body={};try{body=JSON.parse(options.body||'{}')}catch{return {ok:false,status:400,body:{error:'invalid_request'}}}
  if(body.action==='usage')return ok({quota});
  if(body.action)return {ok:false,status:403,body:{error:'confirm_not_supported'}};
  const core=globalThis.SmartBudgetAssistantCore,parsed=core.quickCommand(body.command,ctx)||core.quickExpense(body.command,ctx);
  if(!parsed?.ok)return {ok:false,status:422,body:{error:'invalid_model_result'}};
  const v=parsed.value;return ok({result:v,context:ctx,planPreviews:(v.operations||[]).flatMap((o,index)=>o.kind==='plan'?[{index,beforeCents:10000,afterCents:core.resolvePlanAmount(o,10000)?.afterCents}]:[]),metering:{source:'local-rules'},quota});
 }
 return {ok:false,status:403,body:{error:'offline_only'}};
}
globalThis.UnslopFixture=Object.freeze({request});})();
const PILOT_PUBLIC_KEY="simulation";

