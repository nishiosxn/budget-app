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
 // Recognize only complete, unambiguous single-expense sentences. No partial matching.
 const quickMerchants=Object.freeze({"zara":"Zara","mcdo":"McDo","mc donald s":"McDonald's","mcdonalds":"McDonald's","mcdonald":"McDonald's","lidl":"Lidl","aldi":"Aldi","leclerc":"Leclerc","e leclerc":"E.Leclerc","carrefour":"Carrefour","intermarche":"Intermarché","auchan":"Auchan","action":"Action","ikea":"IKEA","steam":"Steam","burger king":"Burger King","kfc":"KFC","quick":"Quick","subway":"Subway","uniqlo":"Uniqlo","kiabi":"Kiabi","h m":"H&M","netflix":"Netflix","spotify":"Spotify","courses":"Courses","tacos":"Tacos","kebab":"Kebab","essence":"Essence","carburant":"Carburant"});
 function quickExpense(command,ctx){
  if(!contextOK(ctx)||!ownerOK(ctx.actor,ctx)||typeof command!=="string"||command.length>1600)return null;
  const text=command.trim().replace(/’/g,"'").replace(/\s+/g," ");
  const m=text.match(/^j[' ]ai (?:dépensé|depense|payé|paye) (\d{1,6}(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s+(?:chez|de|en)\s+([^.!?;]+)[.!?]?$/iu);
  if(!m)return null;
  const merchant=normalizeCategory(m[2]),label=Object.hasOwn(quickMerchants,merchant)?quickMerchants[merchant]:null;
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
  const head=t.match(/^(?:crée|cree|créer|creer|ajoute) (?:une |la )?cat[ée]gorie (?:nomm[ée]e? )?([^,;]+)(?:[,;] (.+))?$/iu);
  if(!head)return null;
  const name=head[1].trim();if(!/^[\p{L}\p{N}][\p{L}\p{N} /&'_-]{0,59}$/u.test(name)||/\b(?:et|puis|avec)\b/i.test(name))return null;
  let budgetCents=null,expenseCents=null;
  if(head[2]){
   const tail=head[2].normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
   const m=tail.match(new RegExp("^(?:mets-y|mets y|fixe|ajoute|mets) (?:un |le )?budget (?:de |a )?("+amountPattern+")\\s*(?:€|euros?)(?:(?:,? et |, | puis )(?:ajoute-y|ajoute y|ajoute|enregistre) ("+amountPattern+")\\s*(?:€|euros?) (?:de depenses?|en depenses?))?$"));
   if(!m)return null;budgetCents=centsFromText(m[1]);expenseCents=m[2]?centsFromText(m[2]):null;if(budgetCents===null||(m[2]&&(!expenseCents)))return null;
  }
  const month=c.selectedMonth||c.today.slice(0,7);
  const matches=c.categories.filter(x=>normalizeCategory(x.name)===normalizeCategory(name));
  if(matches.length){
   if(matches.length!==1||matches[0].kind!=="expense")return {ok:true,value:{kind:"clarify",message:"Une catégorie nommée "+name+" existe déjà. Choisis-la dans les catégories."}};
   const cat=matches[0],operations=[];
   if(budgetCents!==null)operations.push({kind:"plan",categoryId:cat.id,owner:cat.owner,amountCents:budgetCents,date:month+"-01",label:cat.name,frequency:"once",planMode:"set"});
   if(expenseCents!==null)operations.push({kind:"expense",categoryId:cat.id,owner:c.actor,amountCents:expenseCents,date:c.today,label:cat.name,frequency:"once"});
   if(!operations.length)return {ok:true,value:{kind:"answer",message:"La catégorie "+cat.name+" existe déjà."}};
   const checked=validateReview({kind:"draft",operations},c);return checked.ok?checked:null;
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
 function quickCommand(command,ctx){return quickCreateCategory(command,ctx)||quickCategoryQuery(command,ctx)||quickBudget(command,ctx)||quickExpense(command,ctx)||quickFamilyMovement(command,ctx)}
 root.SmartBudgetAssistantCore=Object.freeze({validateResult:validateAssistantResult,validateReview,resolvePlanAmount,validDate,validMonth,findDuplicates,categoryRules,normalizeCategory,availableCategories,classifyCategory,normalizeModelDraft,draftCategorySuggestion,quickExpense,quickBudget,quickFamilyMovement,quickCommand,validateCategoryDraft,quickCreateCategory,quickCategoryQuery,readBudgetCents,categoryReport});
})(globalThis);
