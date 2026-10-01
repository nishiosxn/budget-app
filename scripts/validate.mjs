import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

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
const iconFiles=["icon.svg","favicon.ico","icon-192.png","icon-512.png","apple-touch-icon.png"];
const missingIcons=iconFiles.filter(file=>!exists(path.join("icons",file)));
if(missingIcons.length)fail("Icônes Smart Budget manquantes: "+missingIcons.join(", "));
else{
  const svg=read("icons/icon.svg");
  if(!svg.includes("#285F49")||!svg.includes("#F4F5F1")||/<text\b|>B</i.test(svg))fail("Logo SVG validé absent ou ancien B conservé");
  const pngSizes={"icon-192.png":192,"icon-512.png":512,"apple-touch-icon.png":180};
  for(const [file,size] of Object.entries(pngSizes)){
    const png=fs.readFileSync(path.join(root,"icons",file));
    if(png.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size)fail(`Dimensions ou format invalide: icons/${file}`);
  }
  const ico=fs.readFileSync(path.join(root,"icons","favicon.ico"));
  if(ico.readUInt16LE(0)!==0||ico.readUInt16LE(2)!==1||ico.readUInt16LE(4)!==3)fail("favicon.ico doit contenir trois tailles");
  const serviceWorker=read("sw.js");
  if(/caches\.match|cache\.put|cache\.add|cache\.addAll/.test(serviceWorker))fail("Le service worker contient encore un fallback de cache hors ligne");
  else ok("Service worker PWA en réseau direct, sans mode hors ligne");
  if(!["icons/icon.svg","icons/favicon.ico","icons/apple-touch-icon.png"].every(file=>html.includes(file)))fail("Favicon ou icône Apple absents de index.html");
  if(/class="logo">B</.test(html)||/class=\\"logo\\">B</.test(read("js/pwa.js")))fail("Ancien logo B encore affiché");
  const manifest=JSON.parse(read("manifest.webmanifest"));
  if(!["icons/icon.svg","icons/icon-192.png","icons/icon-512.png"].every(file=>manifest.icons.some(icon=>icon.src===file)))fail("Manifest PWA incomplet");
  if(!errors.some(error=>/Icônes|Logo SVG|Dimensions|favicon|hors ligne|Ancien logo|Manifest PWA/.test(error)))ok("Identité Smart Budget et icônes PWA cohérentes");
}
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
const dynamicIds=[...allJs.matchAll(/\.id\s*=\s*"([^"]+)"/g)].map(m=>m[1]);
const missingDom=[...new Set(domRefs.filter(id=>!ids.includes(id)&&!dynamicIds.includes(id)))];
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

if(modular&&exists("js/cloud-state-core.js")){
  try{
    const context=vm.createContext({slotToOwner:slot=>slot==="A"||slot==="B"?slot:"common"});
    vm.runInContext(read("js/cloud-state-core.js"),context,{filename:"js/cloud-state-core.js"});
    const next={
      baseIncomeCategories:[],customIncomeCategories:[],baseExpenseCategories:[],customExpenseCategories:[],
      deletedIncomeCategoriesGlobal:[],deletedCategoriesGlobal:[],deletedIncomeCategoryMonths:{},deletedCategoryMonths:{},
      incomePlanChanges:{},expensePlanChanges:{}
    };
    const categoryRows=[
      {id:"cloud-income",legacy_id:"income-1",name:"Salaire",type:"income",is_custom:false,owner_slot:"B",created_from:"2026-09-01",excluded_months:[],archived_at:null},
      {id:"cloud-expense",legacy_id:"expense-1",name:"Logement",type:"expense",group_name:"Obligatoires",is_custom:true,is_saving:false,owner_slot:null,created_from:"2026-09-01",excluded_months:["2026-10"],archived_at:"2026-09-30T00:00:00Z"}
    ];
    const idMap=context.cloudCategoriesToLocal(categoryRows,next);
    context.applyCloudBudgets([{category_id:"cloud-income",month:"2026-09-01",planned_amount:"1200.50",scope:"forward",owner_slot:"B"}],idMap,next);
    const transactions=context.cloudTransactionsToLocal([{id:"cloud-tx",legacy_id:"tx-1",category_id:"cloud-expense",amount:"42.25",transaction_date:"2026-09-15",owner_slot:null,metadata:{category:"invalid",amount:999,type:"expense",note:"conservée"}}],idMap);
    const recurrences=context.cloudRecurrencesToLocal([{id:"cloud-rec",legacy_id:"rec-1",category_id:"cloud-expense",amount:"10",start_month:"2026-09-01",start_day:31,end_month:null,owner_slot:"A",excluded_months:[],overrides:{},metadata:{id:"invalid",type:"expense",seriesId:"series-1"}}],idMap);
    const valid=next.baseIncomeCategories[0]?.id==="income-1"
      &&next.customExpenseCategories[0]?.id==="expense-1"
      &&next.deletedCategoriesGlobal.includes("expense-1")
      &&next.deletedCategoryMonths["2026-10"]?.includes("expense-1")
      &&next.incomePlanChanges["income-1"]?.forward?.["2026-09"]?.budget===1200.5
      &&transactions[0]?.id==="tx-1"&&transactions[0]?.category==="expense-1"&&transactions[0]?.amount===42.25&&transactions[0]?.note==="conservée"
      &&recurrences[0]?.id==="rec-1"&&recurrences[0]?.date==="2026-09-31"&&recurrences[0]?.owner==="A";
    if(!valid)fail("Conversion cloud vers état V5 invalide");
    else ok("Conversion cloud vers état V5 vérifiée");
  }catch(error){
    fail("Test de conversion cloud impossible: "+error.message);
  }
}

if(modular&&exists("js/cloud-save.js")){
  try{
    const localState={
      schemaVersion:5,onboardingComplete:true,selectedMonth:"Septembre 2026",createdMonth:"2026-09",
      household:{name:"Foyer test",personB:"Personne 1",personA:"Personne 2"},
      baseIncomeCategories:[{id:"income-1",name:"Salaire",budget:0,owner:"B",createdFrom:"2026-09"}],customIncomeCategories:[],
      baseExpenseCategories:[{id:"expense-1",name:"Logement",budget:0,owner:"common",section:"Obligatoires",createdFrom:"2026-09"}],customExpenseCategories:[],
      incomeCategoryNames:{},categoryNames:{},incomeCategoryOwners:{},categoryOwners:{},
      deletedIncomeCategoryMonths:{},deletedCategoryMonths:{"2026-10":["expense-1"]},deletedIncomeCategoriesGlobal:[],deletedCategoriesGlobal:["expense-1"],
      incomeBudgets:{"income-1":1000},categoryBudgets:{"expense-1":500},
      incomePlanChanges:{"income-1":{forward:{"2026-11":{budget:1200,owner:"B"}},month:{}}},expensePlanChanges:{},transactions:[]
    };
    const context=vm.createContext({
      state:localState,activeHouseholdId:"household-1",cloudSession:null,cloudSyncReady:false,
      cloneData:value=>JSON.parse(JSON.stringify(value)),ownerToSlot:owner=>owner==="A"||owner==="B"?owner:null,
      cloudMonthDate:key=>/^\d{4}-\d{2}$/.test(String(key||""))?key+"-01":null,
      monthKey:label=>label==="Septembre 2026"?"2026-09":String(label||""),
      localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},navigator:{onLine:true},
      window:{addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},console,
      setCloudStatus:()=>{},cloudPushTimer:null,cloudPushInProgress:false,cloudIgnoreRealtimeUntil:0,
      normalizeHousehold:value=>value,requestCloudBootstrap:async()=>{}
    });
    vm.runInContext(read("js/cloud-save.js"),context,{filename:"js/cloud-save.js"});
    const categories=context.cloudLocalCategories(localState);
    const budgets=context.cloudBudgetRows(new Map([["income-1","cloud-income"],["expense-1","cloud-expense"]]),localState);
    const digestA=context.cloudSyncDigest(localState);
    const changedMonth={...localState,selectedMonth:"Octobre 2026"};
    const valid=categories.length===2
      &&categories.find(row=>row.local_id==="expense-1")?.archived===true
      &&categories.find(row=>row.local_id==="expense-1")?.excluded_months?.[0]==="2026-10"
      &&budgets.some(row=>row.category_id==="cloud-income"&&row.month==="2026-09-01"&&row.planned_amount===1000)
      &&budgets.some(row=>row.category_id==="cloud-income"&&row.month==="2026-11-01"&&row.planned_amount===1200)
      &&digestA===context.cloudSyncDigest(changedMonth);
    if(!valid)fail("Conversion état V5 vers cloud invalide");
    else ok("Conversion état V5 vers cloud vérifiée");
  }catch(error){
    fail("Test de conversion vers le cloud impossible: "+error.message);
  }
}

if(modular&&exists("js/cloud-sync-v25.js")){
  try{
    const context=vm.createContext({
      cloneData:value=>value===undefined?undefined:JSON.parse(JSON.stringify(value)),
      console
    });
    vm.runInContext(read("js/cloud-sync-v25.js"),context,{filename:"js/cloud-sync-v25.js"});
    const base={amount:10,label:"Base",metadata:{note:"A"}};
    const local={amount:20,label:"Base",metadata:{note:"A"}};
    const remote={amount:10,label:"Cloud",metadata:{note:"A"}};
    const merged=context.cloudMergeKnownPayload(base,local,remote,null,"transactions","tx-1");
    const conflict=context.cloudMergeKnownPayload(
      {amount:10,label:"Base"},
      {amount:20,label:"Base"},
      {amount:30,label:"Base"},
      null,"transactions","tx-1"
    );
    const resolved=context.cloudMergeKnownPayload(
      {amount:10,label:"Base"},
      {amount:20,label:"Base"},
      {amount:30,label:"Base"},
      "local","transactions","tx-1"
    );
    const valid=merged.conflicts.length===0
      &&merged.value.amount===20
      &&merged.value.label==="Cloud"
      &&conflict.conflicts.length===1
      &&resolved.value.amount===20;
    if(!valid)fail("Fusion optimiste V2.5 invalide");
    else ok("Fusion V2.5 : changements indépendants fusionnés et conflits détectés");
  }catch(error){
    fail("Test du moteur de synchronisation V2.5 impossible: "+error.message);
  }
}

if(modular){
  const cloudModules=["supabase-config.js","supabase-client.js","auth.js","cloud-household.js","cloud-state-core.js","cloud-load.js","cloud-save.js","cloud-sync-v25.js","cloud-realtime.js"];
  const missingCloud=cloudModules.filter(file=>!exists(path.join("js",file))||!scripts.includes(file));
  if(missingCloud.length)fail("Modules cloud manquants ou non chargés: "+missingCloud.join(", "));
  else ok("Modules cloud V2.5 chargés");
  if(!/@supabase\/supabase-js@2\.117\.2/.test(html))fail("SDK Supabase non épinglé à la version validée");
  else ok("SDK Supabase épinglé");
  const storageCloudOnly=read("js/storage.js");
  if(/localStorage\.setItem\(currentStorageKey\(\),JSON\.stringify\(state\)\)/.test(storageCloudOnly))fail("Le cache financier local est encore actif");
  else ok("Données financières sans cache local actif");
  if(!html.includes('id="cloudForceSyncBtn"')||!read("js/cloud-save.js").includes("cloudForcePushSessionState"))fail("Relance manuelle de synchronisation absente");
  else ok("Relance manuelle de session présente");
  const migrations=[
    "supabase/migrations/20260930001858_v2_4_household_invites_and_slots.sql",
    "supabase/migrations/20260930002106_v2_4_sync_fields_and_security_hardening.sql",
    "supabase/migrations/20260930002728_v2_4_archive_sync_rows.sql",
    "supabase/migrations/20260930011901_v2_4_multi_user_security_and_admin.sql",
    "supabase/migrations/20260930012443_v2_4_admin_service_permissions.sql",
    "supabase/migrations/20260930012820_v2_4_admin_advisor_hardening.sql",
    "supabase/migrations/20260930012844_v2_4_retire_legacy_household_rpc.sql",
    "supabase/migrations/20260930104500_v2_5_sync_deduplication.sql"
  ];
  const missingMigrations=migrations.filter(file=>!exists(file));
  if(missingMigrations.length)fail("Migrations Supabase non versionnées: "+missingMigrations.join(", "));
  else ok("Migrations Supabase V2.4/V2.5 versionnées");

  const auth=read("js/auth.js");
  const authMarkers=["signUp(","signInWithPassword(","resetPasswordForEmail(","updateUser({password","signInWithOtp(","PASSWORD_RECOVERY"];
  const missingAuth=authMarkers.filter(marker=>!auth.includes(marker));
  if(missingAuth.length)fail("Parcours d'authentification incomplet: "+missingAuth.join(", "));
  else ok("Inscription, connexion, récupération et Magic Link présents");

  const household=read("js/cloud-household.js");
  const storage=read("js/storage.js");
  if(!household.includes('rpc("ensure_personal_household"'))fail("Provisionnement automatique du foyer absent");
  else ok("Foyer personnel automatique présent");
  if(!storage.includes("function loadState(){\n return seedState();")||!storage.includes("function clearCurrentCloudDataCache()"))fail("Mode cloud-only non appliqué au stockage");
  else ok("État de travail conservé uniquement en mémoire");

  const securityMigration=read("supabase/migrations/20260930011901_v2_4_multi_user_security_and_admin.sql");
  const securityMarkers=["token_hash","extensions.digest","app_admins","admin_audit_log","revoke insert, update, delete on table public.household_members","Household already has two members"];
  const missingSecurity=securityMarkers.filter(marker=>!securityMigration.includes(marker));
  if(missingSecurity.length)fail("Durcissement multi-utilisateur incomplet: "+missingSecurity.join(", "));
  else ok("Invitations hachées, limite à deux et rôle admin en base");

  const adminFiles=["admin/index.html","admin/admin.css","admin/admin.js","supabase/functions/admin-api/index.ts","supabase/functions/admin-api/deno.json"];
  const missingAdmin=adminFiles.filter(file=>!exists(file));
  if(missingAdmin.length)fail("Interface ou fonction admin manquante: "+missingAdmin.join(", "));
  else{
    try{execFileSync(process.execPath,["--check",path.join("admin","admin.js")],{stdio:"pipe"});ok("Syntaxe de l'interface admin valide")}catch{fail("Syntaxe invalide: admin/admin.js")}
    const edgeTemp=path.join(os.tmpdir(),"budget-admin-edge-check.mjs");
    try{
      fs.writeFileSync(edgeTemp,read("supabase/functions/admin-api/index.ts"),"utf8");
      execFileSync(process.execPath,["--check",edgeTemp],{stdio:"pipe"});
      ok("Syntaxe de la fonction serveur admin valide");
    }catch{fail("Syntaxe invalide: supabase/functions/admin-api/index.ts")}
    finally{try{fs.unlinkSync(edgeTemp)}catch{}}
    const adminSource=read("admin/admin.js")+read("supabase/functions/admin-api/index.ts");
    if(!adminSource.includes('from("app_admins")')||!adminSource.includes("auth.admin.listUsers")||!adminSource.includes("auth.admin.deleteUser"))fail("Contrôles serveur admin incomplets");
    else ok("Accès admin vérifié en base et opérations privilégiées côté serveur");
  }

  const sourceFiles=[];
  const collect=dir=>{
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
      const relative=path.join(dir,entry.name);
      if(entry.name===".git")continue;
      if(entry.isDirectory())collect(relative);
      else if(/\.(?:js|mjs|ts|html|css|md|sql|json|ya?ml)$/i.test(entry.name))sourceFiles.push(relative);
    }
  };
  collect(".");
  const secretFindings=[];
  for(const file of sourceFiles){
    const content=read(file);
    if(/sb_secret_[A-Za-z0-9_-]+/.test(content)||/postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i.test(content)||/service_role\s*[:=]\s*["'][^"']+["']/i.test(content))secretFindings.push(file);
  }
  if(secretFindings.length)fail("Secret serveur potentiel détecté: "+secretFindings.join(", "));
  else ok("Aucun secret Supabase serveur dans le dépôt");
}

if(exists("workstate.md")){
  const ws=read("workstate.md");
  if(!/(Branche active|Branche de développement de référence)/i.test(ws)) fail("workstate.md ne précise pas la branche de travail");
  else ok("workstate.md présent");
}

if(!modular) info("Les contrôles V2.2+ (template V5, calculs, migration) sont ignorés sur l'architecture V1 legacy.");

if(errors.length){
  console.error("\nAudit échoué:",errors.length,"erreur(s)");
  process.exit(1);
}
console.log("\nAudit automatique réussi.");
