import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=path=>fs.readFileSync(path,"utf8");
function setup(overrides={}){
 const box={...overrides};vm.createContext(box);
 vm.runInContext(read("js/category-distribution.js"),box);
 return {model:box.SmartBudgetCategoryDistribution,box};
}
const expense=[
 {id:"rent",name:"Loyer",section:"Obligatoires",budget:530,owner:"common"},
 {id:"groceries",name:"Courses",section:"Vie courante",budget:210,owner:"B"},
 {id:"coffee",name:"Café",section:"Vie courante",budget:0,owner:"B"},
 {id:"sub",name:"Spotify",section:"Abonnements",budget:60,owner:"B"},
 {id:"save",name:"Épargne",section:"Obligatoires",budget:500,saving:true},
];
const income=[{id:"salary",name:"Salaire",budget:1700},{id:"benefit",name:"Aide",budget:300}];
const toJSON=x=>JSON.parse(JSON.stringify(x));

test("category allocation uses only effective planned envelopes, with saving and duplicates excluded",()=>{
 const {model}=setup();
 const v=model.buildModel({expenses:[...expense,expense[0]],incomes:income});
 assert.equal(v.total,80000);
 assert.equal(v.count,3);
 assert.equal(v.items.reduce((n,x)=>n+x.amount,0),v.total);
 assert.deepEqual(toJSON(v.items.map(x=>x.name)),["Obligatoires","Vie courante","Abonnements"]);
 assert.equal(v.items[1].amount,21000);
 assert.deepEqual(toJSON(v.items[1].ids),["groceries","coffee"],"family filters also show zero-budget category");
 assert.equal(v.items.some(x=>x.ids.includes("save")),false);
 const revenue=model.buildModel({expenses:expense,incomes:income,scope:"income"});
 assert.equal(revenue.total,200000);
 assert.equal(revenue.count,2);
 assert.equal(revenue.items.some(x=>x.ids.includes("rent")),false);
});
test("category mode respects original order or descending budget; zero and invalid amounts never invent segments",()=>{
 const {model}=setup();
 const bad=[{id:"invalid",name:"Invalide",budget:"oops",section:"Vie courante"},{id:"negative",name:"Négatif",budget:-99,section:"Vie courante"}];
 const inOrder=model.buildModel({expenses:[...expense,...bad],level:"category",sort:"order"});
 assert.deepEqual(toJSON(inOrder.items.map(x=>x.name)),["Loyer","Courses","Spotify"]);
 const sorted=model.buildModel({expenses:[...expense,...bad],level:"category",sort:"amount"});
 assert.deepEqual(toJSON(sorted.items.map(x=>x.name)),["Loyer","Courses","Spotify"]);
 assert.equal(sorted.items.every(i=>i.amount>0),true);
 const none=model.buildModel({expenses:bad,incomes:[]});
 assert.equal(none.total,0);
 assert.equal(none.items.length,0);
 assert.equal(none.changes.length,0);
 assert.equal(none.delta,null);
});
test("small categories collapse only in the chart and remain available through their combined filter",()=>{
 const {model}=setup();
 const many=Array.from({length:10},(_,i)=>({id:"c"+i,name:"Poste "+i,budget:200-i*10,section:"Vie courante"}));
 const r=model.buildModel({expenses:many,level:"category"});
 assert.equal(r.items.length,7);
 assert.equal(r.items.at(-1).name,"Autres catégories");
 assert.equal(r.items.at(-1).ids.length,4);
 assert.equal(r.items.reduce((s,x)=>s+x.amount,0),r.total);
 assert.equal(new Set(r.items.flatMap(x=>x.ids)).size,10);
});
test("monthly budget changes compare plans, not spending; no unchanged-status filler",()=>{
 const {model}=setup();
 const previous=[{id:"rent",name:"Loyer",section:"Obligatoires",budget:500},
  {id:"groceries",name:"Courses",section:"Vie courante",budget:210}];
 const current=[{id:"rent",name:"Loyer",section:"Obligatoires",budget:530},
  {id:"groceries",name:"Courses",section:"Vie courante",budget:190}];
 const r=model.buildModel({expenses:current,previousExpenses:previous});
 assert.equal(r.total,72000);
 assert.equal(r.previousTotal,71000);
 assert.equal(r.delta,1000);
 assert.equal(r.changes.length,2);
 assert.equal(r.changes[0].name,"Loyer");
 assert.equal(r.changes[0].before,50000);
 assert.equal(r.changes[0].after,53000);
 const unchanged=model.buildModel({expenses:current,previousExpenses:current});
 assert.equal(unchanged.changes.length,0);
 const noBaseline=model.buildModel({expenses:current,previousExpenses:null});
 assert.equal(noBaseline.previousTotal,null);
 assert.equal(noBaseline.changes.length,0);
});
test("family totals are not weighted twice for a shared household envelope",()=>{
 const {model}=setup();
 const shared={id:"common-food",name:"Courses à deux",budget:250,owner:"common",section:"Vie courante"};
 const r=model.buildModel({expenses:[shared,{...shared}],scope:"expense"});
 assert.equal(r.total,25000);
 assert.equal(r.count,1);
});
test("interactive selection, scope switch and month refresh are isolated from financial state",()=>{
 const listeners={};
 const host={dataset:{},innerHTML:"",addEventListener:(name,fn)=>{listeners[name]=fn},contains:()=>true};
 const grid={innerHTML:"",querySelector:()=>null};
 const appState={selectedMonth:"novembre 2026",createdMonth:"2026-09"};
 let redraws=0;
 const {model}=setup({
  document:{getElementById:id=>id==="categoryDistribution"?host:id==="categoryGrid"?grid:null},
  state:appState,
  visibleExpenseCategories:(month=appState.selectedMonth)=>(month==="2026-12"||month==="décembre 2026")?[{id:"new",name:"Transport",budget:30,section:"Vie courante"}]:expense,
  visibleIncomeCategories:()=>income,
  monthKey:month=>month==="décembre 2026"?"2026-12":"2026-11",
  previousMonthKey:key=>key==="2026-12"?"2026-11":"2026-10",
  renderCategories:()=>{redraws++},
  metrics:()=>({})
 });
 model.render();
 assert.match(host.innerHTML,/Répartition des budgets/);
 assert.match(host.innerHTML,/Dépenses/);
 assert.equal(model.filter(),null);
 const target={dataset:{bdKey:"family:Vie courante"},closest:()=>target};
 listeners.click({target});
 assert.equal(model.filter().label,"Vie courante");
 assert.deepEqual(toJSON(model.filter().ids),["groceries","coffee"]);
 assert.equal(redraws,1);
 const incoming={dataset:{bdScope:"income"},closest:()=>incoming};
 listeners.click({target:incoming});
 assert.equal(model.filter(),null);
 assert.match(host.innerHTML,/Salaire/);
 assert.equal(redraws,2);
 const expenseScope={dataset:{bdScope:"expense"},closest:()=>expenseScope};
 listeners.click({target:expenseScope});
 const clickAgain={dataset:{bdKey:"family:Vie courante"},closest:()=>clickAgain};
 listeners.click({target:clickAgain});
 assert.ok(model.filter());
 appState.selectedMonth="décembre 2026";
 model.render();
 assert.equal(model.filter()?.label,"Vie courante","family with a remaining positive envelope should stay selected");
 assert.deepEqual(toJSON(model.filter().ids),["new"]);
 appState.selectedMonth="novembre 2026";
 model.render();
 assert.equal(model.filter()?.label,"Vie courante");
 const toggle={dataset:{bdKey:"family:Vie courante"},closest:()=>toggle};
 listeners.click({target:toggle});
 assert.equal(model.filter(),null);
});
test("integration retires only the obsolete card, while recurring transactions and their code remain intact",()=>{
 const html=read("index.html"),ui=read("js/ui.js"),categories=read("js/categories.js"),distrib=read("js/category-distribution.js"),css=read("css/category-distribution.css");
 assert.match(html,/id="categoryDistribution"/);
 assert.match(html,/js\/category-distribution\.js\?v=31ca/);
 assert.match(html,/css\/category-distribution\.css\?v=31ca/);
 assert.doesNotMatch(html,/id="subscriptionsOverview"/);
 assert.doesNotMatch(html,/js\/subscriptions-overview\.js/);
 assert.match(ui,/SmartBudgetCategoryDistribution\?\.render\(\);renderCategories\(m\)/);
 assert.match(ui,/SmartBudgetCategoryDistribution\?\.filter\(\)/);
 assert.match(categories,/data-clear-category-filter/);
 assert.match(ui,/data-clear-category-filter/);
 assert.match(distrib,/data-bd-action="edit"/);
 assert.match(distrib,/openCategoryEditor\(id,null,"planned",ui.scope\)/);
 assert.match(distrib,/role="tooltip"/);
 assert.match(distrib,/aria-pressed/);
 assert.match(distrib,/prefers-reduced-motion/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(read("js/transactions.js"),/recurren|scope==="forward"/i);
 assert.match(read("js/calculations.js"),/recurringOccurrenceDate/);
 assert.doesNotMatch(distrib,/\bsaveState\s*\(|\bfetch\s*\(|\bcloudClient\b|\.transactions\.push\s*\(/);
});


test("PR49 Unslop page rhythm: all financial groups share an internal title and single panel",()=>{
 const ui=read("js/ui.js"),css=read("css/category-distribution.css");
 const preview=read("preview/category-distribution/index.html");
 const chart=read("js/category-distribution.js");
 assert.match(ui,/section class="category-group card"/);
 assert.match(ui,/cg-revenues/);
 assert.match(ui,/cg-expenses/);
 assert.match(ui,/cg-savings/);
 assert.match(ui,/sectionFigures\(incomeActual,incomePlanned\)/);
 assert.match(ui,/sectionFigures\(expenseActual,expensePlanned\)/);
 assert.match(ui,/sectionFigures\(savingActual,savingPlanned\)/);
 assert.doesNotMatch(ui,/Entrées d’argent · réel \/ prévu|Argent réellement consommé · hors épargne|Argent mis de côté · déduit du disponible/);
 assert.match(css,/PR49 Unslop page rhythm/);
 assert.match(css,/#categories \.category-group-head h2/);
 assert.match(css,/#categories \.category-cards:not\(\.income-cards\)/);
 assert.match(css,/@media\(max-width:56rem\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(chart,/Ces montants sont des enveloppes prévues, pas des dépenses effectuées/);
 assert.doesNotMatch(preview,/Essaie le survol|Budgets prévus · démonstration/);
 assert.match(preview,/demo-revenus/);
 assert.match(preview,/demo-depenses/);
 assert.match(preview,/demo-epargne/);
 assert.match(preview,/Données fictives · Aucun compte connecté/);
});
