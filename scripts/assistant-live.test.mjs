import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const base="preview/assistant/live/",html=fs.readFileSync(base+"index.html","utf8"),js=fs.readFileSync(base+"live-ui.js","utf8"),conf=fs.readFileSync(base+"config.js","utf8");
test("pilot keeps ephemeral login and never writes financial data",()=>{assert.match(js,/testtest@id\.budget-foyer\.example\.com/);assert.match(js,/\/functions\/v1\/smart-assistant/);assert.match(js,/\/rest\/v1\/household_members\?/);assert.doesNotMatch(js,/sessionStorage|service_role|SUPABASE_SERVICE|refresh_token|method:"(?:PUT|PATCH|DELETE)"|\/rest\/v1\/(?:transactions|recurrences)/);assert.match(js,/core\.validateResult\(r\.body\.result,ctx\)/);assert.doesNotMatch(html,/id="pilotConsent"/);assert.doesNotMatch(html,/id="confirm"/);assert.match(conf,/sb_publishable_/);assert.doesNotMatch(conf,/service_role|sb_secret_/);});
test("pilot source requires explicit enablement, free plan, and exactly one authorized user and household",()=>{const fn=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");assert.match(fn,/SMART_ASSISTANT_FREE_PLAN_CONFIRMED"\)==="true"/);assert.match(fn,/allowlist\.size===1&&allowedUsers\.size===1/);assert.match(fn,/if\(!solo\|\|actor!=="B"\)return null/);assert.match(fn,/allowedUsers\.has\(user\.id\)/);assert.match(fn,/pilotMembers\[0\]\.user_id!==user\.id/);});

test("pilot review has cache-busted assets and opt-in scoped categorization memory",()=>{assert.match(html,/assistant-core\.js\?v=31r/);assert.match(html,/live-ui\.js\?v=31q/);assert.match(html,/id="ruleEditor"/);assert.match(js,/smart-budget-v31-test-category-rules:/);assert.match(js,/localStorage\.setItem\(key,JSON\.stringify\(\{enabled:true/);assert.match(js,/draftCategorySuggestion/);assert.match(js,/Confirmé en simulation/);});

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
 assert.match(js,/Transféré vers l’épargne · pas une dépense/);
 assert.match(js,/Net revenus \/ dépenses · hors épargne/);
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
 assert.match(js,/Libellé : /);
 assert.match(css,/\.pilot-expense-detail/);
});
