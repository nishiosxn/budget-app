import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root=process.cwd();
const errors=[];
const ok=msg=>console.log("✓",msg);
const info=msg=>console.log("•",msg);
const fail=msg=>{errors.push(msg);console.error("✗",msg)};
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));

if(!exists("index.html")) fail("index.html manquant");
if(!exists("workstate.md")) fail("workstate.md manquant");
if(!exists("CHANGELOG.md")) fail("CHANGELOG.md manquant");

const html=exists("index.html")?read("index.html"):"";
const jsDir=path.join(root,"js");
const jsFiles=fs.existsSync(jsDir)
  ? fs.readdirSync(jsDir).filter(f=>f.endsWith(".js")).sort()
  : [];

let allJs="";
let modular=false;

if(jsFiles.length){
  modular=true;
  for(const file of jsFiles){
    try{
      execFileSync(process.execPath,["--check",path.join("js",file)],{stdio:"pipe"});
    }catch{
      fail(`Syntaxe invalide: js/${file}`);
    }
  }
  if(!errors.some(x=>x.startsWith("Syntaxe invalide"))) ok(`Syntaxe JS: ${jsFiles.length} modules`);
  allJs=jsFiles.map(f=>read(path.join("js",f))).join("\n");
}else{
  info("Architecture legacy détectée: aucun dossier js/ à la racine.");
  const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m=>m[1].trim())
    .filter(Boolean);
  if(inlineScripts.length){
    const temp=path.join(os.tmpdir(),"budget-inline-check.js");
    fs.writeFileSync(temp,inlineScripts.join("\n"),"utf8");
    try{
      execFileSync(process.execPath,["--check",temp],{stdio:"pipe"});
      ok(`Syntaxe JS inline: ${inlineScripts.length} bloc(s)`);
    }catch{
      fail("Syntaxe invalide dans le JavaScript inline de index.html");
    }finally{
      try{fs.unlinkSync(temp)}catch{}
    }
    allJs=inlineScripts.join("\n");
  }else{
    info("Aucun JavaScript inline détecté.");
  }
}

const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if(duplicateIds.length) fail("IDs HTML dupliqués: "+duplicateIds.join(", "));
else ok("IDs HTML uniques");

const domRefs=[...allJs.matchAll(/getElementById\("([^"]+)"\)/g)].map(m=>m[1]);
const missingDom=[...new Set(domRefs.filter(id=>!ids.includes(id)))];
if(missingDom.length) fail("Références DOM manquantes: "+missingDom.join(", "));
else ok("Références DOM valides");

const scripts=[...html.matchAll(/<script src="js\/([^"]+\.js)" defer><\/script>/g)].map(m=>m[1]);
const missingScripts=scripts.filter(f=>!exists(path.join("js",f)));
if(missingScripts.length) fail("Scripts HTML absents: "+missingScripts.join(", "));
else if(scripts.length) ok("Scripts référencés présents");

const functionNames=[...allJs.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(m=>m[1]);
const duplicateFns=[...new Set(functionNames.filter((n,i)=>functionNames.indexOf(n)!==i))];
if(duplicateFns.length) fail("Fonctions globales dupliquées: "+duplicateFns.join(", "));
else ok("Pas de fonctions globales dupliquées");

if(modular&&exists("js/data.js")){
  const data=read("js/data.js");
  if(/SEPTEMBER_ACTUAL|transactions\s*[:=]\s*\[(?!\s*\])/i.test(data)) fail("Données de transactions seed détectées dans js/data.js");
  else ok("Aucune transaction personnelle seedée");

  const nonZeroBudgets=[...data.matchAll(/budget\s*:\s*(-?\d+(?:\.\d+)?)/g)]
    .map(m=>Number(m[1])).filter(v=>Math.abs(v)>0.0001);
  if(nonZeroBudgets.length) fail("Budgets non nuls détectés dans le template public");
  else ok("Template public: budgets à 0");

  if(!/personB\s*:\s*"Personne 1"/.test(data)||!/personA\s*:\s*"Personne 2"/.test(data)) fail("Noms neutres Personne 1 / Personne 2 absents du template");
  else ok("Template de foyer neutre");
}

if(modular&&exists("js/storage.js")){
  const storage=read("js/storage.js");
  if(!/schemaVersion\s*:\s*5/.test(storage)) fail("Schéma V5 absent de storage.js");
  else ok("Schéma local V5 détecté");
  if(!/transactions\s*:\s*\[\s*\]/.test(storage)) fail("L'état neuf ne démarre pas avec transactions: []");
  else ok("État neuf sans transactions");
}

if(modular&&exists("js/calculations.js")){
  const calc=read("js/calculations.js").replace(/\s+/g,"");
  const required=[
    "balance:income-expense-saving",
    "plannedBalance:plannedIncome-plannedExpense-plannedSaving",
    "restB:incomeB-expenseB-savingBShare",
    "restA:incomeA-expenseA-savingAShare"
  ];
  const missing=required.filter(x=>!calc.includes(x));
  if(missing.length) fail("Formules métier critiques absentes: "+missing.join(", "));
  else ok("Formules critiques revenus/dépenses/épargne/restes présentes");
}

if(modular&&exists("js/settings.js")){
  const settings=read("js/settings.js");
  const migrationMarkers=["validateV5State","validateLegacyState","buildLegacyV5State","prepareImportedState","migrateLegacySource"];
  const missing=migrationMarkers.filter(x=>!settings.includes(x));
  if(missing.length) fail("Moteur de migration incomplet: "+missing.join(", "));
  else ok("Moteur de migration V4/V5 présent");
}

if(exists("workstate.md")){
  const ws=read("workstate.md");
  if(!/(Branche active|Branche de développement de référence|Tronc de développement)/i.test(ws)) fail("workstate.md ne précise pas la branche de travail");
  else ok("workstate.md présent");
}

if(!modular) info("Les contrôles V2.2+ (template V5, calculs, migration) sont ignorés sur l'architecture V1 legacy.");

if(errors.length){
  console.error("\nAudit échoué:",errors.length,"erreur(s)");
  process.exit(1);
}
console.log("\nAudit automatique réussi.");
