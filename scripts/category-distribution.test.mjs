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
 assert.match(html,/js\/category-distribution\.js\?v=31ui/);
 assert.match(html,/css\/category-distribution\.css\?v=31ui/);
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
 assert.equal(read("preview/category-distribution/category-distribution.js"),read("js/category-distribution.js"));
});



test("PR49 31ui: preview reuses exact published category handlers and source CSS",()=>{
 const live=read("preview/category-distribution/categories-live.js");
 const repoHandlers=read("js/categories.js");
 assert.equal(live,repoHandlers,"demo behavior remains identical to app category handler");
 const page=read("preview/category-distribution/index.html");
 for(const key of ["category-render-live.js","categories-live.js","category-prototype.js","demo-state.js","demo-init.js","app-style.css","preview-polish.css"]){
  assert.ok(page.includes(key+"?v=31ui"),key);
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
 for(const key of ["Dépenses","Épargne","Obligatoires","Abonnements","Vie courante","data-fill-category","data-demo-settings","data-delete-category","data-edit-actual","data-edit-planned","data-add-category","data-add-saving","data-demo-fill-all","data-demo-clear-all","data-category-details-toggle","role=\"progressbar\""]){
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
 assert.match(css,/PR49 31ui/);
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
 assert.match(css,/PR49 31ui — Category rows and neutral states/);
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
 for(const key of ["cat-budget-list","cat-budget-tile","cat-progress-track","data-fill-category","data-edit-actual","data-edit-planned","data-demo-settings","data-delete-category","data-demo-fill-all","data-demo-clear-all","data-category-details-toggle","role=\"progressbar\""]){
  assert.ok(html.includes(key),key);
 }
 assert.ok(html.includes("Tout remplir")&&html.includes("Tout vider"));
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
 assert.equal(probe('prototypeBulkActual("expense","Vie courante","fill")'),2);
 assert.equal(probe("metrics().expMap.groceries"),250);
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
 assert.equal(probe('categorySectionOf(catById("car","expense"))'),"Abonnements");
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
 assert.ok(html.includes('category-prototype.js?v=31ui'));
 assert.match(html,/connect-src 'none'/);
 assert.match(js,/prototypeBulkActual/);
 assert.match(js,/categoryTransactionSnapshot/);
 assert.match(js,/showUndoToast/);
 assert.match(js,/setCategoryActual/);
 assert.match(js,/setCategoryPlan/);
 assert.match(js,/renameCategory/);
 assert.match(boot,/backdrops=\[categoryEditBackdrop,categoryDeleteBackdrop,categorySettingsBackdrop\]/);
 assert.match(boot,/event\.shiftKey/);
 assert.match(boot,/closeCategorySettings\(\)/);
 assert.match(css,/\.sb-settings-field\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,""),/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b/);
});
