import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function builder(extra={}){
 const ctx=vm.createContext({activeHouseholdId:"alpha",CSS:{escape:x=>x},...extra});
 vm.runInContext(fs.readFileSync("js/setup-builder.js","utf8"),ctx);
 const b=vm.runInContext("setupBuilderController",ctx);
 b.root={querySelector:()=>null};
 return b;
}
test("a goal rounds the monthly contribution up to a cent and recalculates the duration",()=>{
 const b=builder(), row={target:"100",duration:3,amount:""};
 b.getData=()=>row;
 b.updateGoal("expense:saving-b","duration","3");
 assert.equal(row.amount,"33.34");
 b.updateGoal("expense:saving-b","amount","20");
 assert.equal(row.duration,5);
});
test("setup totals add integer cents and exclude unselected categories",()=>{
 const b=builder();
 b.visibleBaseIncomes=b.visibleBaseExpenses=()=>[];
 b.draft={customIncome:[{selected:true,amount:"0.1"},{selected:true,amount:"0.2"}],customExpense:[],customSubscriptions:[],subscriptions:{}};
 for(const id of ["netflix","spotify","disney","prime","icloud","discord","chatgpt"])b.draft.subscriptions[id]={selected:false};
 assert.equal(b.totals().income,0.3);
});
test("offline submit and household changes cannot mark setup complete",async()=>{
 const b=builder({navigator:{onLine:false}});
 let status="";
 b.setStatus=text=>{status=text};
 b.householdId="alpha";await b.finish();assert.match(status,/brouillon/);
 status="";b.householdId="beta";await b.finish();assert.equal(status,"");assert.equal(b.busy,false);
});
test("annual subscriptions use the same cent-rounded monthly amount in the review and saved budget",()=>{
 const state={createdMonth:"2026-11",customExpenseCategories:[],categoryBudgets:{},categoryOwners:{}};
 const b=builder({state,euro:amount=>amount.toFixed(2),escapeHtml:text=>text.replaceAll("<","&lt;")});
 b.visibleBaseIncomes=b.visibleBaseExpenses=()=>[];
 const subscriptions=Object.fromEntries(["netflix","spotify","disney","prime","icloud","discord","chatgpt"].map(id=>[id,{selected:false}]));
 subscriptions.netflix={selected:true,name:"Abonnement test",amount:"99.99",period:"annual",plan:0};
 b.draft={household:{mode:"solo"},subscriptions,customIncome:[],customExpense:[],customSubscriptions:[
  {id:"annual",selected:true,name:"Annuel <test>",amount:"120",period:"annual"},
  {id:"monthly",selected:true,name:"Mensuel test",amount:"0.02"}
 ]};
 assert.equal(b.totals().expense,18.35);
 assert.deepEqual(Array.from(b.monthlyLines().subscriptions,x=>x.cents),[833,1000,2]);
 b.step=6;
 const review=b.stepMarkup();
 assert.match(review,/<summary>Abonnements <strong>18\.35<\/strong><\/summary>/);
 assert.match(review,/<dt>Annuel &lt;test><\/dt><dd>10\.00<\/dd>/);
 b.applyCustomCategories();
 assert.deepEqual(state.categoryBudgets,{"setup-sub-netflix":8.33,annual:10,monthly:0.02});
 assert.equal(state.customExpenseCategories.find(row=>row.id==="annual").budget,10);
});
test("retry keeps stable IDs and preserves unrelated existing setup categories",()=>{
 const state={createdMonth:"2026-11",customExpenseCategories:[{id:"setup-expense-existing"}],customIncomeCategories:[],categoryBudgets:{},categoryOwners:{}};
 const b=builder({state});b.draft={household:{mode:"solo"},customExpense:[{id:"goal",name:"Voyage",amount:"30.25",saving:true,selected:true}],customIncome:[],customSubscriptions:[],subscriptions:{}};
 for(const id of ["netflix","spotify","disney","prime","icloud","discord","chatgpt"])b.draft.subscriptions[id]={selected:false};
 b.applyCustomCategories();b.applyCustomCategories();
 assert.equal(state.customExpenseCategories.length,2);
 assert.equal(state.customExpenseCategories.find(c=>c.id==="goal").saving,true);
 assert.equal(state.categoryBudgets.goal,30.25);
});
