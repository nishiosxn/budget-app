/* Smart Budget V3.1 — pure, fail-closed assistant contract. */
(function exposeSmartAssistantCore(root){
 "use strict";
 const kinds=new Set(["expense","income","saving","plan"]);
 const owners=new Set(["B","A","common"]);
 const queries=new Set(["summary","categories","transactions","comparison"]);
 const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
 const exact=(v,keys)=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const validDate=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v;
 const validMonth=v=>typeof v==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
 const clean=(s,n)=>typeof s==="string"&&s.trim().length>0&&s.length<=n&&!/[\u0000-\u001f\u007f]/.test(s);
 const fail=error=>({ok:false,error});
 const ownerOK=(v,ctx)=>owners.has(v)&&(!ctx.solo||v==="B");
 const catOf=(id,ctx)=>ctx.categories.find(c=>c.id===id);
 const monthOK=(m,ctx)=>validMonth(m)&&m>=ctx.firstMonth&&m<=ctx.lastMonth;
 const contextOK=c=>obj(c)&&Array.isArray(c.categories)&&c.categories.length<=300&&validMonth(c.firstMonth)&&validMonth(c.lastMonth)&&c.firstMonth<=c.lastMonth&&validDate(c.today)&&typeof c.solo==="boolean";
 function validateAssistantOp(v,c){
  if(!exact(v,["kind","categoryId","owner","amountCents","date","label","frequency"]))return fail("Champs invalides.");
  const cat=catOf(v.categoryId,c),m=String(v.date).slice(0,7);
  if(!kinds.has(v.kind)||!ownerOK(v.owner,c)||!validDate(v.date)||!clean(v.label,120))return fail("Type, personne, date ou libellé invalide.");
  if(!cat||!monthOK(m,c)||(cat.createdFrom&&m<cat.createdFrom)||(cat.hiddenMonths||[]).includes(m))return fail("Catégorie inconnue ou indisponible.");
  if(v.kind!=="plan"&&v.kind!==cat.kind)return fail("Type et catégorie incompatibles.");
  if(!Number.isSafeInteger(v.amountCents)||v.amountCents<(v.kind==="plan"?0:1)||v.amountCents>100000000)return fail("Montant invalide.");
  if(!["once","monthly"].includes(v.frequency)||(v.kind==="saving"&&v.frequency!=="once"))return fail("Récurrence non prise en charge.");
  if(v.kind==="plan"&&v.owner!==cat.owner)return fail("Attribution du budget prévu à préciser.");
  if(v.kind!=="plan"&&v.frequency==="once"&&v.date>c.today)return fail("Opération réelle future : préciser.");
  return {ok:true,value:{...v,label:v.label.trim()}};
 }
 function validateAssistantResult(v,c){
  if(!contextOK(c)||!obj(v))return fail("Contexte ou réponse invalide.");
  if(v.kind==="clarify"||v.kind==="answer"){
   return exact(v,["kind","message"])&&clean(v.message,800)?{ok:true,value:{kind:v.kind,message:v.message.trim()}}:fail("Message invalide.");
  }
  if(v.kind==="draft"){
   if(!exact(v,["kind","operations"])||!Array.isArray(v.operations)||!v.operations.length||v.operations.length>12)return fail("Lot invalide.");
   const operations=[],seen=new Set(),plans=new Set();
   for(const item of v.operations){
    const checked=validateAssistantOp(item,c);if(!checked.ok)return checked;
    const op=checked.value,key=JSON.stringify([op.kind,op.categoryId,op.owner,op.amountCents,op.date,op.label.toLowerCase(),op.frequency]);
    if(seen.has(key))return fail("Deux opérations identiques : précise la demande.");seen.add(key);
    if(op.kind==="plan"){const k=op.categoryId+"|"+op.date.slice(0,7);if(plans.has(k))return fail("Deux budgets concurrents.");plans.add(k)}
    operations.push(op);
   }
   return {ok:true,value:{kind:"draft",operations}};
  }
  if(v.kind==="query"){
   if(!exact(v,["kind","query","month","compareMonth","categoryId","owner"])||!queries.has(v.query)||!monthOK(v.month,c))return fail("Requête non autorisée.");
   if(v.query==="comparison"){if(!monthOK(v.compareMonth,c)||v.compareMonth===v.month)return fail("Comparaison invalide.")}
   else if(v.compareMonth!==null)return fail("Comparaison inattendue.");
   if(v.owner!==null&&!ownerOK(v.owner,c))return fail("Personne non autorisée.");
   if(v.categoryId!==null&&!catOf(v.categoryId,c))return fail("Catégorie inconnue.");
   if(["summary","comparison"].includes(v.query)&&(v.categoryId!==null||v.owner!==null))return fail("Filtre incompatible.");
   return {ok:true,value:{...v}};
  }
  return fail("Action non autorisée.");
 }
 const findDuplicates=(ops,existing)=>ops.filter(o=>o.kind!=="plan"&&existing.some(t=>t.kind===o.kind&&t.categoryId===o.categoryId&&t.owner===o.owner&&t.amountCents===o.amountCents&&t.date===o.date));
 // Unassigned proposals are permitted for display only. They can never pass validateResult.
 function validateReview(v,c){
  if(!contextOK(c)||!exact(v,["kind","operations"])||v.kind!=="draft"||!Array.isArray(v.operations)||!v.operations.length||v.operations.length>12)return fail("Brouillon invalide.");
  const operations=[],seen=new Set(),plans=new Set();
  for(const o of v.operations){
   if(!obj(o)||Object.keys(o).some(k=>!["kind","categoryId","owner","amountCents","date","label","frequency","planMode"].includes(k)))return fail("Champs invalides.");
   const {planMode,...base}=o;
   if(!exact(base,["kind","categoryId","owner","amountCents","date","label","frequency"]))return fail("Champs invalides.");
   if(planMode!==undefined&&(base.kind!=="plan"||!["set","increase","decrease"].includes(planMode)))return fail("Mode de budget invalide.");
   if(planMode&&planMode!=="set"&&base.amountCents<=0)return fail("Variation invalide.");
   if(base.categoryId===null){
    if(!kinds.has(base.kind)||!ownerOK(base.owner,c)||!validDate(base.date)||!monthOK(base.date.slice(0,7),c)||!clean(base.label,120)||!Number.isSafeInteger(base.amountCents)||base.amountCents<(base.kind==="plan"?0:1)||base.amountCents>100000000||!["once","monthly"].includes(base.frequency)||(base.kind==="saving"&&base.frequency!=="once")||(base.kind!=="plan"&&base.frequency==="once"&&base.date>c.today))return fail("Proposition incomplète invalide.");
   }else if(!validateAssistantOp(base,c).ok)return fail("Proposition invalide.");
   const key=JSON.stringify([base.kind,base.categoryId,base.owner,base.amountCents,base.date,base.label.trim().toLowerCase(),base.frequency,planMode||"set"]);
   if(seen.has(key))return fail("Doublon possible.");seen.add(key);
   if(base.kind==="plan"&&base.categoryId!==null){const key=base.categoryId+"|"+base.date.slice(0,7);if(plans.has(key))return fail("Budgets concurrents.");plans.add(key)}
   operations.push({...base,label:base.label.trim(),...(base.kind==="plan"?{planMode:planMode||"set"}:{})});
  }
  return {ok:true,value:{kind:"draft",operations}};
 }
 // Resolve a planned amount in integer cents; never ask the model to add up money.
 function resolvePlanAmount(op,beforeCents){
  if(op?.kind!=="plan"||!Number.isSafeInteger(op.amountCents)||op.amountCents<0||!Number.isSafeInteger(beforeCents)||beforeCents<0)return null;
  const mode=op.planMode||"set",after=mode==="increase"?beforeCents+op.amountCents:mode==="decrease"?beforeCents-op.amountCents:mode==="set"?op.amountCents:NaN;
  return Number.isSafeInteger(after)&&after>=0&&after<=100000000?{beforeCents,afterCents:after}:null;
 }
 // Editable default taxonomy: stable semantic keys, never database IDs.
 const categoryRules=Object.freeze([
 {
  "key": "groceries",
  "kind": "expense",
  "name": "Courses",
  "icon": "cart",
  "aliases": [
   "courses",
   "alimentation",
   "supermarché",
   "grande surface"
  ],
  "terms": [
   "lidl",
   "aldi",
   "leclerc",
   "e leclerc",
   "carrefour",
   "intermarché",
   "auchan",
   "super u",
   "hyper u",
   "monoprix",
   "casino",
   "netto",
   "picard",
   "courses"
  ]
 },
 {
  "key": "food",
  "kind": "expense",
  "name": "Restaurants / fast-food",
  "icon": "food",
  "aliases": [
   "restaurant",
   "restaurants",
   "fast food",
   "restauration",
   "sorties restaurant",
   "restauration rapide"
  ],
  "terms": [
   "mcdo",
   "mc donald s",
   "mcdonalds",
   "mcdonald",
   "burger king",
   "kfc",
   "quick",
   "otacos",
   "o tacos",
   "tacos",
   "kebab",
   "subway",
   "pitaya",
   "restaurant",
   "pizza",
   "pizzeria",
   "deliveroo",
   "uber eats"
  ]
 },
 {
  "key": "home",
  "kind": "expense",
  "name": "Maison / entretien",
  "icon": "home",
  "aliases": [
   "maison",
   "entretien",
   "maison entretien",
   "produits ménagers",
   "ménage",
   "bricolage",
   "ameublement"
  ],
  "terms": [
   "action",
   "produits ménagers",
   "lessive",
   "liquide vaisselle",
   "nettoyant",
   "ikea",
   "leroy merlin",
   "castorama",
   "gifi",
   "entretien",
   "bricolage"
  ]
 },
 {
  "key": "leisure",
  "kind": "expense",
  "name": "Loisirs",
  "icon": "game",
  "aliases": [
   "loisirs",
   "divertissement",
   "jeux vidéo",
   "gaming",
   "culture"
  ],
  "terms": [
   "steam",
   "playstation store",
   "xbox",
   "nintendo eshop",
   "epic games",
   "jeu vidéo",
   "jeux vidéo",
   "lego",
   "cinéma",
   "concert",
   "escape game"
  ]
 },
 {
  "key": "transfer",
  "kind": "expense",
  "name": "Virements",
  "icon": "transfer",
  "aliases": [
   "virements",
   "virement",
   "transferts externes",
   "aide familiale"
  ],
  "terms": [
   "virement",
   "transfert",
   "envoyé à maman"
  ]
 },
 {
  "key": "extra",
  "kind": "income",
  "name": "Revenus supplémentaires",
  "icon": "income",
  "aliases": [
   "revenus supplémentaires",
   "revenus divers",
   "autres revenus",
   "rentrées diverses",
   "cadeaux reçus",
   "virements reçus"
  ],
  "terms": [
   "virement",
   "cadeau",
   "reçu",
   "remboursement",
   "maman",
   "papa"
  ]
 },
 {
  "key": "salary",
  "kind": "income",
  "name": "Salaire",
  "icon": "income",
  "aliases": [
   "salaire",
   "salaires",
   "paie"
  ],
  "terms": [
   "salaire",
   "paie"
  ]
 },
 {
  "key": "benefits",
  "kind": "income",
  "name": "Aides / allocations",
  "icon": "income",
  "aliases": [
   "aides",
   "allocations",
   "aides allocations",
   "caf"
  ],
  "terms": [
   "caf",
   "apl",
   "prime d activité",
   "allocation",
   "bourse"
  ]
 },
 {
  "key": "fuel",
  "kind": "expense",
  "name": "Carburant",
  "icon": "fuel",
  "aliases": [
   "carburant",
   "essence",
   "gazole",
   "diesel"
  ],
  "terms": [
   "essence",
   "carburant",
   "gazole",
   "diesel",
   "station service",
   "plein"
  ]
 },
 {
  "key": "transport",
  "kind": "expense",
  "name": "Transports",
  "icon": "car",
  "aliases": [
   "transport",
   "transports",
   "déplacements"
  ],
  "terms": [
   "sncf",
   "ouigo",
   "train",
   "bus",
   "métro",
   "péage",
   "parking",
   "taxi"
  ]
 },
 {
  "key": "health",
  "kind": "expense",
  "name": "Santé",
  "icon": "health",
  "aliases": [
   "santé",
   "médical",
   "frais médicaux"
  ],
  "terms": [
   "pharmacie",
   "médecin",
   "dentiste",
   "opticien",
   "consultation médicale"
  ]
 },
 {
  "key": "clothing",
  "kind": "expense",
  "name": "Vêtements",
  "icon": "shirt",
  "aliases": [
   "vêtements",
   "habillement",
   "mode"
  ],
  "terms": [
   "zara",
   "h m",
   "uniqlo",
   "kiabi",
   "vêtement",
   "chaussures"
  ]
 },
 {
  "key": "subscriptions",
  "kind": "expense",
  "name": "Abonnements",
  "icon": "card",
  "aliases": [
   "abonnements",
   "abonnement"
  ],
  "terms": [
   "netflix",
   "disney",
   "spotify",
   "icloud",
   "youtube premium",
   "abonnement"
  ]
 },
 {
  "key": "gifts",
  "kind": "expense",
  "name": "Cadeaux",
  "icon": "gift",
  "aliases": [
   "cadeaux",
   "cadeau"
  ],
  "terms": [
   "cadeau",
   "anniversaire"
  ]
 },
 {
  "key": "phone",
  "kind": "expense",
  "name": "Téléphone",
  "icon": "card",
  "aliases": [
   "téléphone",
   "forfait mobile",
   "mobile"
  ],
  "terms": [
   "forfait mobile",
   "téléphone",
   "sosh",
   "bouygues telecom"
  ]
 },
 {
  "key": "insurance",
  "kind": "expense",
  "name": "Assurances",
  "icon": "card",
  "aliases": [
   "assurances",
   "assurance"
  ],
  "terms": [
   "assurance",
   "assurances",
   "mutuelle"
  ]
 },
 {
  "key": "rent",
  "kind": "expense",
  "name": "Loyer / logement",
  "icon": "home",
  "aliases": [
   "loyer",
   "logement",
   "loyer logement"
  ],
  "terms": [
   "loyer"
  ]
 },
 {
  "key": "energy",
  "kind": "expense",
  "name": "Électricité / énergie",
  "icon": "home",
  "aliases": [
   "électricité",
   "énergie",
   "électricité énergie"
  ],
  "terms": [
   "edf",
   "électricité",
   "gaz"
  ]
 },
 {
  "key": "internet",
  "kind": "expense",
  "name": "Internet",
  "icon": "card",
  "aliases": [
   "internet",
   "box internet"
  ],
  "terms": [
   "internet",
   "box internet"
  ]
 }
].map(r=>Object.freeze({...r,aliases:Object.freeze(r.aliases),terms:Object.freeze(r.terms)})));
 const normalizeCategory=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const containsTerm=(text,term)=>(" "+text+" ").includes(" "+normalizeCategory(term)+" ");
 const availableCategories=(op,ctx)=>ctx.categories.filter(c=>(op.kind==="plan"||c.kind===op.kind)&&(!c.createdFrom||op.date.slice(0,7)>=c.createdFrom)&&!(c.hiddenMonths||[]).includes(op.date.slice(0,7)));
 function classifyCategory(op,ctx,{hint=null,explicit=false,overrides={}}={}){
  const label=normalizeCategory(op.label),available=availableCategories(op,ctx),supplied=available.find(c=>c.id===op.categoryId)||available.find(c=>normalizeCategory(c.name)===normalizeCategory(op.categoryId)&&op.categoryId!==null);
  const remembered=Object.hasOwn(overrides,label)?available.find(c=>c.id===overrides[label]):null;
  if(remembered&&op.kind!=="plan"&&!explicit)return {categoryId:remembered.id,ruleKey:null,source:"personal"};
  if(supplied&&(explicit||normalizeCategory(supplied.name)===label))return {categoryId:supplied.id,ruleKey:null,source:"existing"};
  const exact=available.filter(c=>normalizeCategory(c.name)===label);
  if(exact.length===1)return {categoryId:exact[0].id,ruleKey:null,source:"existing"};
  const compatible=categoryRules.filter(r=>op.kind==="plan"||r.kind===op.kind);
  const scored=compatible.map(r=>({r,score:Math.max(0,...r.terms.filter(t=>containsTerm(label,t)).map(t=>normalizeCategory(t).length))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  // Conflicting signals without a clear winner are left to the model's valid category.
  const matched=scored.length&&(!scored[1]||scored[0].score>scored[1].score)?scored[0].r:null;
  const modelHint=compatible.find(r=>r.key===hint);
  const rule=matched||(!supplied?modelHint:null);
  if(rule){
   const names=new Set([rule.name,...rule.aliases].map(normalizeCategory));
   const candidates=available.filter(c=>c.kind===rule.kind&&names.has(normalizeCategory(c.name)));
   if(candidates.length===1)return {categoryId:candidates[0].id,ruleKey:rule.key,source:"rule"};
   if(candidates.length>1){if(supplied&&candidates.some(c=>c.id===supplied.id))return {categoryId:supplied.id,ruleKey:rule.key,source:"existing"};return {categoryId:null,ruleKey:null,source:"ambiguous"}}
   // Never manufacture an ID, or suggest duplicates of an unavailable category.
   const exists=ctx.categories.some(c=>c.kind===rule.kind&&names.has(normalizeCategory(c.name)));
   if(!exists)return {categoryId:null,ruleKey:rule.key,source:"new"};
   return {categoryId:null,ruleKey:null,source:"unavailable"};
  }
  return supplied?{categoryId:supplied.id,ruleKey:null,source:"model"}:{categoryId:null,ruleKey:null,source:"unknown"};
 }
 function normalizeModelDraft(v,c,command=""){
  if(!exact(v,["kind","operations"])||v.kind!=="draft"||!Array.isArray(v.operations)||v.operations.length>12)return fail("Brouillon invalide.");
  const explicit=/\b(?:catégorie|categorie|classer|classe|range)\b/i.test(command);
  const operations=[],suggestions=[];
  for(const [index,o] of v.operations.entries()){
   if(!obj(o)||Object.keys(o).some(k=>!["kind","categoryId","owner","amountCents","date","label","frequency","planMode","categoryHint"].includes(k)))return fail("Champs invalides.");
   const {categoryHint,planMode,...base}=o;
   if(!exact(base,["kind","categoryId","owner","amountCents","date","label","frequency"])||!(base.categoryId===null||typeof base.categoryId==="string"))return fail("Champs invalides.");
   if(!kinds.has(base.kind)||!validDate(base.date)||!clean(base.label,120))return fail("Type, date ou libellé invalide.");
   if(categoryHint!==undefined&&categoryHint!==null&&!categoryRules.some(r=>r.key===categoryHint))return fail("Indication de catégorie invalide.");
   if(planMode!==undefined&&planMode!==null&&!["set","increase","decrease"].includes(planMode))return fail("Mode de budget invalide.");
   if(base.kind!=="plan"&&planMode&&planMode!=="set")return fail("Mode de budget inattendu.");
   const match=classifyCategory(base,c,{hint:categoryHint,explicit});
   const selected=availableCategories(base,c).find(x=>x.id===match.categoryId);
   operations.push({...base,categoryId:match.categoryId,...(base.kind==="plan"?{owner:selected?.owner||base.owner,planMode:planMode||"set"}:{})});
   if(match.source==="new")suggestions.push({index,ruleKey:match.ruleKey});
  }
  const checked=validateReview({kind:"draft",operations},c);
  return checked.ok?{...checked,suggestions}:checked;
 }
 function draftCategorySuggestion(op,ctx,ruleKey){
  const rule=categoryRules.find(r=>r.key===ruleKey&&(op.kind==="plan"||r.kind===op.kind));
  if(!rule||op.categoryId!==null)return null;
  const names=new Set([rule.name,...rule.aliases].map(normalizeCategory));
  if(ctx.categories.some(c=>c.kind===rule.kind&&names.has(normalizeCategory(c.name))))return null;
  return rule;
 }
 root.SmartBudgetAssistantCore=Object.freeze({validateResult:validateAssistantResult,validateReview,resolvePlanAmount,validDate,validMonth,findDuplicates,categoryRules,normalizeCategory,availableCategories,classifyCategory,normalizeModelDraft,draftCategorySuggestion});
})(globalThis);
