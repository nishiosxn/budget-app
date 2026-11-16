import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadOverview(){
 const listeners={}, actions=[], root={
  innerHTML:"",
  addEventListener(name,fn){listeners[name]=fn;}
 };
 const categories=[
  {id:"music",name:"Musique",section:"Abonnements",saving:false,budget:14},
  {id:"video",name:"Vidéo",section:"Abonnements",saving:false,budget:9},
  {id:"rent",name:"Loyer",section:"Obligatoires",saving:false,budget:500},
  {id:"savings",name:"Épargne",section:"Abonnements",saving:true,budget:60}
 ];
 const context=vm.createContext({
  document:{getElementById:id=>id==="subscriptionsOverview"?root:null},
  visibleExpenseCategories:()=>categories,
  catById:id=>categories.find(c=>c.id===id)||null,
  transactionOwner:t=>t.owner||"common",
  ownerLabel:owner=>owner,
  euro:value=>Number(value).toFixed(2)+" €",
  escapeHtml:value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"),
  openRecurrenceEdit:id=>actions.push({kind:"edit",id}),
  openRecurrenceDelete:id=>actions.push({kind:"stop",id})
 });
 vm.runInContext(fs.readFileSync("js/subscriptions-overview.js","utf8"),context);
 const transactions=[
  {sourceId:"music-1",category:"music",type:"expense",recurringOccurrence:true,amount:11,date:"2026-11-10",owner:"B",label:"Musique"},
  {sourceId:"rent-1",category:"rent",type:"expense",recurringOccurrence:true,amount:500,date:"2026-11-02",owner:"common",label:"Loyer"},
  {id:"one-shot",category:"video",type:"expense",amount:9,date:"2026-11-08",owner:"A"},
  {sourceId:"salary-1",category:"wages",type:"income",recurringOccurrence:true,amount:800,date:"2026-11-01"}
 ];
 return {context,root,listeners,actions,categories,transactions};
}
test("le tableau distingue budgets et dépenses réellement récurrentes",()=>{
 const x=loadOverview();
 const data=x.context.subscriptionOverviewData(x.categories,x.transactions);
 assert.equal(data.subscriptionCount,2);
 assert.equal(data.occurrenceCount,2);
 assert.equal(data.budgetAmount,23);
 assert.equal(data.scheduledAmount,511);
 assert.equal(data.groups[0].occurrences.length,1);
 assert.equal(data.groups[1].occurrences.length,0);
 assert.equal(data.other.length,1);
});
test("une opération ponctuelle n'est jamais présentée comme un abonnement récurrent",()=>{
 const x=loadOverview();
 x.context.renderSubscriptionsOverview({tx:x.transactions,expMap:{music:11,video:9,rent:500}});
 assert.match(x.root.innerHTML,/Aucune opération récurrente configurée/);
 assert.match(x.root.innerHTML,/11\.00 €|11,00 €/);
 assert.doesNotMatch(x.root.innerHTML,/data-subscription-edit="one-shot"/);
 assert.match(x.root.innerHTML,/ne prouvent pas/);
});
test("boutons : seulement ouvrir les modales existantes, sans mutation des opérations",()=>{
 const x=loadOverview();
 const original=JSON.stringify(x.transactions);
 x.context.renderSubscriptionsOverview({tx:x.transactions,expMap:{}});
 const edit={dataset:{subscriptionEdit:"music-1"}};
 x.listeners.click({target:{closest:selector=>selector==="[data-subscription-edit]"?edit:null}});
 const stop={dataset:{subscriptionStop:"rent-1"}};
 x.listeners.click({target:{closest:selector=>selector==="[data-subscription-stop]"?stop:null}});
 assert.deepEqual(x.actions,[{kind:"edit",id:"music-1"},{kind:"stop",id:"rent-1"}]);
 assert.equal(JSON.stringify(x.transactions),original);
});
