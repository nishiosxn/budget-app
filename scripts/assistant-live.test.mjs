import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import vmFixture from "node:vm";
const base="preview/assistant/live/",html=fs.readFileSync(base+"index.html","utf8"),js=fs.readFileSync(base+"live-ui.js","utf8"),conf=fs.readFileSync(base+"config.js","utf8");
test("pilot keeps ephemeral login and no direct browser financial writes",()=>{assert.match(js,/testtest@id\.budget-foyer\.example\.com/);assert.match(js,/\/functions\/v1\/smart-assistant/);assert.match(js,/\/rest\/v1\/household_members\?/);assert.doesNotMatch(js,/sessionStorage|service_role|SUPABASE_SERVICE|refresh_token|method:"(?:PUT|PATCH|DELETE)"|\/rest\/v1\/(?:transactions|recurrences)/);assert.match(js,/core\.validateResult\(r\.body\.result,ctx\)/);assert.doesNotMatch(html,/id="pilotConsent"/);assert.doesNotMatch(html,/id="confirm"/);assert.match(conf,/sb_publishable_/);assert.doesNotMatch(conf,/service_role|sb_secret_/);});
test("pilot source requires explicit enablement, free plan, and exactly one authorized user and household",()=>{const fn=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");assert.match(fn,/SMART_ASSISTANT_FREE_PLAN_CONFIRMED"\)==="true"/);assert.match(fn,/allowlist\.size===1&&allowedUsers\.size===1/);assert.match(fn,/if\(!solo\|\|actor!=="B"\)return null/);assert.match(fn,/allowedUsers\.has\(user\.id\)/);assert.match(fn,/pilotMembers\[0\]\.user_id!==user\.id/);});

test("pilot review has cache-busted assets and opt-in scoped categorization memory",()=>{assert.match(html,/assistant-core\.js\?v=31ai/);assert.match(html,/live-ui\.js\?v=31aj/);assert.match(html,/id="ruleEditor"/);assert.match(js,/smart-budget-v31-test-category-rules:/);assert.match(js,/localStorage\.setItem\(key,JSON\.stringify\(\{enabled:true/);assert.match(js,/draftCategorySuggestion/);assert.match(js,/Simulation terminée/);});

test("submitted prompt remains visible in memory above status and results, even before network response",()=>{assert.ok(html.indexOf('id="pilotSubmitted"')<html.indexOf('id="sbAssistantResult"'));assert.match(js,/\$\("pilotSubmittedText"\)\.textContent=command;\$\("pilotSubmitted"\)\.hidden=false/);assert.match(js,/\$\("pilotSubmittedText"\)\.textContent=""/);});

test("compact pilot UI has an aligned composer and live server-meter after the household card",()=>{
 const css=fs.readFileSync(base+"live.css","utf8");
 assert.ok(html.indexOf('id="pilotSession"')<html.indexOf('id="pilotAssistant"'));
 for(const id of ["pilotQuotaText","pilotQuotaBar","pilotRequests","pilotQuotaRemaining","pilotLastUsage"])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer \.sb-assistant-actions/);
 assert.doesNotMatch(js,/consent\.checked|pilotConsent|consent\.addEventListener/);
 assert.match(js,/action:"usage"/);
 assert.match(js,/void refreshQuota\(\)/);
 assert.match(js,/0 token IA · 0 neurone/);
 assert.match(js,/tokens non fournis par Cloudflare/);
 assert.match(html,/texte transmis à Cloudflare/);
});

test("composer starts on one line and grows without manual resize",()=>{
 const css=fs.readFileSync(base+"live.css","utf8");
 assert.match(html,/<textarea id="sbAssistantInput" rows="1"/);
 assert.match(html,/assistant-voice\.js\?v=31l/);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer #sbAssistantInput\{[^}]*height:42px;min-height:42px;max-height:180px/);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer #sbAssistantInput\{[^}]*resize:none/);
 assert.doesNotMatch(css,/#pilotAssistant \.sb-assistant-composer #sbAssistantInput\{[^}]*resize:vertical/);
 assert.doesNotMatch(css,/#pilotAssistant \.sb-assistant-composer #sbAssistantInput\{[^}]*height:85px/);
 assert.match(js,/const contentHeight=input\.scrollHeight/);
 assert.match(js,/input\.style\.height="auto"/);
 assert.match(js,/input\.style\.overflowY=contentHeight>180\?"auto":"hidden"/);
 assert.match(js,/input\.addEventListener\("input",resizeComposer\)/);
 assert.match(js,/onTextChange:resizeComposer/);
 assert.match(js,/input\.value=b\.dataset\.assistantSuggestion;resizeComposer\(\)/);
 assert.match(js,/input\.value="";resizeComposer\(\)/);
});

test("visible source marker and savings transfer remain distinct from expenses",()=>{
 const css=fs.readFileSync(base+"live.css","utf8");
 assert.match(js,/status\.dataset\.source=local\?"smart-engine":"gemma"/);
 assert.match(js,/Smart Engine · 0 token IA/);
 assert.match(js,/Gemma 4 · /);
 assert.match(css,/data-source="smart-engine"/);
 assert.match(css,/data-source="gemma"/);
 assert.match(js,/o\.kind==="saving"\?"pilot-plan"/);
 assert.match(js,/if\(o\.kind==="saving"\)meta\.push\("Épargne"\)/);
 assert.doesNotMatch(js,/Net revenus \/ dépenses · hors épargne|Variation du solde disponible/);
});

test("personal rules load real household categories on login without asking the AI",()=>{
 assert.match(html,/category-rules\.js\?v=31o/);
 assert.match(html,/id="ruleMerchant"/);
 assert.match(html,/id="ruleCategory"/);
 assert.match(html,/id="ruleEditor"/);
 assert.match(html,/id="ruleStatus"/);
 assert.doesNotMatch(html,/id="rememberRules"/);
 assert.match(js,/\/rest\/v1\/categories\?select=id,legacy_id,name,type,is_saving,owner_slot,created_from,excluded_months/);
 assert.match(js,/household_id=eq\."\+encodeURIComponent\(householdId\)/);
 assert.match(js,/void loadRuleCategories\(\)/);
 assert.match(js,/const categories=ruleUtils\.fromRows\(r\.body\)/);
 assert.match(js,/for\(const \[kind,label\] of \[\["expense","Dépenses"\],\["income","Revenus"\],\["saving","Épargne"\]\]/);
 assert.match(js,/ruleUtils\.resolve\(o,ctx\.categories,personalRules\)/);
 assert.doesNotMatch(js,/rememberRules/);
 assert.match(js,/\$\("ruleEditor"\)\.addEventListener\("submit"/);
 assert.match(js,/function savePersonal\(\)/);
 assert.doesNotMatch(js,/method:"(?:PUT|PATCH|DELETE)"/);
});

test("selector uses all automatic categories plus unique household-specific categories",()=>{
 const coreSource=fs.readFileSync("js/assistant-core.js","utf8");
 assert.match(js,/ruleUtils\.catalogOptions\(categories\)/);
 assert.match(js,/ruleUtils\.catalogOptions\(ruleContext\?\.categories\|\|\[\]\)/);
 assert.match(js,/remembered\?\.ruleKey\|\|suggestion\?\.ruleKey/);
 assert.match(html,/sa création sera proposée/);
 assert.match(html,/category-rules\.js\?v=31o/);
 assert.match(coreSource,/name": "Restaurants \/ fast-food"/);
});

test("merchant and optional explicit expense label render separately",()=>{
 const css=fs.readFileSync(base+"live.css","utf8");
 assert.match(js,/core\.expenseLabelParts\(o\.label\)/);
 assert.match(js,/detailLabel\.textContent=parts\.detail/);assert.doesNotMatch(js,/detailLabel\.textContent="Libellé : "/);
 assert.match(css,/\.pilot-expense-detail/);
});

test("inline review edits are local, with read-only budget lookup and no write endpoints",()=>{
 assert.match(html,/review-editor\.js\?v=31ai/);
 assert.match(js,/reviewEditor\.fromFields\(entry,values,ctx\)/);
 assert.match(js,/entries\.splice\(i,1\);sync\(\);draw\(\)/);
 assert.match(js,/reviewEditor\.validate\(entries,ctx\)/);
 assert.match(js,/reviewEditor\.categoryFromFields\(draft,fields,ctx\)/);
 assert.match(js,/readEditedBudget\(next\.op\)/);
 assert.match(js,/ok\.disabled=locked\|\|busy\|\|editing!==-1\|\|!checked\.ok/);
 assert.doesNotMatch(js,/method:"(?:PUT|PATCH|DELETE)"|\/rest\/v1\/(?:transactions|recurrences)/);
});

test("expense budget uses signed-in household read-only data and local projection",()=>{
 assert.match(js,/function readExpenseBudget\(op\)/);
 assert.match(js,/read\("transactions",\{select:"category_id,transaction_date,amount,metadata"/);
 assert.match(js,/read\("recurrences",\{select:"category_id,amount,start_month,end_month,excluded_months,overrides,metadata"/);
 assert.match(js,/read\("budgets",\{select:"month,planned_amount,scope"/);
 assert.match(js,/household_id:"eq\."\+householdId,archived_at:"is.null",limit:"1000"/);
 assert.match(js,/r\.body\.length<1000/);
 assert.match(js,/method:"GET",headers:headers\(token\)/);
 assert.match(js,/reviewEditor\.expenseBudget\(entry,saved\?\[\]:entries,report\)/);
 assert.match(js,/reviewEditor\.newBudgetEntry\(entry,values\.budget,ctx\)/);
 assert.match(js,/fillReviewOptions\(controls\.category,opts\)/);
 assert.match(js,/Aucun budget défini/);
 assert.match(js,/if\(!pane\.isConnected\)return/);
 assert.doesNotMatch(js,/method:"(?:PUT|PATCH|DELETE)"/);
});

test("31u design system is scoped to pilot, with concentric radii, responsive and accessible control tokens",()=>{
 const design=fs.readFileSync(base+"design-system.css","utf8"),charter=fs.readFileSync("docs/SMART_BUDGET_DESIGN_SYSTEM.md","utf8");
 assert.match(html,/design-system\.css\?v=31y/);
 assert.ok(html.indexOf("design-system.css?v=31y")>html.indexOf("live.css?v=31t"));
 assert.match(design,/--sb-brand:#5C29D6/);
 assert.match(design,/--sb-card-radius:calc\(var\(--sb-shell-radius\) - var\(--sb-shell-pad\)\)/);
 assert.match(design,/--sb-touch:44px/);
 assert.match(design,/--sb-progress:6px/);
 assert.match(design,/prefers-color-scheme:dark/);
 assert.match(design,/prefers-reduced-motion:reduce/);
 assert.match(design,/@media\(max-width:380px\)/);
 assert.match(design,/\.pilot-expense-budget\{[^}]*border-top:1px solid var\(--sb-line\)/);
 assert.match(design,/\.pilot-review\{[^}]*border:0/);
 assert.match(charter,/R_int = max\(0, R_ext - inset\)/);
 assert.match(js,/t\.textContent="Budget"/);
 assert.match(js,/spent\.textContent="Utilisé : "/);
 assert.match(js,/bar\.setAttribute\("aria-valuetext"/);
 assert.match(js,/group\.append\(card\);renderExpenseBudget\(card,entry,i\)/);
 assert.match(js,/compactReviewAction\("Modifier","edit"\)/);
 assert.match(js,/compactReviewAction\("Retirer","remove"\)/);
 assert.match(js,/creation\.textContent="À créer : "/);
 assert.doesNotMatch(js,/tag\.textContent=" · Nouvelle"/);
 assert.match(js,/closeReviewForm\(panel,after\)/);
 assert.match(js,/duration:160/);
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(js,/if\(!active\(\)\|\|editing!==i\)return;entries\[i\]=next/);
});

test("explicit pilot write only through authenticated confirm route; unsupported drafts are simulated",()=>{
 assert.match(js,/action:"confirm",householdId:session\.householdId,requestId,draft/);
 assert.match(js,/crypto\.randomUUID\(\)/);
 assert.match(js,/function canSavePilot/);
 assert.match(js,/if\(!real\)\{locked=true/);
 assert.match(js,/r\.body\.commit\?\.requestId!==requestId/);
 assert.match(js,/budgetReads\.clear\(\)/);
 assert.match(js,/send\.disabled=true;\$\("cancel"\)\.disabled=true/);
 assert.match(js,/Confirmation atomique · foyer test uniquement/);
 assert.doesNotMatch(js,/method:"(?:PUT|PATCH|DELETE)"/);
});


test("analysis releases busy before rendering a valid review, while saving remains guarded",async()=>{
 const vm=await import("node:vm");
 // Execute the actual submit callback in a controlled environment.
 const begin=js.indexOf('form.addEventListener("submit",async e=>{'),end=js.lastIndexOf("\n})();");
 assert.ok(begin>=0&&end>begin);
 for(const kind of ["draft","categoryDraft"]){
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};
  const state={kind},observed=[];
  const ctx={
   session:{token:"test",householdId:"test"},busy:false,epoch:0,pendingReview:null,history:[],
   send:{disabled:false},input:{value:"test prompt"},status:{dataset:{}},result:{replaceChildren(){}},
   form:{addEventListener(type,callback){assert.equal(type,"submit");ctx.submit=callback}},
   $:node,voice:{stop(){}},resizeComposer(){},headers(){return {}},
   json:async()=>({ok:true,status:200,body:{context:{},result:state,metering:{source:"local-rules"}}}),
   core:{validateReview:()=>({ok:true,value:state}),validateCategoryDraft:()=>({ok:true,value:state})},
   displayLastMeter(){},refreshQuota:async()=>{},
   renderDraft(){observed.push({busy:ctx.busy,sendDisabled:ctx.send.disabled})},
   renderCategoryDraft(){observed.push({busy:ctx.busy,sendDisabled:ctx.send.disabled})},
   Intl
  };
  vm.runInNewContext(js.slice(begin,end),ctx);
  await ctx.submit({preventDefault(){}});
  assert.deepEqual(observed,[{busy:false,sendDisabled:true}],kind);
  assert.equal(ctx.busy,false);assert.equal(ctx.send.disabled,false);
 }
 assert.match(js,/ok\.disabled=locked\|\|busy\|\|editing!==-1\|\|!checked\.ok/);
 assert.match(js,/setSavingPilot\(true\);draw\(\)/);
});

test("31y quota and rules panel have one optical inset, controlled markers, mobile and focus states",()=>{
 const css=fs.readFileSync(base+"design-system.css","utf8");
 assert.match(html,/design-system\.css\?v=31y/);
 assert.match(html,/class="pilot-meter-disclaimer"/);
 assert.match(css,/#pilotSession\.card\.ledger,#pilotAssistant\.card\.sb-assistant\{/);
 assert.match(css,/#pilotSession #pilotMeter\{/);
 assert.match(css,/#pilotAssistant #pilotRules\{[^}]*padding:0/);
 assert.match(css,/#pilotAssistant #pilotRules > summary\{[^}]*padding:var\(--sb-s12\) var\(--sb-shell-pad\)/);
 assert.match(css,/#pilotAssistant #pilotRules > :not\(summary\)\{[^}]*margin-inline:var\(--sb-shell-pad\)/);
 assert.match(css,/#pilotAssistant #pilotRules > summary::-webkit-details-marker/);
 assert.match(css,/#pilotAssistant #pilotRules\[open\] > summary::after/);
 assert.match(css,/#pilotMeter #pilotQuotaBar\{[^}]*height:var\(--sb-progress\)/);
 assert.match(css,/#pilotMeter #pilotLastUsage\{[^}]*background:transparent/);
 assert.match(css,/#pilotAssistant #pilotRules :is\(summary,input,select,button\):focus-visible/);
 assert.match(css,/@media\(max-width:380px\)\{[\s\S]*?#pilotAssistant #pilotRules > \.pilot-rule-editor/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?#pilotMeter #pilotQuotaBar/);
});

test("31aa: mixed review stays simulation-only and validates category creation separately",()=>{
 assert.match(js,/function renderMixedDraft\(/);
 assert.match(js,/core\.validateMixedDraft\(/);
 assert.match(js,/Création de catégorie/);
 assert.match(js,/Nouveau budget/);
 assert.match(js,/Simulation uniquement · aucune écriture/);
 assert.match(js,/else if\(v\.kind==="mixedDraft"\)\{renderMixedDraft/);
});


test("31ab: mixed review renders the 31z card structure, controls and no runtime error",async()=>{
 const vm=await import("node:vm"),source=js;
 const helperStart=source.indexOf(" const iconPaths=");
 const helperEnd=source.indexOf(" function renderCategoryDraft(",helperStart);
 const begin=source.indexOf(" function mixedBudgetBar("),end=source.indexOf(" function renderCategoryReport(",begin);
 assert.ok(helperStart>=0&&begin>=0&&end>begin);
 const events=[];
 class Node{
  constructor(tag="div"){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attrs={};this.isConnected=true;this.disabled=false;this.className="";this.textContent="";this.listeners={};}
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children}
  setAttribute(name,value){this.attrs[name]=String(value)}
  addEventListener(type,callback){this.listeners[type]=callback}
  click(){this.listeners.click?.()}
 }
 const nodes=[];
 const context={
  document:{createElement(tag){const n=new Node(tag);nodes.push(n);return n},createElementNS(_,tag){return new Node(tag)}},
  result:new Node(),ctx:null,core:{categoryRules:[{key:"home",name:"Maison / entretien",kind:"expense",aliases:["Maison"],icon:"home"}],normalizeCategory:s=>String(s).toLowerCase(),validateMixedDraft:v=>({ok:true,value:v}),validateReview:v=>({ok:true,value:v})},
  reviewEditor:{key:o=>o.categoryId+"|"+o.date.slice(0,7),planPreview:e=>e.baseline?{beforeCents:e.baseline.beforeCents,afterCents:e.baseline.beforeCents+e.op.amountCents}:null,cents:()=>1000,money:v=>String(v/100),categoryFromFields:()=>({ok:false,error:"non testé"})},
  euro:n=>(n/100).toFixed(2)+" €",busy:false,pendingReview:null,history:[],status:{dataset:{},textContent:""},
  readExpenseBudget:async()=>({actualCents:1200}),monthReviewDate:()=> "nov.",
  reviewButton:label=>{const n=new Node("button");n.textContent=label;events.push(n);return n},
  compactReviewAction:label=>{const n=new Node("button");n.textContent=label;return n},
  reviewForm:()=>{},wipe:()=>{}
 };
 vm.createContext(context);
 vm.runInContext(source.slice(helperStart,helperEnd)+"\n"+source.slice(begin,end),context);
 const ctx={categories:[{id:"home",name:"Maison / entretien",kind:"expense",owner:"B"}],firstMonth:"2026-01",lastMonth:"2028-12",today:"2026-11-21",solo:false,actor:"B"};
 const draft={kind:"mixedDraft",operations:[{kind:"plan",categoryId:"home",owner:"B",amountCents:1000,date:"2026-11-01",label:"Maison",frequency:"once",planMode:"increase"}],categories:[{kind:"categoryDraft",name:"Lego",owner:"B",month:"2026-11",date:"2026-11-21",budgetCents:6000,expenseCents:null}]};
 context.renderMixedDraft(draft,ctx,[{index:0,beforeCents:5000,afterCents:6000}]);
 assert.equal(context.result.children.length,1);
 const group=context.result.children[0];
 assert.equal(group.children.length,4,"two cards, note, actions");
 assert.equal(group.children[0].className,"pilot-op");
 assert.equal(group.children[1].className,"pilot-op");
 assert.equal(group.children[0].children[0].className,"pilot-op-top");
 assert.equal(group.children[1].children[0].className,"pilot-op-top");
 assert.ok(group.children[0].children.some(n=>n.className==="pilot-op-controls"));
 assert.ok(group.children[1].children.some(n=>n.className==="pilot-op-controls"));
 assert.ok(events.some(n=>n.textContent==="Simuler"));
 await Promise.resolve();await Promise.resolve();
 const gauge=nodes.some(n=>n.attrs.role==="progressbar");assert.equal(gauge,true);
 const sim=events.find(n=>n.textContent==="Simuler");
 assert.equal(sim.disabled,false);sim.click();
 assert.equal(context.status.textContent,"Simulation terminée · aucune écriture.");
 assert.equal(group.children.length,4);
});


test("31ac: standalone Gundam category uses normal card and a visible 90-euro budget bar",()=>{
 const vm=vmFixture;
 const start=js.indexOf(" const iconPaths="),catStart=js.indexOf(" function renderCategoryDraft(",start);
 const catEnd=js.indexOf(" // Compound previews",catStart);
 const budgetStart=js.indexOf(" function mixedBudgetBar("),budgetEnd=js.indexOf(" function renderMixedDraft(",budgetStart);
 assert.ok(start>=0&&catStart>start&&catEnd>catStart&&budgetStart>catEnd&&budgetEnd>budgetStart);
 class Node{
  constructor(tag="div"){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.className="";this.textContent="";this.disabled=false;this.listeners={};}
  append(...xs){this.children.push(...xs)}
  replaceChildren(...xs){this.children=xs}
  setAttribute(name,value){this.attrs[name]=String(value)}
  addEventListener(type,cb){this.listeners[type]=cb}
  click(){this.listeners.click?.()}
 }
 const nodes=[],root=new Node(),buttons=[];
 const doc={createElement(tag){const n=new Node(tag);nodes.push(n);return n},createElementNS(_ns,tag){return new Node(tag)}};
 const context={
  document:doc,result:root,busy:false,pendingReview:null,history:[],status:{dataset:{},textContent:""},
  euro:n=>(n/100).toFixed(2)+" €",
  monthReviewDate:()=> "nov.",
  core:{validateCategoryDraft:v=>({ok:true,value:v})},
  reviewEditor:{money:n=>n===null?"":String(n/100),categoryFromFields:()=>({ok:false,error:"not used"})},
  reviewButton:label=>{const n=new Node("button");n.textContent=label;buttons.push(n);return n},
  compactReviewAction:label=>{const n=new Node("button");n.textContent=label;return n},
  reviewForm:()=>{},wipe:()=>{},reviewRow:(label,value)=>{const n=new Node();n.textContent=label+" "+value;return n}
 };
 vm.createContext(context);
 vm.runInContext(js.slice(start,catEnd)+"\n"+js.slice(budgetStart,budgetEnd),context);
 const ctx={today:"2026-11-21",firstMonth:"2026-01",lastMonth:"2028-12"};
 const draft={kind:"categoryDraft",name:"Gundam",owner:"B",month:"2026-11",date:"2026-11-21",budgetCents:9000,expenseCents:null};
 context.renderCategoryDraft(draft,ctx);
 assert.equal(root.children.length,1);
 const group=root.children[0],card=group.children[0];
 assert.equal(card.className,"pilot-op");
 assert.equal(card.children[0].className,"pilot-op-top");
 assert.equal(card.children[0].children[0].className,"pilot-op-icon");
 assert.equal(card.children[0].children[2].className,"pilot-op-money pilot-plan");
 assert.equal(card.children[0].children[2].textContent,"90.00 €");
 const pane=card.children.find(n=>n.className==="pilot-expense-budget");
 assert.ok(pane,"same budget panel as standard expense cards");
 const bar=pane.children.find(n=>n.className==="pilot-exp-budget-track");
 assert.ok(bar,"budget usage bar must always exist for a newly-created 90 € category");
 assert.equal(bar.attrs.role,"progressbar");
 assert.equal(bar.attrs["aria-valuenow"],"0");
 assert.equal(bar.children[0].style.width,"0%");
 assert.ok(card.children.some(n=>n.className==="pilot-op-controls"),"edit action matches regular cards");
 const simulate=buttons.find(n=>n.textContent==="Simuler");
 assert.ok(simulate&&!simulate.disabled);
 simulate.click();
 assert.equal(context.status.textContent,"Simulation terminée · aucune écriture.");
});

test("31ae: pilot-wide native-style deep-dark layer is isolated, coherent and accessible",()=>{
 const theme=fs.readFileSync(base+"native-dark.css","utf8");
 assert.ok(html.indexOf('design-system.css?v=31y')<html.indexOf('native-dark.css?v=31af'),"dark layer loads after legacy styles");
 assert.match(theme,/:root:root\s*\{[^}]*color-scheme:\s*dark/s,"force deep dark even with a light OS");
 const variables=["sb-brand","sb-bg","sb-surface","sb-secondary","sb-elevated","sb-line","sb-control-line","sb-ink","sb-muted","sb-accent","sb-positive","sb-negative","sb-shell-pad","sb-card-pad","sb-icon-box","sb-progress"];
 for(const key of variables)assert.match(theme,new RegExp("--"+key+":\\s*[^;]+;"),key);
 for(const selector of [
   "body","main",".brand","#pilotLogin","#pilotSession","#pilotMeter",
   ".sb-assistant-hero",".sb-assistant-suggestions",".sb-assistant-composer",
   "#pilotSubmitted","#sbAssistantStatus","#sbAssistantResult",
   ".pilot-review",".pilot-op",".pilot-op-top",".pilot-op-icon",
   ".pilot-op-money",".pilot-expense-budget",".pilot-exp-budget-track",
   ".pilot-review-actions",".pilot-operation-editor",".pilot-editor-field",
   ".pilot-compact-action","#pilotRules"
 ])assert.ok(theme.includes(selector),"Missing style coverage: "+selector);
 assert.match(theme,/#pilotAssistant \.pilot-op-top\s*\{[^}]*align-items:\s*center/s);
 assert.match(theme,/#pilotAssistant \.pilot-exp-budget-foot,[\s\S]*?justify-content:\s*space-between/);
 assert.match(theme,/@media\s*\(max-width:\s*42rem\)/);
 assert.match(theme,/@media\s*\(max-width:\s*23\.75rem\)/);
 assert.match(theme,/@media\s*\(prefers-contrast:\s*more\)/);
 assert.match(theme,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
 assert.match(theme,/:focus-visible/);
 assert.doesNotMatch(theme,/@import|https?:\/\/|url\(/i,"pilot visuals have no external font or asset dependency");
 const parse=k=>{
  const re=new RegExp("--"+k+":\\s*(#[\\da-fA-F]{6})\\s*;");
  const m=theme.match(re);assert.ok(m,"missing solid color token "+k);return m[1].slice(1).match(/../g).map(x=>parseInt(x,16)/255);
 };
 const luminance=v=>v.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const x=luminance(parse(a)),y=luminance(parse(b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 assert.ok(contrast("sb-ink","sb-surface")>=7);
 assert.ok(contrast("sb-muted","sb-surface")>=4.5);
 assert.ok(contrast("sb-positive","sb-surface")>=4.5);
 assert.ok(contrast("sb-negative","sb-surface")>=4.5);
});


test("31af: neutral dark surfaces and fixed square composer actions",()=>{
 const css=fs.readFileSync(base+"native-dark.css","utf8");
 for(const token of ["--sb-bg: #0d0e10;","--sb-surface: #181a1d;","--sb-secondary: #222428;","--sb-elevated: #2b2e33;","--sb-brand: #5c29d6;"])
  assert.ok(css.includes(token),token);
 assert.match(css,/background:\s*linear-gradient\(180deg,\s*#101115/);
 assert.doesNotMatch(css,/radial-gradient\(ellipse 55rem 30rem at 50% -15rem/);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer :is\(#mic,#send\)\s*\{[^}]*box-sizing:\s*border-box/s);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer :is\(#mic,#send\)\s*\{[^}]*place-items:\s*center/s);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer :is\(#mic,#send\)\s*\{[^}]*aspect-ratio:\s*1 \/ 1/s);
 assert.match(css,/#pilotAssistant \.sb-assistant-composer :is\(#mic,#send\) svg\s*\{[^}]*margin:\s*auto/s);
 assert.match(html,/assistant-core\.js\?v=31ai/);
 assert.match(html,/native-dark\.css\?v=31af/);
});
test("31af: explicit category confirmation has unique retry token and never creates through a spending card",()=>{
 assert.match(js,/function categoryExplicitIntent\(command\)/);
 assert.match(js,/action:"confirm_category"/);
 assert.match(js,/if\(!requestId\)requestId=crypto\.randomUUID\(\)/);
 assert.match(js,/const canWrite=ctx\.solo&&ctx\.actor==="B"&&categoryExplicitIntent\(sourceCommand\)/);
 assert.match(js,/const canWrite=ctx\.solo&&ctx\.actor==="B"&&categoryExplicitIntent\(sourceCommand\)/);
 assert.match(js,/catégorie, son budget et la dépense initiale ensemble/);
 assert.match(js,/canWrite\?"Confirmer":"Simuler"/);
 assert.match(js,/r\.body\.commit\.requestId===requestId/);
 assert.match(js,/renderCategoryDraft\(v,ctx,command\)/);
 assert.match(js,/void loadRuleCategories\(\)/);
});


test("31ai: explicit category with initial expense is confirmable and monthly forward semantics are displayed",()=>{
 assert.match(js,/const canWrite=ctx\.solo&&ctx\.actor==="B"&&categoryExplicitIntent\(sourceCommand\)/);
 assert.doesNotMatch(js,/const canWrite=[^\n]+expenseCents===null/);
 assert.match(js,/Budget mensuel reconduit/);
 assert.match(js,/savePilotCategory\(requestId,sourceCommand,draft\)/);
 assert.match(js,/status\.textContent="Catégorie/);
 assert.match(js,/r\.body\.commit\.expenseCreated/);
 assert.match(js,/edit\.disabled=requestId!==null/);
 assert.match(html,/review-editor\.js\?v=31ai/);
 assert.match(html,/live-ui\.js\?v=31aj/);
});


test("31aj: budget and mixed category batches remain reviewed, atomic and replay-safe",()=>{
 assert.match(js,/action:"confirm_batch"/);
 assert.match(js,/const batch=canSaveBatch\(entries,ctx\)/);
 assert.match(js,/const expectation=entries\.flatMap/);
 assert.match(js,/saveBatchDraft\(requestId,sourceCommand,batchDraft,expectation\)/);
 assert.match(js,/function renderMixedDraft\(v,ctx,previews,sourceCommand\)/);
 assert.match(js,/new Set\(draft\.operations\.map\(op=>op\.categoryId\)\)/);
 assert.match(js,/saveBatchDraft\(requestId,sourceCommand,draft,expectation\)/);
 assert.match(js,/r\.body\.commit\?\.categoriesCreated!==draft\.categories\.length/);
 assert.match(js,/requestId=crypto\.randomUUID\(\)/);
 assert.match(html,/live-ui\.js\?v=31aj/);
});
