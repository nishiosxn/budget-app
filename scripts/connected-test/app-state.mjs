import fs from "node:fs";
import vm from "node:vm";

export function apiClient(session){
 return {from(table){
  let method="GET",body;
  const parameters=new URLSearchParams(),headers={};
  const query={
   eq(key,value){parameters.set(key,"eq."+value);return query},
   order(key){parameters.set("order",key+".asc");return query},
   select(columns){parameters.set("select",columns);if(method!=="GET")headers.Prefer="return=representation";return query},
   insert(row){method="POST";body=row;return query},
   update(row){method="PATCH";body=row;return query},
   single(){headers.Accept="application/vnd.pgrst.object+json";return query},
   then(resolve,reject){
    return session.call("/rest/v1/"+table+"?"+parameters,{method,body,headers})
     .then(r=>r.ok?{data:r.data,error:null}:{data:null,error:r.data},reject).then(resolve,reject);
   }
  };
  return query;
 }};
}

export function appState(session,h,role){
 let undo;
 const node={dataset:{},addEventListener(){},querySelectorAll:()=>[]};
 const context=vm.createContext({
  document:{getElementById:()=>node,querySelectorAll:()=>[],addEventListener(){}},
  window:{addEventListener(){}},
  localStorage:{length:0},
  navigator:{onLine:true},activeHouseholdId:h,activeMembership:{role},cloudSession:{user:session.user},
  cloudApplyingRemote:false,cloudSyncReady:true,cloudPushInProgress:false,cloudPushTimer:null,
  cloudIgnoreRealtimeUntil:0,cloudHouseholds:[],cloudClient:apiClient(session),
  cloudMonthDate:key=>key+"-01",ownerToSlot:owner=>owner==="common"?null:owner,slotToOwner:slot=>slot||"common",
  categorySectionOf:category=>category.section,transactionDateForSelectedMonth:()=>run("monthKey(state.selectedMonth)+'-15'"),
  render(){},reloadUiFromState:()=>run("applyCategoryState()"),
  setCloudStatus(){},updateCloudHouseholdUi(){},setTimeout:()=>1,clearTimeout(){},
  showUndoToast:(_message,action)=>{undo=action}
 });
 const run=code=>vm.runInContext(code,context);
 for(const file of ["config","data","storage","calculations","categories","category-controls",
                      "category-distribution","cloud-state-core","cloud-save","cloud-sync-v25","cloud-load"]){
  vm.runInContext(fs.readFileSync("js/"+file+".js","utf8"),context,{filename:file+".js"});
 }
 return {run,pull:()=>run("cloudLoadState()"),push:()=>run("cloudPushLocalStateV25({force:true})"),
  undo:()=>undo?.(),month:label=>{context.monthLabel=label;run("state.selectedMonth=monthLabel")}};
}
