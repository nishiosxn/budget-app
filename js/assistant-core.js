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
   "course",
   "alimentation",
   "supermarché",
   "grande surface"
  ],
  "terms": [
   "lidl",
   "boulangerie",
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
   "decathlon",
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
  "key": "saving",
  "kind": "saving",
  "name": "Épargne",
  "icon": "saving",
  "aliases": ["épargne","epargne","économies","economies","livret","économies personnelles"],
  "terms": ["épargne","économies","livret","économiser"]
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
  const rule=(hint&&String(op.label).includes(" · ")?modelHint:null)||matched||(!supplied?modelHint:null);
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
   const effectiveHint=categoryHint||(v.operations.length===1&&base.categoryId===null?contextualCategoryHint(command,base):null);
   const match=classifyCategory(base,c,{hint:effectiveHint,explicit});
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
 // Recognize only complete, unambiguous single-expense sentences. No partial matching.
 const quickMerchants=Object.freeze({"zara":"Zara","mcdo":"McDonald's","mc donald s":"McDonald's","mcdonalds":"McDonald's","mcdonald":"McDonald's","lidl":"Lidl","aldi":"Aldi","leclerc":"Leclerc","e leclerc":"E.Leclerc","carrefour":"Carrefour","intermarche":"Intermarché","auchan":"Auchan","action":"Action","ikea":"IKEA","steam":"Steam","burger king":"Burger King","kfc":"KFC","quick":"Quick","subway":"Subway","uniqlo":"Uniqlo","kiabi":"Kiabi","h m":"H&M","netflix":"Netflix","spotify":"Spotify","courses":"Courses","tacos":"Tacos","kebab":"Kebab","decathlon":"Décathlon","boulangerie":"Boulangerie","king jouet":"King Jouet","essence":"Essence","carburant":"Carburant"});
 function quickExpense(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string"||command.length>1600)return null;
  const text=command.trim().replace(/’/g,"'").replace(/\s+/g," ");
  const m=text.match(/^j[' ]ai (?:dépensé|depense|payé|paye) (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s+(chez|de|en)\s+([^.!?;]+)[.!?]?$/iu);
  if(!m)return null;
  const merchant=normalizeCategory(m[2]),known=Object.hasOwn(quickMerchants,merchant);
  // A merchant-only payment does not need AI to extract the exact amount.
  // For unknown shops, leave the category unset and require review instead
  // of guessing. Only a fully bounded "chez NAME" clause is accepted.
  const safeStore=m[2].toLowerCase()==="chez"&&
   /^[\p{L}][\p{L}\p{M}\p{N}'’ &.-]{1,59}$/u.test(m[3].trim())&&
   !/\b(?:et|puis|ensuite|pour|avec|mais|demain|hier|aujourd'hui|chaque|tous|mensuel|mois|semaine|annule|supprime|efface|modifie|ajoute|recu|reçu|payé|paye|dépensé|depense)\b/iu.test(m[3])&&
   !/\d{1,6}(?:[,.]\d{1,2})?\s*(?:€|euros?)\b/iu.test(m[3]);
  const label=(known||safeStore)?createExpenseLabel(m[3]):null;
  if(!label)return null;
  const [whole,decimal=""]=m[1].replace(",",".").split("."),amountCents=Number(whole)*100+Number(decimal.padEnd(2,"0"));
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>100000000)return null;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"expense",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label,frequency:"once"}]},ctx,command);
  return checked.ok?checked:null;
 }
 // Deterministic intents: match the entire utterance, never a fragment.
 const amountPattern="(?:\\d{1,6}(?:[,.]\\d{1,2})?|zero)";
 function centsFromText(v){
  if(v==="zero")return 0;
  const [whole,decimal=""]=v.replace(",",".").split(".");
  const n=Number(whole)*100+Number(decimal.padEnd(2,"0"));
  return Number.isSafeInteger(n)&&n>=0&&n<=100000000?n:null;
 }
 function quickBudget(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string"||command.length>1600)return null;
  let text=command.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/’/g,"'").replace(/\s+/g," ").replace(/[.!?]$/,"");
  const monthly=/(?: chaque mois| par mois| tous les mois)$/.test(text);
  if(monthly)text=text.replace(/(?: chaque mois| par mois| tous les mois)$/,"");
  const selected=ctx.selectedMonth||ctx.today.slice(0,7);if(!monthOK(selected,ctx))return null;
  const delta=text.match(new RegExp("^(ajoute|augmente|retire|diminue|enleve|baisse|reduis) (?:de )?("+amountPattern+")\\s*(?:€|euros?)? (?:au|du|le) budget (?:de |d'|des |pour )?(.+)$"));
  const deltaAfter=text.match(new RegExp("^(augmente|diminue|baisse|reduis|ajoute|retire) (?:le )?budget (?:de |d'|des |pour )?(.+?) de ("+amountPattern+")\\s*(?:€|euros?)?$"));
  const target=text.match(new RegExp("^(?:mets|fixe|passe|regle) (?:le )?budget (?:de |d'|des |pour )?(.+?) a ("+amountPattern+")\\s*(?:€|euros?)?$"));
  const zero=text.match(/^(?:zero (?:euro|euros|€)?\s*(?:au |de )?budget|remets? (?:le )?budget) (?:de |d'|des |pour )?(.+?)(?: a zero)?$/);
  let name,raw,mode;
  if(delta){[,mode,raw,name]=delta;mode=["retire","diminue","enleve","baisse","reduis"].includes(mode)?"decrease":"increase"}
  else if(deltaAfter){[,mode,name,raw]=deltaAfter;mode=["retire","diminue","baisse","reduis"].includes(mode)?"decrease":"increase"}
  else if(target){[,name,raw]=target;mode="set"}
  else if(zero&&(text.startsWith("zero ")||text.endsWith(" a zero"))){name=zero[1];raw="zero";mode="set"}
  else return null;
  const amountCents=centsFromText(raw);if(amountCents===null||mode!=="set"&&amountCents===0)return null;
  const key=normalizeCategory(name);if(!key||key.length>120)return null;
  const base={kind:"plan",categoryId:null,owner:ctx.actor,amountCents,date:selected+"-01",label:name.trim(),frequency:monthly?"monthly":"once",planMode:mode};
  const available=availableCategories(base,ctx),exact=available.filter(c=>normalizeCategory(c.name)===key);
  if(exact.length>1)return null;
  if(exact.length===1){base.categoryId=exact[0].id;base.owner=exact[0].owner;base.label=exact[0].name;}
  else{
   // Budget aliases must be exact, rather than arbitrary substrings or a partial command.
   const candidates=categoryRules.filter(r=>[r.name,...r.aliases,...r.terms].some(t=>normalizeCategory(t)===key));
   if(candidates.length!==1)return null;
   const rule=candidates[0],names=new Set([rule.name,...rule.aliases].map(normalizeCategory));
   const matches=available.filter(c=>c.kind===rule.kind&&names.has(normalizeCategory(c.name)));
   if(matches.length>1)return null;
   if(matches.length===1){base.categoryId=matches[0].id;base.owner=matches[0].owner;base.label=matches[0].name;}
   else if(ctx.categories.some(c=>c.kind===rule.kind&&names.has(normalizeCategory(c.name))))return null;
   else{base.label=rule.name;const checked=validateReview({kind:"draft",operations:[base]},ctx);return checked.ok?{...checked,suggestions:[{index:0,ruleKey:rule.key}]}:null;}
  }
  const checked=validateReview({kind:"draft",operations:[base]},ctx);
  return checked.ok?{...checked,suggestions:[]}:null;
 }
 function quickFamilyMovement(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string"||command.length>1600)return null;
  const text=command.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/’/g,"'").replace(/\s+/g," ").replace(/[.!?]$/,"");
  const out=text.match(new RegExp("^j'ai (?:fait un virement|envoye|verse|vire) (?:de )?("+amountPattern+")\\s*(?:€|euros?) (?:a|vers le compte de) (maman|papa)$"));
  const incoming=text.match(new RegExp("^j'ai recu ("+amountPattern+")\\s*(?:€|euros?) de (maman|papa)$"));
  if(!out&&!incoming)return null;
  const m=out||incoming,amountCents=centsFromText(m[1]);if(amountCents===null||amountCents<=0)return null;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:out?"expense":"income",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label:"Virement "+m[2],frequency:"once",categoryHint:out?"transfer":"extra"}]},ctx,command);
  return checked.ok?checked:null;
 }

 // Explicit category creation is a review-only command, not an invented database ID.
 function validateCategoryDraft(v,c){
  if(!contextOK(c)||!exact(v,["kind","name","owner","month","date","budgetCents","expenseCents"])||v.kind!=="categoryDraft"||!clean(v.name,60)||!/^[\p{L}\p{N}][\p{L}\p{N} /&'’_-]{0,59}$/u.test(v.name)||!ownerOK(v.owner,c)||v.owner!==c.actor||!monthOK(v.month,c)||!validDate(v.date)||v.date!==c.today)return fail("Création de catégorie invalide.");
  if(c.categories.some(x=>normalizeCategory(x.name)===normalizeCategory(v.name)))return fail("Une catégorie de ce nom existe déjà.");
  if(v.budgetCents!==null&&(!Number.isSafeInteger(v.budgetCents)||v.budgetCents<0||v.budgetCents>100000000))return fail("Budget invalide.");
  if(v.expenseCents!==null&&(!Number.isSafeInteger(v.expenseCents)||v.expenseCents<=0||v.expenseCents>100000000))return fail("Dépense invalide.");
  if(v.expenseCents!==null&&v.month!==v.date.slice(0,7))return fail("Les opérations ne concernent pas le même mois.");
  return {ok:true,value:{...v,name:v.name.trim()}};
 }
 function quickCreateCategory(command,c){
  if(!contextOK(c)||!ownerOK(c.actor,c)||typeof command!=="string"||command.length>1600)return null;
  const t=command.trim().replace(/’/g,"'").replace(/\s+/g," ").replace(/[.!?]$/,"");
  // A new named category is a separate creation intent; never reuse the
  // budget of an existing parent category such as Loisirs.
  const direct=t.match(/^(?:crée|cree|créer|creer) (?:une |la )?cat[ée]gorie (?:nomm[ée]e? )?([\p{L}\p{N}][\p{L}\p{N} /&'_-]{0,59}?) avec un budget de (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)$/iu);
  if(direct){
   const month=c.selectedMonth||c.today.slice(0,7),amount=centsFromText(direct[2]);
   if(amount===null)return null;
   const draft={kind:"categoryDraft",name:direct[1].trim(),owner:c.actor,month,date:c.today,budgetCents:amount,expenseCents:null};
   if(c.categories.some(x=>normalizeCategory(x.name)===normalizeCategory(draft.name)))return validateAssistantResult({kind:"clarify",message:"Impossible de créer « "+draft.name+" » : cette catégorie existe déjà dans le foyer. Pour modifier son budget, demande explicitement « Fixe le budget "+draft.name+" à 60 euros »."},c);
   return validateCategoryDraft(draft,c);
  }
  // Split clauses only at sentence punctuation or a conjunction followed by an action.
  // Decimal separators inside amounts must remain intact.
  const head=t.match(/^(?:crée|cree|créer|creer|ajoute) (?:une |la )?cat[ée]gorie (?:nomm[ée]e? )?(?:budget )?([^,;.!?]+?)(?:(?:[,;.!?]\s*| (?:et|puis) )(.+))?$/iu);
  if(!head)return null;
  const name=head[1].trim();if(!/^[\p{L}\p{N}][\p{L}\p{N} /&'_-]{0,59}$/u.test(name)||/\b(?:et|puis|avec|supprime|efface|mets|ajoute|fixe|enregistre)\b/i.test(name))return null;
  let budgetCents=null,expenseCents=null;
  if(head[2]){
   const tail=head[2].normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
   const clauses=tail.split(/(?:[,;.!?]\s*| (?:et|puis) )(?=(?:et |puis )?(?:mets(?:-y| y)?|fixe|ajoute(?:-y| y)?|enregistre)\b)/).map(s=>s.replace(/^(?:et |puis )/,"").trim());
   if(clauses.length>2)return null;
   for(const clause of clauses){
    const b=clause.match(new RegExp("^(?:mets-y|mets y|fixe|ajoute|mets) (?:un |le )?budget (?:de |a )?("+amountPattern+")\\s*(?:€|euros?)$"));
    const e=clause.match(new RegExp("^(?:ajoute-y|ajoute y|ajoute|enregistre) (?:(?:une |la )?depense de ("+amountPattern+")\\s*(?:€|euros?)|("+amountPattern+")\\s*(?:€|euros?) (?:de depenses?|en depenses?))(?:(?: dans| pour) (?:cette|la) categorie)?$"));
    if(b&&budgetCents===null){budgetCents=centsFromText(b[1]);if(budgetCents===null)return null}
    else if(e&&expenseCents===null){expenseCents=centsFromText(e[1]||e[2]);if(!expenseCents)return null}
    else return null;
   }
  }
  const month=c.selectedMonth||c.today.slice(0,7);
  const matches=c.categories.filter(x=>normalizeCategory(x.name)===normalizeCategory(name));
  if(matches.length){
   // A CREATE request must never silently become a SET-budget or expense on
   // an existing category, even when the spoken command contains both.
   return validateAssistantResult({kind:"clarify",message:"Impossible de créer « "+name+" » : cette catégorie existe déjà dans le foyer. Pour modifier son budget, demande explicitement « Fixe le budget "+name+" à 60 euros »."},c);
  }
  const checked=validateCategoryDraft({kind:"categoryDraft",name,owner:c.actor,month,date:c.today,budgetCents,expenseCents},c);return checked.ok?checked:null;
 }
 function quickCategoryQuery(command,c){
  if(!contextOK(c)||typeof command!=="string"||command.length>1600)return null;
  const t=normalizeCategory(command);
  const m=t.match(/^(?:(?:de )?combien (?:etait|est|s elevait) (?:mon |le )?budget (?:reel |prevu )?(?:de |des |d |pour )?|quel etait (?:mon |le )?budget (?:reel |prevu )?(?:de |des |d |pour )?|combien (?:ai je|j ai) depense (?:en |dans |pour )?)(.+?) (le mois dernier|le mois precedent|ce mois ci)$/);
  if(!m)return null;
  const current=c.today.slice(0,7),[y,n]=current.split("-").map(Number),d=new Date(Date.UTC(y,n-2,1));
  const month=m[2]==="ce mois ci"?current:d.toISOString().slice(0,7);
  if(month<c.firstMonth)return {ok:true,value:{kind:"answer",message:"Aucune donnée de ce foyer n’est disponible pour "+month+"."}};
  const key=m[1],op={kind:"expense",date:month+"-01",label:key,categoryId:null};
  const available=availableCategories(op,c),exactMatches=available.filter(x=>normalizeCategory(x.name)===key);
  const rule=categoryRules.filter(r=>r.kind==="expense"&&[r.name,...r.aliases,...r.terms].some(t=>normalizeCategory(t)===key));
  const alias=rule.length===1?new Set([rule[0].name,...rule[0].aliases].map(normalizeCategory)):new Set();
  const matched=exactMatches.length?exactMatches:available.filter(x=>alias.has(normalizeCategory(x.name)));
  if(matched.length!==1)return {ok:true,value:{kind:"clarify",message:matched.length?"Plusieurs catégories correspondent. Indique leur nom exact.":"Aucune catégorie active ne correspond à « "+key+" » pour "+month+"."}};
  return validateAssistantResult({kind:"query",query:"categories",month,compareMonth:null,categoryId:matched[0].id,owner:null},c);
 }
 // Mirror the app: exact month overrides latest forward, then the zero baseline.
 function readBudgetCents(rows,month){
  if(!Array.isArray(rows)||!validMonth(month))return null;
  const eligible=rows.filter(r=>String(r.month).slice(0,7)<=month);
  const exact=eligible.filter(r=>String(r.month).slice(0,7)===month&&r.scope==="month");
  const forward=eligible.filter(r=>r.scope==="forward").sort((a,b)=>String(b.month).localeCompare(String(a.month)));
  if(exact.length>1||forward.length>1&&String(forward[0].month)===String(forward[1].month))return null;
  const r=exact[0]||forward[0];if(!r)return 0;
  const amount=Number(r.planned_amount),n=Math.round(amount*100);return Number.isFinite(amount)&&Number.isSafeInteger(n)&&n>=0?n:null;
 }
 function categoryReport({month,categoryId,categoryUuid,budgets,transactions,recurrences}){
  const plannedCents=readBudgetCents(budgets,month);if(plannedCents===null||!Array.isArray(transactions)||!Array.isArray(recurrences))return null;
  let actualCents=0,recurringCents=0;
  const toCents=v=>{const n=Math.round(Number(v)*100);return Number.isSafeInteger(n)?n:null};
  for(const r of transactions){if(r.category_id!==categoryUuid||String(r.transaction_date).slice(0,7)!==month||(r.metadata?.type||"expense")!=="expense")continue;const a=toCents(r.amount);if(a===null)return null;actualCents+=a}
  for(const r of recurrences){
   if(String(r.start_month).slice(0,7)>month||(r.end_month&&String(r.end_month).slice(0,7)<month)||(r.excluded_months||[]).includes(month))continue;
   const ov=r.overrides?.[month]||{},type=ov.type||r.metadata?.type||"expense",matches=Object.hasOwn(ov,"category")?ov.category===categoryId||ov.category===categoryUuid:r.category_id===categoryUuid;
   if(!matches||type!=="expense")continue;const a=toCents(Object.hasOwn(ov,"amount")?ov.amount:r.amount);if(a===null)return null;recurringCents+=a;actualCents+=a;
  }
  if(!Number.isSafeInteger(actualCents)||!Number.isSafeInteger(recurringCents))return null;
  return {plannedCents,actualCents,remainingCents:plannedCents-actualCents,recurringCents};
 }

 // Smart Engine: normalize only recognized monetary expressions and anchored synonyms.
 const frenchUnits=["zero","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize"];
 const frenchSmall=new Map(frenchUnits.map((v,i)=>[v,i]));
 for(let i=17;i<20;i++)frenchSmall.set("dix "+frenchUnits[i-10],i);
 for(const [t,n] of [["vingt",20],["trente",30],["quarante",40],["cinquante",50],["soixante",60],["septante",70],["huitante",80],["nonante",90]]){
  frenchSmall.set(t,n);for(let u=1;u<10;u++){frenchSmall.set(t+(u===1?" et ":" ")+frenchUnits[u],n+u);if(u===1)frenchSmall.set(t+" un",n+u)}
 }
 for(let i=70;i<80;i++){const u=i-60;frenchSmall.set("soixante"+(u===11?" et ":" ")+([...frenchSmall].find(([k,v])=>v===u)?.[0]),i)}
 frenchSmall.set("quatre vingt",80);frenchSmall.set("quatre vingts",80);
 for(let i=81;i<100;i++){const u=i-80;frenchSmall.set("quatre vingt "+([...frenchSmall].find(([k,v])=>v===u)?.[0]),i)}
 frenchSmall.set("une",1);
 const foldMoney=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[-‑–]/g," ").replace(/\s+/g," ").trim();
 function frenchNumber(text){
  const s=foldMoney(text);if(frenchSmall.has(s))return frenchSmall.get(s);
  function underThousand(v){
   if(frenchSmall.has(v))return frenchSmall.get(v);
   const m=v.match(/^(?:(deux|trois|quatre|cinq|six|sept|huit|neuf) )?cents?(?: (.+))?$/);if(!m)return null;
   const rest=m[2]?frenchSmall.get(m[2]):0;if(rest===undefined||m[2]&&rest===0)return null;
   return (m[1]?frenchSmall.get(m[1]):1)*100+rest;
  }
  const thousand=s.match(/^(?:(.+) )?mille(?: (.+))?$/);
  if(thousand){const a=thousand[1]?underThousand(thousand[1]):1,b=thousand[2]?underThousand(thousand[2]):0;return a!==null&&a>0&&b!==null?a*1000+b:null}
  return underThousand(s);
 }
 const numberWord="(?:z[eé]ro|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|quarante|cinquante|soixante|septante|huitante|nonante|cents?|mille)";
 const spokenMoney=new RegExp("(?<![\\p{L}\\p{N}-])("+numberWord+"(?:(?:[\\s‑–-]+)(?:"+numberWord+"|et))*)\\s+(euros?|balles?)\\b","giu");
 function normalizeLanguage(command){
  if(typeof command!=="string"||command.length>1600)return command;
  let t=command.normalize("NFC").replace(/’/g,"'").replace(/\s+/g," ").trim();
  t=t.replace(spokenMoney,(all,words,currency,offset,source)=>{
   if(foldMoney(words).endsWith(" et"))return all;
   // Never partially convert a mixed numeral or a negative expression.
   if(/(?:\d|[-−]|\bmoins)\s*$/iu.test(source.slice(0,offset)))return all;
   const n=frenchNumber(words);return n===null?all:n+" euros";
  });
  t=t.replace(/(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?=\s*(?:€|euros?|balles?)\b|\s*€)/giu,m=>m.replace(/\s/g,""));
  t=t.replace(/(\d+(?:[,.]\d{1,2})?)\s+balles?\b/giu,"$1 euros");
  t=t.replace(/^(?:s'il te plaît[,.]?\s+|peux-tu\s+|stp[,.]?\s+)/iu,"").replace(/(?:[,.]?\s+(?:s'il te plaît|merci|stp))[.!?]?$/iu,"");
  t=t.replace(/^j[' ]ai (?:claqué|claque|déboursé|debourse|lâché|lache) /iu,"J'ai dépensé ").replace(/^j[' ]ai (?:touché|touche|encaissé|encaisse) /iu,"J'ai reçu ");
  t=t.replace(/^rajoute /iu,"Ajoute ").replace(/^réduis /iu,"Diminue ");
  // A category bundle can be dictated without punctuation. Normalize only after explicit creation intent.
  if(/^(?:crée|cree|créer|creer|ajoute) (?:une |la )?cat[ée]gorie /iu.test(t)){
   t=t.replace(/(?<=[\p{L}\p{N}])\s+(?:avec|(?:et )?(?:mets[- ]y|ajoute[- ]y|mets|fixe|ajoute))\s+(?=(?:un |le )?budget\b)/iu,", mets-y ");
   t=t.replace(/,\s*,/g,",");
   t=t.replace(/(?:\s+et|\s+puis|[,;.])\s+(?:une |la )?d[ée]pense\s+de\s+/iu," et ajoute une dépense de ");
  }
  return t;
 }

 // Names of recipients are labels, never a second owner or a new category.
 function quickNamedIncome(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx))return null;
  const t=command.trim().replace(/’/g,"'").replace(/[.!?]$/,"");
  const m=t.match(/^j[' ]ai (?:reçu|recu|touché|touche|encaissé|encaisse) (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s+(?:de |d'|par |venant de )([\p{L}][\p{L}' -]{0,49})$/iu);
  if(!m)return null;
  const name=m[2].trim().replace(/\s+/g," "),amountCents=centsFromText(m[1]);
  if(!amountCents||name.length>50||/\b(?:et|puis|demain|hier|supprime|efface|ajoute|modifie|chaque|mensuel|tous|compte|transfert)\b/iu.test(name))return null;
  const label="Reçu de "+name;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"income",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label,frequency:"once",categoryHint:"extra"}]},ctx,command);
  return checked.ok?checked:null;
 }
 function quickSaving(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx))return null;
  const t=command.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/’/g,"'").replace(/[.!?]$/,"");
  const m=t.match(/^j[' ]ai (?:mis|place|verse|epargne|economise) (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)(?: (?:en epargne|de cote|sur (?:mon |le )?(?:livret|compte epargne)))?$/u);
  if(!m)return null;
  // A generic "J'ai versé 100 euros" is ambiguous; require explicit saving destination.
  if(!/(?:en epargne|de cote|livret|compte epargne)$/.test(t)&&!/^j[' ]ai (?:epargne|economise) /.test(t))return null;
  const amountCents=centsFromText(m[1]);if(!amountCents)return null;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"saving",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label:"Mise en épargne",frequency:"once",categoryHint:"saving"}]},ctx,command);
  return checked.ok?checked:null;
 }

 // Local, complete-sentence interpretation for category-bearing products/purchases.
 // Never infer the account holder from a shop or a sender.

 // Full label remains the persisted financial label; the separator permits
 // a compact "merchant + purchase description" preview without schema changes.
 function expenseLabelParts(label){
  const value=String(label||"").trim(),split=value.indexOf(" · ");
  return split===-1?{merchant:value,detail:null}:{merchant:value.slice(0,split),detail:value.slice(split+3)};
 }
 function merchantName(raw){
  const name=String(raw??"").trim().replace(/\s+/g," ");
  const key=normalizeCategory(name);
  if(key==="decathlon")return "Décathlon";
  if(key==="king jouet")return "King Jouet";
  return quickMerchants[key]||name;
 }
 function productDescription(raw){
  const cleaned=String(raw??"").trim().replace(/\s+/g," ").replace(/^(?:(?:de la|de l'|une|des|les|du|un|le|la)\s+|l')/iu,"").trim();
  if(!cleaned||cleaned.length>64||/[;.!?]/.test(cleaned)||/\b(?:et|puis|ensuite|supprime|efface|demain|hier|tous les mois)\b/iu.test(cleaned)||/\d{1,6}(?:[,.]\d{1,2})?\s*(?:€|euros?)\b/iu.test(cleaned))return null;
  if(!/^[\p{L}\p{N}][\p{L}\p{N}'’/ +&-]*$/u.test(cleaned))return null;
  const key=normalizeCategory(cleaned);
  if(key==="lego")return "LEGO";
  if(key==="produits menagers")return "Produits ménagers";
  if(key==="cours du mois"||key==="course du mois"||key==="courses du mois")return "Courses du mois";
  if(key==="cours de la semaine"||key==="course de la semaine"||key==="courses de la semaine")return "Courses de la semaine";
  return cleaned.slice(0,1).toLocaleUpperCase("fr-FR")+cleaned.slice(1);
 }
 function createExpenseLabel(merchant,description=null){
  const name=merchantName(merchant);
  if(!name||name.length>60||/[\r\n<>]/.test(name)||/\b(?:et|puis|supprime|efface|demain|hier)\b/iu.test(name))return null;
  const detail=description===null?null:productDescription(description);
  if(description!==null&&!detail)return null;
  const result=detail?name+" · "+detail:name;
  return result.length<=120?result:null;
 }
 function productCategoryHint(description){
  const value=normalizeCategory(description);
  if(/\b(?:courses?|supermarche|alimentation)\b/.test(value))return "groceries";
  if(/\b(?:menagers?|lessive|entretien|nettoyant)\b/.test(value))return "home";
  if(/\b(?:essence|gazole|diesel|carburant)\b/.test(value))return "fuel";
  if(/\b(?:lego|jeux? videos?|escalade|figurines?|cinema)\b/.test(value))return "leisure";
  if(/\b(?:chaussures?|vetements?|pull|pantalon|manteau)\b/.test(value))return "clothing";
  if(/\b(?:cadeaux?|anniversaire)\b/.test(value))return "gifts";
  if(/\b(?:medicaments?|pharmacie|dentiste)\b/.test(value))return "health";
  return null;
 }
 // Semantic expense parsing must cover an entire clause, never an arbitrary
 // fragment of a compound command. Multi-operation splitting happens upstream.
 function quickDetailedExpense(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string"||command.length>1600)return null;
  const text=command.trim().replace(/’/g,"'").replace(/\s+/g," ").replace(/[.!?]$/,"");
  const money="(\\d{1,6}(?:[,.]\\d{1,2})?)\\s*(?:€|euros?)";
  const patterns=[
   new RegExp("^j[' ]ai (?:acheté|achete|pris) (.+?) (?:chez|à) (.+?) (?:pour|à) "+money+"$","iu"),
   new RegExp("^j[' ]ai (?:acheté|achete|pris) (.+?) (?:à|pour) "+money+" (?:chez|à) (.+)$","iu"),
   new RegExp("^j[' ]ai (?:payé|paye|dépensé|depense) "+money+" (?:chez|à) (.+?) pour (.+)$","iu"),
   new RegExp("^j[' ]ai (?:fait|dépensé|depense|payé|paye|mis) "+money+" (?:de |d'|en )(.+?) (?:chez|à) (.+)$","iu")
  ];
  let product=null,merchant=null,rawAmount=null;
  for(let i=0;i<patterns.length;i++){
   const m=text.match(patterns[i]);if(!m)continue;
   if(i===0){product=m[1];merchant=m[2];rawAmount=m[3]}
   else if(i===1){product=m[1];rawAmount=m[2];merchant=m[3]}
   else if(i===2){rawAmount=m[1];merchant=m[2];product=m[3]}
   else{rawAmount=m[1];product=m[2];merchant=m[3]}
   break;
  }
  if(product===null)return null;
  const amountCents=centsFromText(rawAmount),label=createExpenseLabel(merchant,product),hint=productCategoryHint(product);
  if(!amountCents||!label||(!hint&&!Object.hasOwn(quickMerchants,normalizeCategory(merchant))))return null;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"expense",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label,frequency:"once",...(hint?{categoryHint:hint}:{})}]},ctx,command);
  return checked.ok?checked:null;
 }
 function quickContextualExpense(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string"||command.length>1600)return null;
  const t=command.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/’/g,"'").replace(/[.!?]$/,"");
  const monetary="(\\d{1,6}(?:[,.]\\d{1,2})?)\\s*(?:€|euros?)";
  const byProduct=t.match(new RegExp("^j'ai (?:mis|fait|paye|achete) "+monetary+" (?:d'|de |en )(?:(?:l'|la |les )?)(essence|gazole|diesel|carburant|courses|produits menagers|lessive|produits d'entretien) (?:a|chez) (?:la station )?([\\p{L}\\p{N}&' .-]{2,55})$","u"));
  const bought=t.match(new RegExp("^j'ai (?:achete|pris) (?:un|une|des) (lego|jeu video|jeux video|figurine|figurines) (?:a|pour) "+monetary+" chez ([\\p{L}\\p{N}&' .-]{2,55})$","u"));
  if(!byProduct&&!bought)return null;
  const rawAmount=byProduct?byProduct[1]:bought[2],merchant=(byProduct?byProduct[3]:bought[3]).trim();
  const item=byProduct?byProduct[2]:bought[1];
  const amountCents=centsFromText(rawAmount);
  if(!amountCents||!merchant||/\b(?:et|puis|supprime|efface|modifie|demain|hier|chaque mois)\b/u.test(merchant))return null;
  const kind=/^(?:essence|gazole|diesel|carburant)$/.test(item)?"fuel":item==="courses"?"groceries":/^(?:produits menagers|lessive|produits d'entretien)$/.test(item)?"home":"leisure";
  const label=createExpenseLabel(merchant,item);
  if(!label)return null;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"expense",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label,frequency:"once",categoryHint:kind}]},ctx,command);
  return checked.ok?checked:null;
 }
 function quickInternalTransfer(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string")return null;
  const t=command.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/’/g,"'").replace(/[.!?]$/,"");
  const m=t.match(/^j'ai (?:transfere|vire|deplace) (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?) de (?:mon|le) compte courant vers (?:mon|le) (livret a|livret|compte epargne)$/u);
  if(!m)return null;
  const amountCents=centsFromText(m[1]);if(!amountCents)return null;
  const label="Transfert interne vers "+(m[2]==="livret a"?"Livret A":m[2]==="livret"?"livret":"compte épargne");
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"saving",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label,frequency:"once",categoryHint:"saving"}]},ctx,command);
  return checked.ok?checked:null;
 }
 function quickBankBalanceAnswer(command,ctx){
  if(!contextOK(ctx)||typeof command!=="string")return null;
  const t=normalizeCategory(command);
  if(!/^(?:combien (?:d argent |d euros )?(?:ai je|j ai) (?:reellement )?(?:sur|dans) (?:mon |le )?compte (?:bancaire|courant)(?: actuellement| en ce moment)?|quel est (?:mon |le )?solde (?:bancaire|de mon compte bancaire|de mon compte courant)(?: actuellement| en ce moment)?)$/.test(t))return null;
  return validateAssistantResult({kind:"answer",message:"Je ne peux pas consulter ton solde bancaire réel en temps réel. Je peux seulement analyser les opérations enregistrées dans Smart Budget."},ctx);
 }
 // Preserve a contextual product (e.g. LEGO, essence) when Gemma omitted a category.
 // Restrict to one-operation prompts with one amount to avoid cross-contaminating batches.
 function contextualCategoryHint(command,op){
  if(op?.kind!=="expense"||typeof command!=="string")return null;
  const amounts=command.match(/\d{1,6}(?:[,.]\d{1,2})?\s*(?:€|euros?)\b/giu);
  if(amounts?.length!==1)return null;
  const query=normalizeCategory(command);
  const scores=categoryRules.filter(r=>r.kind==="expense").map(r=>({key:r.key,score:Math.max(0,...r.terms.filter(t=>containsTerm(query,t)).map(t=>normalizeCategory(t).length))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  return scores.length&&(!scores[1]||scores[0].score>scores[1].score)?scores[0].key:null;
 }

 // Only household members explicitly supplied by the authenticated server can be
 // selected as payers. Never use an arbitrary named person as a guessed owner.
 function ownerSlotForName(name,ctx){
  if(ctx.solo||!obj(ctx.members))return null;
  const wanted=normalizeCategory(name);
  const names=Object.entries(ctx.members).filter(([slot,value])=>ownerOK(slot,ctx)&&typeof value==="string"&&normalizeCategory(value)===wanted);
  return names.length===1?names[0][0]:null;
 }
 const householdItemKinds=Object.freeze({
  "courses":{label:"Courses",hint:"groceries"},
  "course":{label:"Courses",hint:"groceries"},
  "bus":{label:"Bus",hint:"transport"},
  "train":{label:"Train",hint:"transport"},
  "metro":{label:"Métro",hint:"transport"},
  "tram":{label:"Tram",hint:"transport"},
  "essence":{label:"Essence",hint:"fuel"},
  "medicaments":{label:"Médicaments",hint:"health"}
 });
 function householdItemOperation(item,owner,amount,ctx){
  const category=householdItemKinds[normalizeCategory(item)],cents=centsFromText(amount);
  if(!category||!cents||!ownerOK(owner,ctx))return null;
  const normalized=normalizeModelDraft({kind:"draft",operations:[{kind:"expense",categoryId:null,owner,amountCents:cents,date:ctx.today,label:category.label,frequency:"once",categoryHint:category.hint}]},ctx,"");
  return normalized.ok?normalized:null;
 }
 // Special-case two clearly attributed payments. Do not guess members in the
 // one-person pilot or quietly reassign another person's expense to the actor.
 function quickAttributedExpenses(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string")return null;
  const t=command.trim().replace(/’/g,"'").replace(/[.!?]$/,"");
  const m=t.match(/^([\p{L}][\p{L}' -]{0,49}?)\s+a (?:payé|paye|dépensé|depense)\s+(\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s+de\s+(courses?|bus|train|métro|metro|tram|essence|médicaments|medicaments)\s+et\s+(?:moi\s+)?j[' ]ai (?:payé|paye|dépensé|depense)\s+(\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s+de\s+(courses?|bus|train|métro|metro|tram|essence|médicaments|medicaments)$/iu);
  if(!m)return null;
  const member=ownerSlotForName(m[1],ctx);
  if(!member){
   return validateAssistantResult({kind:"answer",message:ctx.solo
    ?"Ce foyer de test est individuel. Je ne peux pas attribuer une dépense à "+m[1]+". Aucun mouvement proposé ; il faut tester cette demande dans un foyer à deux."
    :"Cette personne n'est pas identifiée sans ambiguïté parmi les membres autorisés du foyer. Aucun mouvement proposé."},ctx);
  }
  const one=householdItemOperation(m[3],member,m[2],ctx),two=householdItemOperation(m[5],ctx.actor,m[4],ctx);
  if(!one||!two)return null;
  const operations=[one.value.operations[0],two.value.operations[0]];
  const checked=validateReview({kind:"draft",operations},ctx);
  if(!checked.ok)return null;
  const suggestions=[...(one.suggestions||[]).map(s=>({...s,index:0})),...(two.suggestions||[]).map(s=>({...s,index:1}))];
  return {...checked,suggestions};
 }
 const frenchMonthNames=Object.freeze({janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12});
 function quickMedicalNote(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string")return null;
  const t=command.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/’/g,"'").replace(/[.!?]$/,"");
  const m=t.match(/^note (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?) de medicaments achetes? a la pharmacie le (\d{1,2}) (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?: (\d{4}))?$/u);
  if(!m)return null;
  const amountCents=centsFromText(m[1]),year=Number(m[4]||ctx.today.slice(0,4)),month=frenchMonthNames[m[3]],day=Number(m[2]);
  const date=String(year).padStart(4,"0")+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
  if(!amountCents||!validDate(date)||date>ctx.today||!monthOK(date.slice(0,7),ctx))return null;
  const checked=normalizeModelDraft({kind:"draft",operations:[{kind:"expense",categoryId:null,owner:ctx.actor,amountCents,date,label:"Pharmacie · Médicaments",frequency:"once",categoryHint:"health"}]},ctx,command);
  return checked.ok?checked:null;
 }
 function quickSingleMovement(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx))return null;
  let t=command.trim(),date=ctx.today;
  // Recognize date adverbs at the beginning OR end, never both.
  const leading=t.match(/^(hier|avant-hier|aujourd'hui)[,;:]?\s+/iu);
  if(leading)t=t.slice(leading[0].length).trim();
  const suffix=t.match(/ (hier|avant-hier|aujourd'hui)[.!?]?$/iu);
  if(leading&&suffix)return null;
  if(suffix)t=t.slice(0,suffix.index).trim();
  const moment=(leading?.[1]||suffix?.[1]||"").toLowerCase();
  if(moment==="hier"||moment==="avant-hier"){
   const day=new Date(ctx.today+"T12:00:00Z");
   day.setUTCDate(day.getUTCDate()-(moment==="hier"?1:2));date=day.toISOString().slice(0,10);
  }
  const direct=quickDetailedExpense(t,ctx)||quickExpense(t,ctx)||quickContextualExpense(t,ctx)||quickInternalTransfer(t,ctx)||quickFamilyMovement(t,ctx)||quickNamedIncome(t,ctx)||quickSaving(t,ctx);
  let r=direct;
  if(!r){
   const m=t.match(/^j[' ]ai reçu (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?) (?:de |en |pour (?:mon |le )?)(salaire|paie|cadeau|remboursement)[.!?]?$/iu);
   if(m){const amountCents=centsFromText(m[1]),hint=/salaire|paie/i.test(m[2])?"salary":"extra";if(amountCents>0)r=normalizeModelDraft({kind:"draft",operations:[{kind:"income",categoryId:null,owner:ctx.actor,amountCents,date:ctx.today,label:m[2],frequency:"once",categoryHint:hint}]},ctx,t)}
  }
  if(!r?.ok)return null;
  if(date===ctx.today)return r;
  const operations=r.value.operations.map(o=>({...o,date}));
  const checked=validateReview({kind:"draft",operations},ctx);
  return checked.ok?{...checked,suggestions:r.suggestions||[]}:null;
 }
 function quickMovementBatch(command,ctx){
  // Full clause matching. Decimal commas in amounts are not separators.
  const pieces=command.split(/(?:[,;]\s+|[.!?]\s+|\s+(?:et|puis)\s+)(?=(?:j[' ]ai\s+|achet[ée]\s+|mets[- ]en\s+|\d{1,6}(?:[,.]\d{1,2})?\s*(?:€|euros?)\s+(?:chez|de|en)\s+))/iu);
  if(pieces.length<2||pieces.length>12)return null;
  const operations=[],suggestions=[];
  for(const raw of pieces){
   let part=normalizeLanguage(raw.trim()),parsed=null;
   const linked=part.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().match(/^mets[- ]en (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)? (?:de cote|en epargne)[.!?]?$/u);
   if(linked){
    const previous=operations.at(-1),amountCents=centsFromText(linked[1]);
    if(!previous||previous.kind!=="income"||!amountCents||amountCents>previous.amountCents)return null;
    parsed=quickSaving("J'ai mis "+linked[1]+" euros de côté",ctx);
   }else{
    if(/^achet[ée]\s/iu.test(part))part="J'ai "+part;
    else if(/^\d/.test(part)){if(operations.at(-1)?.kind!=="expense")return null;part="J'ai dépensé "+part}
    parsed=quickSingleMovement(part,ctx);
   }
   if(!parsed?.ok||parsed.value.kind!=="draft"||parsed.value.operations.length!==1)return null;
   for(const s of parsed.suggestions||[])suggestions.push({...s,index:operations.length});
   operations.push(parsed.value.operations[0]);
  }
  const checked=validateReview({kind:"draft",operations},ctx);
  return checked.ok?{...checked,suggestions}:null;
 }
 // Compound review-only proposals keep category creation distinct from any
 // modification to an existing category. Neither operation can be committed.
 function validateMixedDraft(v,c){
  if(!contextOK(c)||!exact(v,["kind","operations","categories"])||v.kind!=="mixedDraft"||!Array.isArray(v.operations)||!Array.isArray(v.categories)||!v.operations.length||!v.categories.length||v.operations.length+v.categories.length>12)return fail("Lot mixte invalide.");
  const financial=validateReview({kind:"draft",operations:v.operations},c);
  if(!financial.ok)return financial;
  const categories=[],names=new Set();
  for(const item of v.categories){
   const checked=validateCategoryDraft(item,c);if(!checked.ok)return checked;
   const name=normalizeCategory(checked.value.name);
   if(names.has(name))return fail("Deux créations de catégories identiques.");
   names.add(name);categories.push(checked.value);
  }
  return {ok:true,value:{kind:"mixedDraft",operations:financial.value.operations,categories}};
 }
 function quickMixedCategory(command,ctx){
  if(!contextOK(ctx)||typeof command!=="string")return null;
  const text=command.trim().replace(/[.!?]$/,"");
  const match=text.match(/^(.+?)\s+(?:et|puis)\s+((?:crée|cree|créer|creer)(?=\s).+)$/iu);
  if(!match)return null;
  const plan=quickBudget(match[1],ctx),creation=quickCreateCategory(match[2],ctx);
  if(!plan?.ok||plan.value.kind!=="draft"||plan.value.operations.length!==1||plan.value.operations[0].kind!=="plan"||plan.value.operations[0].categoryId===null||!creation?.ok||creation.value.kind!=="categoryDraft")return null;
  const checked=validateMixedDraft({kind:"mixedDraft",operations:plan.value.operations,categories:[creation.value]},ctx);
  return checked.ok?{...checked,suggestions:plan.suggestions||[]}:null;
 }
 function creationRequested(command){
  const text=normalizeCategory(command);
  return /\b(?:cree|creer|creation)\b.{0,80}\bcategorie\b|\bcategorie\b.{0,80}\b(?:cree|creer)\b/.test(text);
 }
 function quickCommand(command,ctx){
  if(typeof command!=="string"||!contextOK(ctx))return null;
  const normalized=normalizeLanguage(command);
  const direct=quickBankBalanceAnswer(normalized,ctx)||quickAttributedExpenses(normalized,ctx)||quickMedicalNote(normalized,ctx)||quickMixedCategory(normalized,ctx)||quickCreateCategory(normalized,ctx)||quickCategoryQuery(normalized,ctx)||quickBudget(normalized,ctx)||quickSingleMovement(normalized,ctx)||quickMovementBatch(normalized,ctx);
  // Do not let a model silently turn an unsupported creation into a budget edit.
  return direct||(creationRequested(normalized)?validateAssistantResult({kind:"clarify",message:"Création de catégorie non comprise sans ambiguïté. Reformule en « Crée une catégorie Lego avec un budget de 60 euros ». Aucun budget existant ne sera modifié."},ctx):null);
 }
 root.SmartBudgetAssistantCore=Object.freeze({validateResult:validateAssistantResult,validateReview,resolvePlanAmount,validDate,validMonth,findDuplicates,categoryRules,normalizeCategory,availableCategories,classifyCategory,normalizeModelDraft,draftCategorySuggestion,quickExpense,quickBudget,quickFamilyMovement,quickCommand,validateCategoryDraft,quickCreateCategory,quickMixedCategory,validateMixedDraft,quickCategoryQuery,readBudgetCents,categoryReport,normalizeLanguage,frenchNumber,quickSingleMovement,quickMovementBatch,quickNamedIncome,quickSaving,quickContextualExpense,quickInternalTransfer,quickBankBalanceAnswer,contextualCategoryHint,expenseLabelParts,createExpenseLabel,productCategoryHint,quickDetailedExpense,quickAttributedExpenses,quickMedicalNote,ownerSlotForName});
})(globalThis);
