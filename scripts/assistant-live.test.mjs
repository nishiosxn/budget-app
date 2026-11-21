import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const base="preview/assistant/live/",html=fs.readFileSync(base+"index.html","utf8"),js=fs.readFileSync(base+"live-ui.js","utf8"),conf=fs.readFileSync(base+"config.js","utf8");
test("pilot keeps ephemeral login and no direct browser financial writes",()=>{assert.match(js,/testtest@id\.budget-foyer\.example\.com/);assert.match(js,/\/functions\/v1\/smart-assistant/);assert.match(js,/\/rest\/v1\/household_members\?/);assert.doesNotMatch(js,/sessionStorage|service_role|SUPABASE_SERVICE|refresh_token|method:"(?:PUT|PATCH|DELETE)"|\/rest\/v1\/(?:transactions|recurrences)/);assert.match(js,/core\.validateResult\(r\.body\.result,ctx\)/);assert.doesNotMatch(html,/id="pilotConsent"/);assert.doesNotMatch(html,/id="confirm"/);assert.match(conf,/sb_publishable_/);assert.doesNotMatch(conf,/service_role|sb_secret_/);});
test("pilot source requires explicit enablement, free plan, and exactly one authorized user and household",()=>{const fn=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");assert.match(fn,/SMART_ASSISTANT_FREE_PLAN_CONFIRMED"\)==="true"/);assert.match(fn,/allowlist\.size===1&&allowedUsers\.size===1/);assert.match(fn,/if\(!solo\|\|actor!=="B"\)return null/);assert.match(fn,/allowedUsers\.has\(user\.id\)/);assert.match(fn,/pilotMembers\[0\]\.user_id!==user\.id/);});

test("pilot review has cache-busted assets and opt-in scoped categorization memory",()=>{assert.match(html,/assistant-core\.js\?v=31z/);assert.match(html,/live-ui\.js\?v=31w/);assert.match(html,/id="ruleEditor"/);assert.match(js,/smart-budget-v31-test-category-rules:/);assert.match(js,/localStorage\.setItem\(key,JSON\.stringify\(\{enabled:true/);assert.match(js,/draftCategorySuggestion/);assert.match(js,/Confirmé en simulation/);});

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
 assert.match(html,/review-editor\.js\?v=31t/);
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
 assert.match(js,/Enregistrement réel · foyer test uniquement/);
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
