import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function fixture(){
 const nodes=new Map(),listeners=new Map(),timers=new Map();
 let seq=0,saves=0,undo;
 const element=id=>{
  if(!nodes.has(id))nodes.set(id,{
   dataset:{},textContent:"",innerHTML:"",querySelectorAll:()=>[],
   addEventListener(type,fn){
    const key=id+":"+type;
    listeners.set(key,[...(listeners.get(key)||[]),fn]);
   }
  });
  return nodes.get(id);
 };
 const document=element("document");
 document.getElementById=element;
 const state={
  selectedMonth:"Novembre 2026",createdMonth:"2026-10",
  household:{name:"Foyer fictif",personA:"Camille",personB:"Alex",mode:"couple"},
  expensePlanChanges:{music:{month:{"2026-11":{budget:20,owner:"common"}}}},incomePlanChanges:{},
  deletedCategoriesGlobal:["hidden"],deletedCategoryMonths:{},
  transactions:[
   {id:"subscription",category:"music",type:"expense",owner:"A",amount:12.34,date:"2026-10-15",scope:"forward",label:"Abonnement"},
   {id:"receipt",category:"music",type:"expense",owner:"B",amount:10.01,date:"2026-11-03"},
   {id:"other",category:"rent",type:"expense",owner:"common",amount:100,date:"2026-11-01"}
  ]
 };
 const box=vm.createContext({
  document,state,activeHouseholdId:"test-household",normalizeHousehold:x=>x,householdIsSolo:()=>false,
  window:{addEventListener(){}},cloudMonthDate:key=>key+"-01",ownerToSlot:owner=>owner==="common"?null:owner,
  categorySectionOf:c=>c.section,transactionDateForSelectedMonth:()=>evalApp("monthKey(state.selectedMonth)+'-01'"),
  saveState:()=>{saves++},render:()=>{},showUndoToast:(_message,action)=>{undo=action},
  setTimeout:fn=>{const id=++seq;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),
  INCOME_CATEGORIES:[],EXPENSE_CATEGORIES:[
   {id:"music",name:"Musique",section:"Abonnements",owner:"common",budget:15},
   {id:"video",name:"Vidéo",section:"Abonnements",owner:"A",budget:9.99},
   {id:"hidden",name:"Masquée",section:"Abonnements",owner:"A",budget:11},
   {id:"rent",name:"Loyer",section:"Obligatoires",owner:"common",budget:100}
  ]
 });
 function evalApp(code){return vm.runInContext(code,box)}
 for(const file of ["config","calculations","categories","category-controls","category-distribution","cloud-save","cloud-sync-v25"]){
  vm.runInContext(fs.readFileSync("js/"+file+".js","utf8"),box,{filename:file+".js"});
 }
 function dispatch(id,type,event){for(const fn of listeners.get(id+":"+type)||[])fn(event)}
 function button(action){
  const label={textContent:action==="clear"?"Tout vider":"Remplir les vides"};
  const control={isConnected:true,dataset:{categoryType:"expense",section:"Abonnements"},
   closest:selector=>selector===(action==="clear"?"[data-demo-clear-all]":"[data-demo-fill-all]")?control:null,
   getAttribute:()=>label.textContent,setAttribute(){},querySelector:()=>label};
  return control;
 }
 function click(target,detail=1){
  dispatch("categoryGrid","click",{target,detail});
  dispatch("document","click",{target,detail});
 }
 return {state,evalApp,dispatch,click,element,button,
  saves:()=>saves,undo:()=>undo?.(),expire:()=>{for(const fn of timers.values())fn()}};
}

test("fill only changes the empty real amount and undo after changing month preserves concurrent activity",()=>{
 const f=fixture();
 const before=structuredClone(f.state);
 f.click(f.button("fill"));
 assert.equal(f.evalApp("actualForCategoryAtMonth('music','2026-11')"),22.35);
 assert.equal(f.evalApp("actualForCategoryAtMonth('video','2026-11')"),9.99);
 assert.equal(f.evalApp("metrics().plannedExpense"),129.99);
 assert.equal(f.state.transactions.length,4);
 assert.equal(f.state.transactions.at(-1).category,"video");
 f.click(f.button("fill"));
 assert.equal(f.saves(),1);
 // The no-op toast replaces the undo action, so use the original fixture for undo.
 const g=fixture();
 g.click(g.button("fill"));
 g.state.selectedMonth="Décembre 2026";
 const extra={id:"new",category:"video",type:"expense",amount:3,date:"2026-12-01"};
 g.state.transactions.push(extra);
 g.undo();
 assert.deepEqual(g.state.transactions,[...before.transactions,extra]);
 assert.deepEqual(g.state.expensePlanChanges,before.expensePlanChanges);
 assert.equal(g.evalApp("metrics().expense"),15.34);
});

test("clear requires current confirmation, cancels without saving and reverses each payer for one month",()=>{
 const f=fixture(),clear=f.button("clear"),before=structuredClone(f.state);
 f.click(clear);
 f.click(clear,2);
 assert.equal(f.saves(),0);
 f.dispatch("document","keydown",{key:"Escape"});
 assert.deepEqual(f.state,before);
 assert.equal(f.saves(),0);
 f.click(clear);
 f.state.selectedMonth="Décembre 2026";
 f.click(clear);
 assert.deepEqual(f.state.transactions,before.transactions);
 f.expire();
 f.state.selectedMonth="Novembre 2026";
 f.click(clear);
 assert.equal(f.saves(),0);
 f.click(clear);
 assert.equal(f.saves(),1);
 assert.deepEqual(f.state.transactions.slice(0,3),before.transactions);
 assert.equal(f.evalApp("metrics().expenseA"),50);
 assert.equal(f.evalApp("metrics().expenseB"),50);
 assert.equal(f.evalApp("metricsForMonth('Décembre 2026').expense"),12.34);
 assert.equal(f.evalApp("metricsForMonth('Octobre 2026').expense"),12.34);
 assert.deepEqual(f.state.expensePlanChanges,before.expensePlanChanges);
 assert.deepEqual(f.state.deletedCategoriesGlobal,before.deletedCategoriesGlobal);
 f.undo();
 assert.deepEqual(f.state,before);
});

test("a changed transaction or household invalidates a pending confirmation",()=>{
 const f=fixture(),clear=f.button("clear");
 f.click(clear);
 f.state.transactions[1].amount=10.02;
 f.click(clear);
 assert.equal(f.saves(),0);
 f.evalApp('activeHouseholdId="other-test-household"');
 f.click(clear);
 assert.equal(f.saves(),0);
 f.click(clear);
 const after=structuredClone(f.state);
 f.evalApp('activeHouseholdId="test-household"');
 f.undo();
 assert.deepEqual(structuredClone(f.state),after);
 assert.equal(f.saves(),1);
});

test("chart usage reflects Overview real totals and compares the correct monthly plans",()=>{
 const f=fixture(),host=f.element("categoryDistribution");
 const render=()=>f.evalApp("SmartBudgetCategoryDistribution.render()");
 render();
 const html=()=>host.innerHTML.replace(/\s+/g," ");
 assert.match(html(),/Utilisé : 22,35 € · Budget prévu : 29,99 € · Reste : 7,64 €/);
 assert.match(html(),/1 enveloppe modifiée.*octobre 2026/);
 f.click(f.button("fill"));
 render();
 assert.equal(f.evalApp("Math.round((metrics().expense-100)*100)"),3234);
 assert.match(html(),/Utilisé : 32,34 € · Budget prévu : 29,99 € · Dépassement : 2,35 €/);
 f.state.selectedMonth="Décembre 2026";
 render();
 assert.match(html(),/Utilisé : 12,34 € · Budget prévu : 24,99 € · Reste : 12,65 €/);
 assert.match(html(),/1 enveloppe modifiée.*novembre 2026/);
});

test("the sync plan inserts only corrections and undo archives only those corrections",()=>{
 const f=fixture(),clear=f.button("clear");
 f.evalApp("state.baseExpenseCategories=EXPENSE_CATEGORIES; var before=cloudBuildLocalSnapshot()");
 f.click(clear);
 f.click(clear);
 const evaluatePlan=(remote,local)=>f.evalApp(`JSON.stringify(cloudBuildSyncPlan(${local},${remote},cloudBaselineFromRemote(${remote})).mutations.map(m=>[m.table,m.action,m.key]))`);
 f.evalApp("var after=cloudBuildLocalSnapshot()");
 const inserts=JSON.parse(evaluatePlan("before","after"));
 assert.equal(inserts.length,2,JSON.stringify(inserts));
 assert.ok(inserts.every(([table,action,key])=>table==="transactions"&&action==="insert"&&key!=="receipt"));
 f.undo();
 f.evalApp("var restored=cloudBuildLocalSnapshot()");
 assert.deepEqual(JSON.parse(evaluatePlan("after","restored")),inserts.map(([table,,key])=>[table,"archive",key]));
});
