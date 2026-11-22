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
 assert.match(html,/js\/category-distribution\.js\?v=31ug/);
 assert.match(html,/css\/category-distribution\.css\?v=31ug/);
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
 const realRenderer=read("preview/category-distribution/category-render-live.js");
 assert.match(realRenderer,/cg-revenues/);
 assert.match(realRenderer,/cg-expenses/);
 assert.match(realRenderer,/cg-savings/);
 assert.match(preview,/Données fictives · Aucun compte connecté/);
 assert.match(preview,/id="categoryEditBackdrop"/);
 assert.match(preview,/id="categoryDeleteBackdrop"/);
 assert.match(preview,/id="categorySettingsBackdrop"/);
});


test("PR49 standalone preview assets mirror the actual read-only category component",()=>{
 assert.equal(read("preview/category-distribution/category-distribution.css"),read("css/category-distribution.css"));
 const demoChart=read("preview/category-distribution/category-distribution.js");
 assert.ok(demoChart.includes("function buildModel("),"chart financial model is unchanged");
 assert.match(demoChart,/bd-level-placeholder/,"income layout now reserves an equal control footprint");
 assert.doesNotMatch(read("js/category-distribution.js"),/bd-level-placeholder/,"production component is unchanged");
});



test("PR49 31ui: preview reuses exact published category handlers and source CSS",()=>{
 const live=read("preview/category-distribution/categories-live.js");
 const repoHandlers=read("js/categories.js");
 assert.equal(live,repoHandlers,"demo behavior remains identical to app category handler");
 const page=read("preview/category-distribution/index.html");
 for(const key of ["category-render-live.js","categories-live.js","category-prototype.js","demo-state.js","demo-init.js","demo-chrome.js","demo-shell.css","mobile-ui.css","app-style.css","preview-polish.css"]){
  assert.ok(page.includes(key+"?v=31um"),key);
 }
 for(const id of ["categoryEditBackdrop","categoryDeleteBackdrop","categoryNameInput","categoryOwnerField","categoryPlanScopeHint","categoryBudgetInput","saveCategoryEdit"]){
  assert.match(page,new RegExp('id="'+id+'"'),id);
 }
 assert.match(page,/connect-src 'none'/,"no financial or AI network request possible");
 assert.doesNotMatch(page,/supabase|cloudflare|https:\/\/|localStorage|fetch\(/i);
 const state=read("preview/category-distribution/demo-state.js");
 assert.match(state,/function saveState\(\)\{\}/);
 assert.doesNotMatch(state.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,""),/\bfetch\s*\(|localStorage|sessionStorage/);
 assert.match(live,/data-fill-category/);
 assert.match(live,/data-bulk-action/);
 assert.match(live,/data-category-menu-trigger/);
 assert.match(live,/data-edit-actual/);
 assert.match(live,/data-edit-planned/);
 assert.match(live,/data-add-saving/);
 assert.match(live,/data-delete-category/);
 assert.match(live,/data-restore-category/);
 const renderer=read("preview/category-distribution/category-render-live.js");
 for(const s of ["data-category-details-toggle","data-demo-settings","data-demo-fill-all","data-demo-clear-all","cat-budget-tile","role=\"progressbar\"","restorableBlock","archivedBlock"])
  assert.ok(renderer.includes(s),s);
});
test("PR49 31ui: actual published category rows render against local-only fixture",()=>{
 const grid={innerHTML:""};
 const box={document:{getElementById:id=>id==="categoryGrid"?grid:null}};
 vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 vm.runInContext("renderCategories(metrics())",box);
 const html=grid.innerHTML;
 assert.match(html,/Répartition|Revenus/);
 for(const key of ["Dépenses","Épargne","Obligatoires","Abonnements","Vie courante","data-demo-fill-category","data-demo-settings","data-delete-category","data-edit-actual","data-edit-planned","data-add-category","data-add-saving","data-demo-fill-all","data-demo-clear-all","data-category-details-toggle","role=\"progressbar\""]){
  assert.ok(html.includes(key),key);
 }
 assert.ok(html.includes("cat-section-actions"));
 const state=vm.runInContext("({income:metrics().income,saving:metrics().saving,expense:metrics().expense,insurance:metrics().expMap.insurance||0,insurancePlanned:visibleExpenseCategories().find(x=>x.id==='insurance').budget})",box);
 assert.equal(state.income,1900);
 assert.equal(state.saving,80);
 assert.equal(state.expense,810);
 assert.equal(state.insurance,0);
 assert.equal(state.insurancePlanned,75);
});
test("PR49 31ui: sort choices are an accessible listbox and active text is neutral",()=>{
 const source=read("js/category-distribution.js"),css=read("css/category-distribution.css");
 for(const token of ['data-bd-sort-trigger','data-bd-sort-menu','data-bd-sort-option','role="listbox"','aria-selected','closeSort(host,true)']){
  assert.ok(source.includes(token),token);
 }
 assert.doesNotMatch(source,/<select data-bd-sort/);
 assert.match(css,/\.bd-sort-menu/);
 assert.match(css,/\.bd-toolbar \.is-active:hover/);
 assert.match(css,/color:var\(--text\)!important/);
 assert.match(css,/PR49 31uf/);
});


test("PR49 31ui: actual category actions mutate only fixture memory",()=>{
 const ids=new Map(),events=new Map();
 const node=(id)=>({
  dataset:{},style:{},value:"",textContent:"",innerHTML:"",hidden:false,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(type,fn){events.set(id+":"+type,fn)},
  setAttribute(){},querySelectorAll(){return []},querySelector(){return null},
  focus(){},select(){},
 });
 const document={
  getElementById(id){if(!ids.has(id))ids.set(id,node(id));return ids.get(id)},
  querySelectorAll(){return []},
  addEventListener(){},
 };
 const box={document,setTimeout:()=>0,clearTimeout:()=>{}};
 vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 vm.runInContext(read("preview/category-distribution/categories-live.js"),box);
 const check=(expr)=>vm.runInContext(expr,box);
 assert.equal(check("metrics().expMap.insurance||0"),0);
 check('fillCategoryActualFromPlan("insurance","expense")');
 assert.equal(check("metrics().expMap.insurance"),75);
 assert.equal(check("metrics().expense"),885);
 check('openCategoryEditor("groceries",null,"actual","expense")');
 ids.get("categoryBudgetInput").value="299.50";
 events.get("saveCategoryEdit:click")();
 assert.equal(check("metrics().expMap.groceries"),299.5);
 check('openCategoryEditor("rent",null,"planned","expense")');
 ids.get("categoryBudgetInput").value="550";
 events.get("saveCategoryEdit:click")();
 assert.equal(check('visibleExpenseCategories().find(c=>c.id==="rent").budget'),550);
 check('openCategoryEditor(null,"Vie courante","planned","expense")');
 ids.get("categoryNameInput").value="Jouets";
 ids.get("categoryBudgetInput").value="65";
 events.get("saveCategoryEdit:click")();
 assert.equal(check('visibleExpenseCategories().find(c=>c.name==="Jouets").budget'),65);
 check('setSectionActual("expense","Abonnements","fill-empty")');
 assert.equal(check("metrics().expMap.music"),12);
 check('openCategoryDelete("insurance","expense")');
 check("deleteCategoryForMonth()");
 assert.equal(check('visibleExpenseCategories().some(c=>c.id==="insurance")'),false);
 check('restoreCategory("insurance","expense")');
 assert.equal(check('visibleExpenseCategories().some(c=>c.id==="insurance")'),true);
 assert.match(ids.get("categoryGrid").innerHTML,/Jouets/);
 assert.ok(!("supabase" in box));
});


test("PR49 31ui: orphan groups are visible, grouped and included in real and planned totals",()=>{
 const grid={innerHTML:""};
 const box={document:{getElementById:id=>id==="categoryGrid"?grid:null}};
 vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 vm.runInContext('EXPENSE_CATEGORIES.push({id:"misc",name:"Taxi",section:"Déplacements",budget:25,owner:"B"});state.transactions.push({id:"misc-actual",type:"expense",category:"misc",amount:14,date:"2026-11-12",owner:"B"});renderCategories(metrics())',box);
 const html=grid.innerHTML;
 assert.match(html,/Autres/);
 assert.match(html,/Taxi/);
 assert.match(html,/14,00/);
 assert.match(html,/25,00/);
 assert.equal((html.match(/data-category-row="misc"/g)||[]).length,1);
 assert.doesNotMatch(html,/Prévu · Personne/);
 const realUI=read("js/ui.js");
 for(const fragment of ["function categorySectionOf","categorySectionOf(c)===section","sections.push(\"Autres\")","categorySectionOf(c)!==section"]){
  assert.ok(realUI.includes(fragment),fragment);
 }
});
test("PR49 31ui: balanced monthly budget movements are not mislabeled as no changes",()=>{
 const host={dataset:{},innerHTML:"",addEventListener(){},contains(){return true}};
 const grid={innerHTML:""};
 const current=[{id:"rent",section:"Obligatoires",name:"Loyer",budget:510},
  {id:"food",section:"Vie courante",name:"Courses",budget:190}];
 const previous=[{id:"rent",section:"Obligatoires",name:"Loyer",budget:500},
  {id:"food",section:"Vie courante",name:"Courses",budget:200}];
 const {model}=setup({
  document:{getElementById:id=>id==="categoryDistribution"?host:id==="categoryGrid"?grid:null},
  state:{selectedMonth:"novembre 2026",createdMonth:"2026-09"},
  visibleExpenseCategories:month=>month==="2026-10"?previous:current,
  visibleIncomeCategories:()=>[],
  monthKey:()=> "2026-11",
  previousMonthKey:()=> "2026-10"
 });
 model.render();
 assert.match(host.innerHTML,/2 enveloppes modifiées/);
 assert.match(host.innerHTML,/Total inchangé/);
 assert.doesNotMatch(host.innerHTML,/Aucune modification/);
 const source=read("js/category-distribution.js");
 const summary=source.slice(source.indexOf("function summaryMarkup"),source.indexOf("function changesMarkup"));
 assert.doesNotMatch(summary,/data-bd-action="view"/,"selected filter already updates the list");
 assert.match(summary,/data-bd-action="edit"/,"quick edit remains available");
});
test("PR49 31ui: only one horizontal list divider, three desktop columns and neutral category hover",()=>{
 const css=read("css/category-distribution.css");
 const polish=read("preview/category-distribution/preview-polish.css");
 assert.match(css,/PR49 31ug — Category rows and neutral states/);
 assert.match(css,/\.cat-item \+ \.cat-item\{\s*border-top:\.0625rem solid var\(--line\)/);
 assert.match(css,/\.category-cards:not\(\.income-cards\)\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(css,/\.cat-section:not\(:last-child\)\{\s*border-right:\.0625rem/);
 assert.match(css,/\.cat-name-toggle:hover \.cat-name,[\s\S]*?color:var\(--text\)/);
 assert.match(css,/\.cat-item\.details-open \.cat-detail-chevron\{\s*color:var\(--muted\)/);
 assert.match(css,/\.bd-legend-row\.is-active\{\s*background:var\(--panel-2\)/);
 assert.match(css,/@media\(max-width:56rem\)\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(polish,/#categoryEditBackdrop \.modal/);
 assert.equal(css,read("preview/category-distribution/category-distribution.css"));
});
test("PR49 31ui: test-only dialogs trap focus and restore it without persistent storage",()=>{
 const boot=read("preview/category-distribution/demo-init.js");
 const page=read("preview/category-distribution/index.html");
 for(const part of ["MutationObserver","event.key!==\"Tab\"","event.shiftKey","requestAnimationFrame(returnFocus)","target.focus({preventScroll:true})","event.key===\"Escape\""]){
  assert.ok(boot.includes(part),part);
 }
 assert.match(page,/aria-modal="true"/);
 assert.match(page,/connect-src 'none'/);
 assert.doesNotMatch(boot.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,""),/\bfetch\(|localStorage|sessionStorage/);
});


test("PR49 31ui: full category tile functionality renders in vertical financial groups",()=>{
 const grid={innerHTML:""};
 const box={document:{getElementById:id=>id==="categoryGrid"?grid:null}};
 vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 vm.runInContext("renderCategories(metrics())",box);
 const html=grid.innerHTML;
 assert.ok(html.indexOf("Obligatoires")<html.indexOf("Abonnements")&&html.indexOf("Abonnements")<html.indexOf("Vie courante"));
 for(const key of ["cat-budget-list","cat-budget-tile","cat-progress-track","data-demo-fill-category","data-edit-actual","data-edit-planned","data-demo-settings","data-delete-category","data-demo-fill-all","data-demo-clear-all","data-category-details-toggle","role=\"progressbar\""]){
  assert.ok(html.includes(key),key);
 }
 assert.ok(html.includes("Remplir les vides")&&html.includes("Tout vider"));
 assert.ok(!html.includes("data-category-menu-trigger"),"settings and delete are no longer hidden inside a menu");
 assert.equal((html.match(/data-category-row="/g)||[]).length,11);
 const polish=read("preview/category-distribution/preview-polish.css");
 assert.match(polish,/PR49 31uh — Budget tiles/);
 assert.match(polish,/\.category-cards:not\(\.income-cards\),[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(polish,/\.cat-budget-list>\.cat-budget-tile \+ \.cat-budget-tile/);
 assert.match(polish,/\.cat-progress-fill\.is-warning/);
 assert.match(polish,/\.cat-progress-fill\.is-danger/);
 assert.match(polish,/@media\(max-width:22rem\)/);
 assert.match(polish,/@media\(prefers-reduced-motion:reduce\)/);
});
test("PR49 31ui: progress bar distinguishes normal, warning, danger, saving and no-plan",()=>{
 const grid={innerHTML:""};
 const box={document:{getElementById:id=>id==="categoryGrid"?grid:null}};
 vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 const probe=(expr)=>vm.runInContext(expr,box);
 const low=probe('categoryProgressMarkup({name:"Courses",budget:250},186,"expense")');
 assert.match(low,/is-normal/);assert.match(low,/74 %/);
 const warning=probe('categoryProgressMarkup({name:"Carburant",budget:90},102,"expense")');
 assert.match(warning,/is-warning/);assert.match(warning,/\+12,00/);
 const danger=probe('categoryProgressMarkup({name:"Musique",budget:12},22,"expense")');
 assert.match(danger,/is-danger/);assert.match(danger,/183 %/);
 const savings=probe('categoryProgressMarkup({name:"Épargne",budget:80,saving:true},100,"expense")');
 assert.match(savings,/is-saving/);assert.doesNotMatch(savings,/is-danger|is-warning/);
 const income=probe('categoryProgressMarkup({name:"Salaire",budget:1900},2200,"income")');
 assert.match(income,/is-income/);assert.doesNotMatch(income,/is-danger|is-warning/);
 const none=probe('categoryProgressMarkup({name:"Santé",budget:0},12,"expense")');
 assert.match(none,/Sans budget/);assert.match(none,/width:0%/);
 probe('state.selectedMonth="Décembre 2026";renderCategories(metrics())');
 assert.match(grid.innerHTML,/is-warning/);
 assert.match(grid.innerHTML,/is-danger/);
});
test("PR49 31ui: grouped fill and clear restore real amounts without touching plans",()=>{
 const nodes=new Map(),callbacks=new Map();
 const element=id=>{
  if(nodes.has(id))return nodes.get(id);
  const el={value:"",textContent:"",innerHTML:"",hidden:false,dataset:{},style:{},
   classList:{add(){},remove(){},contains(){return false},toggle(){}},
   addEventListener:(name,fn)=>{callbacks.set(id+":"+name,fn)},
   setAttribute(){},focus(){},select(){},reportValidity(){return true},setCustomValidity(){},
   querySelectorAll(){return []},querySelector(){return null}};
  nodes.set(id,el);return el;
 };
 const document={getElementById:element,querySelectorAll(){return []},addEventListener(){}};
 const box={document,setTimeout:()=>0,clearTimeout:()=>{}};
 vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 vm.runInContext(read("preview/category-distribution/categories-live.js"),box);
 vm.runInContext(read("preview/category-distribution/category-prototype.js"),box);
 const probe=expr=>vm.runInContext(expr,box);
 assert.equal(probe("metrics().expMap.groceries"),186);
 assert.equal(probe("metrics().expMap.car"),54);
 assert.equal(probe('prototypeBulkActual("expense","Vie courante","fill-empty")'),0);
 assert.equal(probe("metrics().expMap.groceries"),186,"existing real must remain untouched");
 assert.equal(probe("metrics().expMap.car"),54);
 probe('setCategoryActual("car",0,"expense")');
 assert.equal(probe('prototypeBulkActual("expense","Vie courante","fill-empty")'),1);
 assert.equal(probe("metrics().expMap.groceries"),186);
 assert.equal(probe("metrics().expMap.car"),120);
 assert.equal(probe('visibleExpenseCategories().find(c=>c.id==="car").budget'),120);
 assert.equal(probe('prototypeBulkActual("expense","Vie courante","clear")'),2);
 assert.equal(probe("metrics().expMap.groceries"),0);
 assert.equal(probe("metrics().expMap.car"),0);
 assert.equal(probe("metrics().saving"),80);
 probe('openCategorySettings("rent","expense")');
 element("categorySettingsName").value="Loyer principal";
 element("categorySettingsActual").value="600";
 element("categorySettingsPlanned").value="640";
 element("categorySettingsOwner").value="common";
 element("categorySettingsSection").value="Obligatoires";
 element("categorySettingsScope").value="month";
 callbacks.get("categorySettingsForm:submit")({preventDefault(){}});
 assert.equal(probe('visibleExpenseCategories().find(c=>c.id==="rent").name'),"Loyer principal");
 assert.equal(probe('visibleExpenseCategories().find(c=>c.id==="rent").budget'),640);
 assert.equal(probe('metrics().expMap.rent'),600);
 assert.equal(probe('planForCategory(catById("rent","expense"),"2026-10").budget'),530,"month-only setting cannot rewrite last month");
 probe('openCategorySettings("car","expense")');
 element("categorySettingsSection").value="Abonnements";
 callbacks.get("categorySettingsForm:submit")({preventDefault(){}});
 assert.equal(probe('visibleExpenseCategories().find(c=>c.id==="car").section'),"Abonnements");
 assert.equal(probe('planForCategory(catById("car"),"2026-10").section'),"Vie courante");
 assert.equal(probe('planForCategory(catById("car"),"2026-12").section'),"Vie courante");
 probe('openCategorySettings("salary","income")');
 assert.equal(element("categorySettingsSectionField").hidden,true);
 probe('openCategorySettings("reserve","expense")');
 assert.equal(element("categorySettingsSectionField").hidden,true);
 assert.ok(!("supabase" in box));
});
test("PR49 31ui: settings modal and preview preserve isolation and keyboard behavior",()=>{
 const html=read("preview/category-distribution/index.html");
 const js=read("preview/category-distribution/category-prototype.js");
 const boot=read("preview/category-distribution/demo-init.js");
 const css=read("preview/category-distribution/preview-polish.css");
 for(const s of ["categorySettingsBackdrop","categorySettingsActual","categorySettingsPlanned","categorySettingsOwner","categorySettingsSection","categorySettingsScope","categorySettingsForm"]){
  assert.match(html,new RegExp('id="'+s+'"'),s);
 }
 assert.ok(html.includes('category-prototype.js?v=31um'));
 assert.match(html,/connect-src 'none'/);
 assert.match(js,/prototypeBulkActual/);
 assert.match(js,/revertPrototypeAdjustments/);
 assert.match(js,/showUndoToast/);
 assert.match(js,/setCategoryActual/);
 assert.match(js,/setCategoryPlan/);
 assert.match(js,/renameCategory/);
 assert.match(boot,/backdrops=\[categoryEditBackdrop,categoryDeleteBackdrop,categorySettingsBackdrop,demoTransactionBackdrop\]/);
 assert.match(boot,/event\.shiftKey/);
 assert.match(boot,/closeCategorySettings\(\)/);
 assert.match(css,/\.sb-settings-field\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,""),/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b/);
});


test("PR49 31uj: fill-empty never overwrites a nonempty actual and undo is transaction-scoped",()=>{
 const nodes=new Map(),callbacks=new Map();
 const node=id=>{
  if(nodes.has(id))return nodes.get(id);
  const el={
   value:"",textContent:"",innerHTML:"",hidden:false,dataset:{},style:{},
   classList:{add(){},remove(){},contains(){return false},toggle(){}},
   addEventListener:(event,fn)=>callbacks.set(id+":"+event,fn),
   setAttribute(){},getAttribute(){return "Aligner sur le prévu"},
   focus(){},select(){},setCustomValidity(){},reportValidity(){return true},
   querySelectorAll(){return []},querySelector(){return null}
  };
  nodes.set(id,el);return el;
 };
 const doc={getElementById:node,querySelectorAll(){return []},addEventListener(){}};
 const box={document:doc,setTimeout:()=>0,clearTimeout:()=>{}};
 vm.createContext(box);
 for(const path of ["demo-state.js","category-render-live.js","categories-live.js","category-prototype.js"]){
  vm.runInContext(read("preview/category-distribution/"+path),box);
 }
 const check=exp=>vm.runInContext(exp,box);
 const button={dataset:{},textContent:"",innerHTML:"",isConnected:true,
  setAttribute(){},getAttribute(){return "Aligner sur le prévu"},focus(){}};
 box.testButton=button;
 check('prototypeFillOne("groceries","expense",testButton)');
 assert.equal(check("metrics().expMap.groceries"),186,"first click must not rewrite an existing amount");
 assert.equal(button.dataset.demoArmed,"true");
 check('prototypeFillOne("groceries","expense",testButton)');
 assert.equal(check("metrics().expMap.groceries"),250,"second deliberate click performs alignment");
 check('setCategoryActual("groceries",186,"expense")');
 const insurance={dataset:{},textContent:"",innerHTML:"",isConnected:true,setAttribute(){},getAttribute(){return ""},focus(){}};
 box.emptyButton=insurance;
 check('prototypeFillOne("insurance","expense",emptyButton)');
 assert.equal(check("metrics().expMap.insurance"),75,"empty real can be completed with one click");
 check('setCategoryActual("insurance",0,"expense")');
 assert.equal(check('prototypeBulkActual("expense","Vie courante","fill-empty")'),0,"existing reals must never be overwritten");
 assert.equal(check('prototypeBulkActual("expense","Vie courante","clear")'),2);
 const ids=check('state.transactions.filter(t=>t.bulkGroupId&&t.bulkLabel.includes("Remise du réel à zéro")).map(t=>t.id)');
 assert.equal(ids.length,2);
 check('state.transactions.push(record("expense","groceries",25,"common","2026-11-22","Nouvelle dépense"))');
 box.undoIDs=ids;
 check("revertPrototypeAdjustments(undoIDs)");
 assert.equal(check("metrics().expMap.groceries"),211,"later independent expense must survive undo");
 assert.equal(check("metrics().expMap.car"),54);
 assert.equal(check('visibleExpenseCategories().find(c=>c.id==="groceries").budget'),250);
});
test("PR49 31uj: one settings dialog handles existing edits and period-scoped family changes",()=>{
 const nodes=new Map(),callbacks=new Map();
 const node=id=>{
  if(nodes.has(id))return nodes.get(id);
  const x={value:"",textContent:"",innerHTML:"",hidden:false,dataset:{},style:{},
   classList:{add(){},remove(){},contains(){return false},toggle(){}},
   addEventListener:(type,fn)=>callbacks.set(id+":"+type,fn),
   setAttribute(){},focus(){},select(){},setCustomValidity(){},reportValidity(){return true},
   querySelectorAll(){return []},querySelector(){return null}
  };
  nodes.set(id,x);return x;
 };
 const document={getElementById:node,querySelectorAll(){return []},addEventListener(){}};
 const box={document,setTimeout:()=>0,clearTimeout:()=>{}};
 vm.createContext(box);
 for(const path of ["demo-state.js","category-render-live.js","categories-live.js","category-prototype.js"]){
  vm.runInContext(read("preview/category-distribution/"+path),box);
 }
 const readState=expr=>vm.runInContext(expr,box);
 readState('openCategoryEditor("rent",null,"actual","expense")');
 assert.equal(node("categorySettingsActual").value,"530.00");
 assert.equal(node("categoryEditBackdrop").classList.contains("open"),false);
 readState('openCategoryEditor("car",null,"planned","expense")');
 assert.equal(node("categorySettingsPlanned").value,"120.00");
 node("categorySettingsSection").value="Abonnements";
 node("categorySettingsScope").value="month";
 callbacks.get("categorySettingsForm:submit")({preventDefault(){}});
 assert.equal(readState('visibleExpenseCategories().find(c=>c.id==="car").section'),"Abonnements");
 assert.equal(readState('planForCategory(catById("car"),"2026-10").section'),"Vie courante");
 assert.equal(readState('planForCategory(catById("car"),"2026-12").section'),"Vie courante");
 readState('openCategorySettings("car","expense")');
 node("categorySettingsSection").value="Obligatoires";
 node("categorySettingsScope").value="forward";
 callbacks.get("categorySettingsForm:submit")({preventDefault(){}});
 assert.equal(readState('planForCategory(catById("car"),"2026-12").section'),"Obligatoires");
 readState('openCategorySettings("car","expense")');
 node("categorySettingsSection").value="Autres";
 node("categorySettingsScope").value="month";
 callbacks.get("categorySettingsForm:submit")({preventDefault(){}});
 assert.equal(readState('visibleExpenseCategories().find(c=>c.id==="car").section'),"Autres");
 assert.match(node("categoryGrid").innerHTML,/>Autres</,"moved custom group must remain visible");
 assert.equal(readState('planForCategory(catById("car"),"2026-12").section'),"Obligatoires");
 readState('openCategoryEditor(null,"Vie courante","planned","expense")');
 assert.ok(node("categoryEditBackdrop"),"original category creation form is preserved");
});
test("PR49 31uj: progress copy, warnings and dark/light contrast are meaningful",()=>{
 const sandbox={document:{}};
 vm.createContext(sandbox);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),sandbox);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),sandbox);
 const evalMarkup=src=>vm.runInContext(src,sandbox);
 const used=evalMarkup('categoryProgressMarkup({name:"Courses",budget:250},186,"expense")');
 assert.match(used,/64,00/);
 assert.match(used,/restants/);
 const warning=evalMarkup('categoryProgressMarkup({name:"Carburant",budget:90},102,"expense")');
 assert.match(warning,/is-warning/);
 assert.match(warning,/\+12,00/);
 const noPlan=evalMarkup('categoryProgressMarkup({name:"Santé",budget:0},35,"expense")');
 assert.match(noPlan,/is-unbudgeted/);
 assert.match(noPlan,/Sans budget prévu/);
 const income=evalMarkup('categoryProgressMarkup({name:"Salaire",budget:1800},1700,"income")');
 assert.match(income,/à recevoir/);
 const saving=evalMarkup('categoryProgressMarkup({name:"Projets",budget:120,saving:true},60,"expense")');
 assert.match(saving,/à épargner/);
 const css=read("preview/category-distribution/preview-polish.css");
 const lum=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)
  .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4))
  .reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 assert.ok(contrast("#93550f","#f5f6f8")>=4.5);
 assert.ok(contrast("#a52e35","#f5f6f8")>=4.5);
 assert.ok(contrast("#f1bb6f","#22262e")>=4.5);
 assert.ok(contrast("#ff9998","#22262e")>=4.5);
 for(const color of ["#93550f","#a52e35","#f1bb6f","#ff9998"])
  assert.ok(css.includes(color),color);
});


test("PR49 31ul: hybrid composition keeps the chart mounted and preserves category delegation",()=>{
 const host={dataset:{layout:"hybrid"},innerHTML:"chart-node-must-survive"};
 const slots=Object.fromEntries(["categoryFilterSlot","categoryIncomeSlot","categoryExpenseSlot","categorySavingSlot"].map(name=>[name,{innerHTML:""}]));
 const doc={getElementById:id=>id==="categoryGrid"?host:slots[id]||null};
 const box={document:doc};vm.createContext(box);
 vm.runInContext(read("preview/category-distribution/demo-state.js"),box);
 vm.runInContext(read("preview/category-distribution/category-render-live.js"),box);
 const inspect=code=>vm.runInContext(code,box);
 inspect("renderCategories(metrics())");
 assert.equal(host.innerHTML,"chart-node-must-survive");
 assert.match(slots.categoryIncomeSlot.innerHTML,/cg-revenues/);
 assert.match(slots.categoryExpenseSlot.innerHTML,/cg-expenses/);
 assert.match(slots.categorySavingSlot.innerHTML,/cg-savings/);
 assert.equal(slots.categoryFilterSlot.innerHTML,"");
 for(const code of ["data-demo-settings","data-edit-actual","data-edit-planned","data-demo-fill-category"]){
  assert.ok(slots.categoryIncomeSlot.innerHTML.includes(code),code+" revenue");
  assert.ok(slots.categoryExpenseSlot.innerHTML.includes(code),code+" expense");
  assert.ok(slots.categorySavingSlot.innerHTML.includes(code),code+" saving");
 }
 inspect('globalThis.SmartBudgetCategoryDistribution={filter(){return {type:"expense",ids:["groceries"],label:"Courses"}}}');
 inspect("renderCategories(metrics())");
 assert.equal(host.innerHTML,"chart-node-must-survive");
 assert.equal(host.dataset.filterType,"expense");
 assert.equal(slots.categoryIncomeSlot.innerHTML,"");
 assert.equal(slots.categorySavingSlot.innerHTML,"");
 assert.match(slots.categoryFilterSlot.innerHTML,/Tout afficher/);
 assert.match(slots.categoryExpenseSlot.innerHTML,/Courses/);
 assert.doesNotMatch(slots.categoryExpenseSlot.innerHTML,/Carburant/);
 inspect('globalThis.SmartBudgetCategoryDistribution={filter(){return null}}');
 inspect("renderCategories(metrics())");
 assert.equal(host.dataset.filterType,"all");
 assert.match(slots.categoryIncomeSlot.innerHTML,/Revenus/);
 assert.match(slots.categorySavingSlot.innerHTML,/Épargne/);
 const page=read("preview/category-distribution/index.html");
 for(const id of ["categoryGrid","categoryFilterSlot","categoryDistribution","categoryIncomeSlot","categoryExpenseSlot","categorySavingSlot"]){
  assert.ok(page.includes('id="'+id+'"'),id);
 }
 assert.match(page,/id="categoryGrid" class="category-layout" data-layout="hybrid"/);
 assert.ok(page.indexOf('id="categoryDistribution"')<page.indexOf('id="categoryIncomeSlot"'));
 assert.ok(page.indexOf('id="categoryIncomeSlot"')<page.indexOf('id="categoryExpenseSlot"'));
 assert.ok(page.indexOf('id="categoryExpenseSlot"')<page.indexOf('id="categorySavingSlot"'));
});
test("PR49 31ul: hybrid A grid is two-up on desktop and one-up on phones",()=>{
 const css=read("preview/category-distribution/preview-polish.css");
 const preview=read("preview/category-distribution/index.html");
 assert.match(css,/PR49 31uk — A-hybrid layout, mobile-first/);
 assert.match(css,/#categories \.category-top\{\s*display:grid;\s*grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,1fr\)/);
 assert.match(css,/#categories #categoryExpenseSlot \.cat-budget-list\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/#categories \.category-top \.income-card \.cat-budget-list,[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/#categories #categorySavingSlot \.saving-card \.cat-budget-list/);
 assert.match(css,/@media\(max-width:68rem\)\{[\s\S]*?#categories \.category-top\{\s*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:47rem\)\{[\s\S]*?#categories #categoryExpenseSlot \.cat-budget-list\{\s*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:47rem\)\{[\s\S]*?#categories \.category-top \.income-card \.cat-budget-list,[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:40rem\)\{[\s\S]*?width:2\.75rem;\s*height:2\.75rem/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/#categories \.cat-budget-tile \.cat-tile-money-button\{\s*max-width:100%/);
 assert.match(preview,/connect-src 'none'/);
 const js=read("preview/category-distribution/category-render-live.js");
 assert.match(js,/gridHost\?\.dataset\?\.layout==="hybrid"/);
 assert.match(js,/gridHost\.dataset\.filterType=filter\?\.type\|\|"all"/);
 assert.match(js,/document\.getElementById\("categoryExpenseSlot"\)\.innerHTML=visibleExpense/);
});


test("PR49 31um: original Smart Budget chrome is present, but other pages are not rendered",()=>{
 const page=read("preview/category-distribution/index.html");
 for(const id of ["householdTitle","settingsBtn","themeToggle","prevMonth","demoMonth","nextMonth",
  "mobileAddButton","mobileQuickAdd","modalBackdrop","demoTransactionForm","amountInput",
  "transactionLabel","transactionDateInput","ownerSwitch","categorySelect","transactionScopeSwitch","saveTransaction"]){
  assert.ok(page.includes('id="'+id+'"'),id);
 }
 for(const text of ["Vue d'ensemble","Catégories","Historique","Suivi","Rentrée d'argent","Dépense",
  "Ajouter une dépense","Ajouter un revenu"]){
  assert.ok(page.includes(text),text);
 }
 assert.match(page,/class="tab active"[^>]*aria-current="page">Catégories/);
 assert.match(page,/class="mobile-nav-item is-active"[^>]*aria-current="page"/);
 assert.equal((page.match(/class="tab" type="button" disabled/g)||[]).length,3);
 assert.equal((page.match(/class="mobile-nav-item" type="button" disabled/g)||[]).length,3);
 assert.doesNotMatch(page,/id="overview"|id="history"|id="tracking"/);
 assert.match(page,/connect-src 'none'/);
 assert.match(page,/role="dialog" aria-modal="true" aria-labelledby="modalTitle"/);
 assert.match(page,/data-demo-add="expense"/);
 assert.match(page,/data-demo-add="income"/);
 const css=read("preview/category-distribution/demo-shell.css");
 assert.match(css,/PR49 31um/);
 assert.match(css,/#categories \.budget-distribution\{\s*align-content:start;\s*grid-auto-rows:max-content/);
 assert.match(css,/#categories \.budget-distribution \.bd-total\{min-height:4\.25rem/);
 assert.match(css,/@media\(max-width:42\.5rem\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 const chart=read("preview/category-distribution/category-distribution.js");
 assert.match(chart,/bd-level bd-level-placeholder/);
 assert.match(chart,/aria-hidden="true"/);
 assert.match(read("preview/category-distribution/mobile-ui.css"),/mobile-bottom-nav__inner/);
});
test("PR49 31um: isolated add-operation controller supports local month and recurrence, and targeted undo",()=>{
 const nodes=new Map(),handlers=new Map();
 function element(id){
  if(nodes.has(id))return nodes.get(id);
  const classNames=new Set();
  const e={
   id,value:"",textContent:"",innerHTML:"",hidden:false,disabled:false,dataset:{},style:{},
   min:"",max:"",options:[],selectedIndex:1,children:[],
   classList:{add:name=>classNames.add(name),remove:name=>classNames.delete(name),
    toggle:(name,on)=>{const yes=on===undefined?!classNames.has(name):!!on;if(yes)classNames.add(name);else classNames.delete(name);return yes},
    contains:name=>classNames.has(name)},
   setAttribute(){},getAttribute(){return null},focus(){},select(){},
   setCustomValidity(){},reportValidity(){return true},reset(){},
   replaceChildren(){this.children=[]},appendChild(child){this.children.push(child)},
   querySelectorAll(){return []},querySelector(){return null},
   addEventListener(type,fn){handlers.set(id+":"+type,fn)}
  };
  nodes.set(id,e);return e;
 }
 const doc={getElementById:element,createElement:tag=>({tag,label:"",value:"",textContent:"",children:[],appendChild(child){this.children.push(child)}}),
  addEventListener(){}};
 const box={document:doc,setTimeout:()=>0,clearTimeout:()=>{},Event:class Event{constructor(type){this.type=type}}};
 vm.createContext(box);
 for(const path of ["demo-state.js","category-render-live.js","demo-chrome.js"]){
  vm.runInContext(read("preview/category-distribution/"+path),box);
 }
 const evalIn=expression=>vm.runInContext(expression,box);
 assert.equal(evalIn("demoDateWithinSelectedMonth()"),"2026-11-22");
 assert.equal(evalIn('demoTransactionCategories("income").length'),2);
 assert.ok(evalIn('demoTransactionCategories("expense").some(c=>c.group==="Épargne")'));
 element("demoMonth").options=[{value:"Octobre 2026"},{value:"Novembre 2026"},{value:"Décembre 2026"}];
 evalIn('openDemoTransactionModal("expense")');
 assert.equal(element("modalBackdrop").classList.contains("open"),true);
 assert.equal(element("modalTitle").textContent,"Ajouter une dépense");
 assert.ok(element("categorySelect").children.length>=3,"expense groups are available");
 assert.equal(element("transactionDateInput").value,"2026-11-22");
 evalIn('closeDemoTransactionModal()');
 assert.equal(element("modalBackdrop").classList.contains("open"),false);
 evalIn('openDemoTransactionModal("income")');
 assert.equal(element("modalTitle").textContent,"Ajouter une rentrée d'argent");
 assert.ok(element("categorySelect").children.length>=1,"income groups are available");
 evalIn('closeDemoTransactionModal()');
 evalIn('demoTransactionType="expense";demoSetOwner("B");demoSetScope("month")');
 element("amountInput").value="17.45";
 element("categorySelect").value="groceries";
 element("transactionDateInput").value="2026-11-22";
 element("transactionDateInput").min="2026-11-01";
 element("transactionDateInput").max="2026-11-30";
 element("transactionLabel").value="Courses fictives";
 const previous=evalIn("state.transactions.length");
 evalIn("demoSaveTransaction({preventDefault(){}})");
 assert.equal(evalIn("state.transactions.length"),previous+1);
 assert.equal(evalIn('state.transactions.at(-1).owner'),"B");
 assert.equal(evalIn('state.transactions.at(-1).amount'),17.45);
 assert.equal(evalIn('state.transactions.at(-1).label'),"Courses fictives");
 assert.equal(evalIn('metrics().expMap.groceries'),203.45);
 evalIn('demoTransactionType="income";demoSetOwner("common");demoSetScope("forward")');
 element("amountInput").value="55.50";
 element("categorySelect").value="salary";
 element("transactionDateInput").value="2026-11-22";
 element("transactionLabel").value="Prime fictive";
 const beforeRecurring=evalIn("state.transactions.length");
 evalIn("demoSaveTransaction({preventDefault(){}})");
 assert.equal(evalIn("state.transactions.length"),beforeRecurring+2,"November and December only");
 assert.equal(evalIn('state.transactions.at(-1).date'),"2026-12-22");
 assert.equal(evalIn('state.transactions.at(-1).recurrent'),true);
 assert.equal(evalIn('metrics().incMap.salary'),1755.5);
 evalIn('state.selectedMonth="Décembre 2026"');
 assert.equal(evalIn('metrics().incMap.salary'),55.5);
 const untracked=evalIn('record("income","salary",11,"common","2026-12-23","Autre opération")');
 box.extraTransaction=untracked;
 evalIn('state.transactions.push(extraTransaction)');
 // A separate transaction must not be removed when undoing the last simulated creation.
 const txBefore=evalIn("state.transactions.length");
 const lastGroup=evalIn('state.transactions.filter(t=>t.recurrenceId&&t.label==="Prime fictive").map(t=>t.id)');
 box.recurIds=lastGroup;
 evalIn('state.transactions=state.transactions.filter(t=>!new Set(recurIds).has(t.id))');
 assert.equal(evalIn("state.transactions.length"),txBefore-2);
 assert.equal(evalIn("metrics().incMap.salary"),11);
 assert.match(read("preview/category-distribution/demo-chrome.js"),/showUndoToast\(created\.length/);
 const source=read("preview/category-distribution/demo-chrome.js").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,"");
 assert.doesNotMatch(source,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|supabase|cloudflare/i);
});
