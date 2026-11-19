import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const base="preview/assistant/live/",html=fs.readFileSync(base+"index.html","utf8"),js=fs.readFileSync(base+"live-ui.js","utf8"),conf=fs.readFileSync(base+"config.js","utf8");
test("pilot keeps ephemeral login and never writes financial data",()=>{assert.match(js,/testtest@id\.budget-foyer\.example\.com/);assert.match(js,/\/functions\/v1\/smart-assistant/);assert.match(js,/\/rest\/v1\/household_members\?/);assert.doesNotMatch(js,/sessionStorage|service_role|SUPABASE_SERVICE|refresh_token|method:"(?:PUT|PATCH|DELETE)"|\/rest\/v1\/(?:transactions|recurrences)/);assert.match(js,/core\.validateResult\(r\.body\.result,ctx\)/);assert.doesNotMatch(html,/id="pilotConsent"/);assert.doesNotMatch(html,/id="confirm"/);assert.match(conf,/sb_publishable_/);assert.doesNotMatch(conf,/service_role|sb_secret_/);});
test("pilot source requires explicit enablement, free plan, and exactly one authorized user and household",()=>{const fn=fs.readFileSync("supabase/functions/smart-assistant/index.ts","utf8");assert.match(fn,/SMART_ASSISTANT_FREE_PLAN_CONFIRMED"\)==="true"/);assert.match(fn,/allowlist\.size===1&&allowedUsers\.size===1/);assert.match(fn,/if\(!solo\|\|actor!=="B"\)return null/);assert.match(fn,/allowedUsers\.has\(user\.id\)/);assert.match(fn,/pilotMembers\[0\]\.user_id!==user\.id/);});

test("pilot review has cache-busted assets and opt-in scoped categorization memory",()=>{assert.match(html,/assistant-core\.js\?v=31j/);assert.match(html,/live-ui\.js\?v=31l/);assert.match(html,/id="rememberRules"/);assert.match(js,/smart-budget-v31-test-category-rules:/);assert.match(js,/if\(\$\("rememberRules"\)\.checked\)localStorage\.setItem/);assert.match(js,/draftCategorySuggestion/);assert.match(js,/Confirmé en simulation/);});

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
