import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("motion V3 ne modifie aucune donnée financière",()=>{
 const motion=read("js/motion.js");
 assert.match(motion,/prefers-reduced-motion/);
 assert.doesNotMatch(motion,/\.from\s*\(|\.rpc\s*\(|\.update\s*\(|\.insert\s*\(/);
 for(const key of ["session","household","data","ready"])assert.ok(motion.includes(key));
});
test("le chargement ne se termine qu'après bootstrap, et masque les erreurs",()=>{
 const auth=read("js/auth.js"),house=read("js/cloud-household.js");
 assert.match(auth,/SmartBudgetMotion\?\.begin\(\)/);
 assert.match(auth,/SmartBudgetMotion\?\.finish\(\)/);
 assert.match(house,/SmartBudgetMotion\?\.stage\("data"\)/);
 assert.match(house,/SmartBudgetMotion\?\.cancel\(\)/);
});
test("la V3 reprend le moteur V2.9 et ajoute le suivi accessible",()=>{
 const html=read("index.html"),tracking=read("js/tracking.js"),subscriptions=read("js/subscriptions-overview.js");
 assert.match(html,/js\/motion\.js/);
 assert.match(html,/history-filters\.js/);
 assert.doesNotMatch(html,/subscriptions-overview\.js/);
 assert.match(html,/category-distribution\.js/);
 assert.match(tracking,/data-month-index/);
 assert.match(tracking,/SmartBudgetMotion\?\.chartHover/);
 assert.match(subscriptions,/sb-subscription-secondary/);
});

test("logo de chargement : seul le tracé réel du logo est animé, sans anneau ajouté",()=>{
 const motion=read("js/motion.js"),css=read("css/motion.css");
 assert.match(motion,/sb-logo-svg/);
 assert.match(motion,/sb-logo-reveal/);
 assert.match(motion,/M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z/);
 assert.doesNotMatch(motion,/sb-ring|sb-track/);
 assert.match(css,/prefers-reduced-motion/);
});
test("les trois indicateurs V3 inutiles sont totalement supprimés",()=>{
 for(const path of ["index.html","js/ui.js","css/motion.css"]){
  const source=read(path);
  assert.doesNotMatch(source,/sbOverviewInsights|sb-overview-insight|renderOverviewInsights/);
 }
});

test("la progression V3.0 est continue et strictement bornée avant la fin du chargement réel",()=>{
 const code=read("js/motion.js");
 assert.match(code,/requestAnimationFrame\(tick\)/);
 assert.match(code,/1-Math\.exp\(-delta\/1850\)/);
 assert.match(code,/Math\.min\(percent,96\)/);
 assert.match(code,/if\(finishing&&now-finishAt>=500\)/);
 assert.match(code,/sb-logo-glint/);
});
test("l'ancienne fenêtre de chargement est invisible pendant la connexion normale",()=>{
 const html=read("index.html"),auth=read("js/auth.js");
 assert.match(html,/id="sbBootScreen" class="sb-boot sb-open"/);
 assert.match(html,/id="cloudGate" class="cloud-gate" aria-hidden="true"/);
 assert.doesNotMatch(html,/Connexion au foyer…|class="cloud-loader"/);
 assert.match(auth,/name==="loading"&&window\.SmartBudgetMotion\?\.isLoading\?\.\(\)/);
 assert.match(auth,/type==="error"&&cloudLoadingView/);
});

test("l'entrée Recherche Historique ne déclenche pas le zoom automatique iOS",()=>{
 const css=read("css/history-filters.css");
 const html=read("index.html");
 assert.match(css,/@media\(max-width:52rem\)\s*\{\s*#historySearch\s*\{font-size:16px\}/);
 assert.match(html,/id="historySearch" type="search"/);
 assert.match(html,/history-filters\.css\?v=20261117-ios-focus/);
 assert.doesNotMatch(html,/maximum-scale=1|user-scalable=no/);
});

// Accessibility and iOS viewport regression tests for the entire app.
test("tous les champs éditables mobiles ont au moins 16px, sans empêcher le zoom manuel",()=>{
 const html=read("index.html"),css=read("css/touch-inputs.css");
 assert.match(html,/css\/touch-inputs\.css\?v=20261117-v302/);
 assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"\s*\/>/);
 assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
 assert.match(css,/@media\s*\(any-pointer:\s*coarse\),\s*\(max-width:\s*64rem\)/);
 assert.match(css,/input:not\(\[type="hidden"\]\)/);
 for(const inputType of ["checkbox","radio","range","color","file","button","submit","reset","image"])
  assert.ok(css.includes(':not([type="'+inputType+'"])'));
 for(const control of ["select","textarea",'[contenteditable="true"]'])
  assert.ok(css.includes(control));
 assert.match(css,/font-size:16px\s*!important/);
 assert.match(css,/#amountInput\.amount-input\{font-size:3rem\s*!important;/);
 assert.match(css,/#amountInput\.amount-input\{font-size:2\.625rem\s*!important;/);
 assert.doesNotMatch(css,/touch-action:\s*none|user-scalable|maximum-scale\s*:/i);
});
