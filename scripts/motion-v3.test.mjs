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
 assert.match(html,/subscriptions-overview\.js/);
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
