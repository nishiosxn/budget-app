(()=>{"use strict";
 const $=id=>document.getElementById(id),input=$("sbAssistantInput"),status=$("sbAssistantStatus"),result=$("sbAssistantResult"),form=$("sbAssistantForm"),send=$("send");
 const core=globalThis.SmartBudgetAssistantCore;
 let session=null,history=[],epoch=0,busy=false,pendingReview=null,usageRequest=0;
 const euro=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n/100);
 const kinds={expense:"Dépense",income:"Revenu",saving:"Mise en épargne",plan:"Budget prévu"};
 const queries={summary:"Résumé",categories:"Catégories",transactions:"Transactions",comparison:"Comparaison"};
 const errorMessages={assistant_not_enabled:"Assistant non activé côté serveur. Vérifie les secrets d’activation.",authentication_required:"Reconnecte-toi.",household_not_authorized:"Ce foyer n’est pas autorisé pour le pilote.",authorization_unavailable:"Vérification du foyer indisponible.",quota_exhausted:"Quota de test atteint. Réessaie demain (UTC).",quota_unavailable:"Compteur indisponible : aucune demande IA envoyée.",context_too_large:"Demande trop volumineuse.",invalid_history:"Brouillon périmé. Commence une nouvelle demande.",budget_preview_unavailable:"Impossible de lire le budget actuel. Aucune modification effectuée.",invalid_model_result:"La demande n’a pas pu être convertie en proposition fiable. Aucune opération enregistrée. Reformule en une commande simple.",model_unavailable_or_invalid:"Le modèle n’a pas fourni une réponse exploitable."};
 // Single-line default. Expand only for actual line breaks or visual wrapping.
 function resizeComposer(){
  input.style.height="auto";
  input.style.overflowY="hidden";
  const contentHeight=input.scrollHeight;
  const desired=Math.max(42,Math.min(contentHeight,180));
  input.style.height=desired+"px";
  input.style.overflowY=contentHeight>180?"auto":"hidden";
 }
 const voice=globalThis.SmartBudgetAssistantVoice.bind({input,button:$("mic"),status,clock:document.querySelector(".sb-voice-clock"),authorize:()=>window.confirm("Autoriser la dictée du navigateur ? Utilise uniquement des données fictives."),onTextChange:resizeComposer});
 input.addEventListener("input",resizeComposer);
 resizeComposer();
 function append(v){const line=document.createElement("div");line.className="sb-assistant-result-row";line.textContent=v;result.append(line)}
 let ruleContext=null,personalRules=Object.create(null);
 const ruleUtils=globalThis.SmartBudgetCategoryRules;
 const ruleStorageKey=()=>session?"smart-budget-v31-test-category-rules:"+session.householdId:null;
 function ruleNotice(message){$("ruleStatus").textContent=message}
 function readPersonal(){
  personalRules=Object.create(null);
  try{
   const key=ruleStorageKey();if(!key)return;
   const parsed=JSON.parse(localStorage.getItem(key)||"null");
   if(!parsed||parsed.enabled!==true||!Array.isArray(parsed.rules))return;
   for(const entry of parsed.rules.slice(0,200)){
    if(!Array.isArray(entry)||entry.length!==2)continue;
    const [term,id]=entry,normalized=core.normalizeCategory(term);
    if(normalized&&normalized.length<=80&&typeof id==="string"&&id.length<=120)personalRules[normalized]=id;
   }
  }catch{ruleNotice("Mémoire locale inaccessible : tes associations ne seront pas conservées après fermeture.")}
 }
 function savePersonal(){
  const key=ruleStorageKey();if(!key)return false;
  try{
   if(Object.keys(personalRules).length)localStorage.setItem(key,JSON.stringify({enabled:true,rules:Object.entries(personalRules).slice(0,200)}));
   else localStorage.removeItem(key);
   return true;
  }catch{return false}
 }
 function setPersonal(term,id){
  const key=core.normalizeCategory(term),target=ruleUtils.catalogOptions(ruleContext?.categories||[]).find(c=>c.value===id);
  if(!key||key.length>80)return {ok:false,message:"Entre un mot-clé ou une enseigne valide."};
  if(!target)return {ok:false,message:"Choisis une catégorie du catalogue ou du foyer."};
  if(Object.keys(personalRules).length>=200&&!Object.hasOwn(personalRules,key))return {ok:false,message:"Limite de 200 associations atteinte."};
  const updated=Object.hasOwn(personalRules,key);
  personalRules[key]=id;
  const saved=savePersonal();
  showRules();
  return {ok:true,message:(updated?"Association mise à jour":"Association ajoutée")+" : "+key+" → "+target.name+(saved?"":" (mémoire locale indisponible).")};
 }
 function showRules(){
  const list=$("rulePersonal"),def=$("ruleDefault"),sel=$("ruleCategory"),add=$("addRule"),previous=sel.value;
  list.replaceChildren();def.replaceChildren();sel.replaceChildren();
  const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Choisir une catégorie";sel.append(placeholder);
  const categories=(ruleContext?.categories||[]).slice();
  const options=ruleUtils.catalogOptions(categories);
  for(const [kind,label] of [["expense","Dépenses"],["income","Revenus"],["saving","Épargne"]]){
   const group=document.createElement("optgroup");group.label=label;
   for(const c of options.filter(c=>c.kind===kind)){
    const opt=document.createElement("option");opt.value=c.value;opt.textContent=c.name;group.append(opt);
   }
   if(group.children.length)sel.append(group);
  }
  sel.value=options.some(c=>c.value===previous)?previous:"";
  sel.disabled=!options.length;add.disabled=!options.length;
  for(const [term,id] of Object.entries(personalRules).sort((a,b)=>a[0].localeCompare(b[0],"fr"))){
   const cat=options.find(c=>c.value===id)||categories.find(c=>c.id===id),row=document.createElement("div");row.className="pilot-personal-rule";
   const name=document.createElement("strong");name.textContent=term;
   const target=document.createElement("span");target.className="pilot-rule-target";target.textContent="→ "+(cat?.name||"Catégorie indisponible");
   const del=document.createElement("button");del.type="button";del.className="pilot-link";del.textContent="Supprimer";del.setAttribute("aria-label","Supprimer la règle "+term);
   del.addEventListener("click",()=>{delete personalRules[term];const saved=savePersonal();showRules();ruleNotice(saved?"Association supprimée.":"Association supprimée de la session ; mémoire locale indisponible.")});
   row.append(name,target,del);list.append(row);
  }
  if(!Object.keys(personalRules).length){
   const empty=document.createElement("p");empty.className="pilot-rule-empty";empty.textContent="Aucune association personnelle pour le moment.";list.append(empty);
  }
  $("clearRules").disabled=!Object.keys(personalRules).length;
  for(const r of core.categoryRules){
   const row=document.createElement("div");row.className="pilot-rule-row";
   const name=document.createElement("strong"),example=document.createElement("span");name.textContent=r.name;example.textContent=r.terms.slice(0,7).join(", ");
   row.append(name,example);def.append(row);
  }
 }
 async function loadRuleCategories(){
  if(!session)return;
  const {token,householdId}=session;
  ruleContext=null;showRules();ruleNotice("Chargement des catégories du foyer…");
  const path="/rest/v1/categories?select=id,legacy_id,name,type,is_saving,owner_slot,created_from,excluded_months&household_id=eq."+encodeURIComponent(householdId)+"&archived_at=is.null&limit=301";
  try{
   const r=await json(path,{method:"GET",headers:headers(token)});
   if(session?.token!==token||session.householdId!==householdId)return;
   if(!r.ok||!Array.isArray(r.body)||r.body.length>300)throw Error("Catalogue indisponible");
   const categories=ruleUtils.fromRows(r.body);
   ruleContext={categories};showRules();
   ruleNotice(categories.length?categories.length+" catégorie"+(categories.length===1?"":"s")+" disponible"+(categories.length===1?"":"s")+" dans ton foyer.":"Aucune catégorie disponible dans ce foyer.");
  }catch{
   if(session?.token===token){ruleContext=null;showRules();ruleNotice("Impossible de charger les catégories. Reconnecte-toi pour réessayer.")}
  }
 }
 $("ruleEditor").addEventListener("submit",e=>{
  e.preventDefault();
  const term=$("ruleMerchant").value.trim(),id=$("ruleCategory").value;
  const saved=setPersonal(term,id);ruleNotice(saved.message);
  if(saved.ok){$("ruleMerchant").value="";$("ruleCategory").value="";$("ruleMerchant").focus()}
 });
 $("clearRules").addEventListener("click",()=>{
  personalRules=Object.create(null);const saved=savePersonal();showRules();
  ruleNotice(saved?"Toutes les associations ont été effacées.":"Associations effacées de la session ; mémoire locale indisponible.");
 });
 const reviewEditor=globalThis.SmartBudgetReviewEditor;
 function reviewButton(label,classes="sb-assistant-secondary"){const b=document.createElement("button");b.type="button";b.className=classes;b.textContent=label;return b}
 function reviewRow(label,cents,klass=""){const line=document.createElement("div");line.className="pilot-review-total";const name=document.createElement("span"),amount=document.createElement("strong");name.textContent=label;amount.textContent=euro(cents);amount.className=klass;line.append(name,amount);return line}
 function reviewForm(parent,fields,onSave,onCancel){
  const panel=document.createElement("form");panel.className="pilot-operation-editor";const controls=Object.create(null);
  for(const field of fields){
   const label=document.createElement("label");label.className="pilot-editor-field"+(field.wide?" pilot-editor-wide":"");const title=document.createElement("span");title.textContent=field.label;
   let el;
   if(field.options){el=document.createElement("select");for(const option of field.options){const opt=document.createElement("option");opt.value=option.value;opt.textContent=option.name;el.append(opt)}}
   else{el=document.createElement("input");el.type=field.type||"text";if(field.maxLength)el.maxLength=field.maxLength;if(field.money)el.inputMode="decimal";if(field.min)el.min=field.min;if(field.max)el.max=field.max;}
   el.value=field.value??"";if(field.required)el.required=true;if(field.disabled)el.disabled=true;
   label.append(title,el);panel.append(label);controls[field.key]=el;
  }
  const notice=document.createElement("p");notice.className="pilot-editor-notice pilot-editor-wide";notice.setAttribute("role","status");panel.append(notice);
  const actions=document.createElement("div");actions.className="pilot-editor-actions pilot-editor-wide";
  const cancel=reviewButton("Annuler"),save=reviewButton("Appliquer","sb-assistant-send");save.type="submit";actions.append(cancel,save);panel.append(actions);parent.append(panel);
  let saving=false;
  cancel.addEventListener("click",()=>{if(!saving)onCancel()});
  panel.addEventListener("submit",async e=>{
   e.preventDefault();if(saving)return;
   const values=Object.fromEntries(Object.entries(controls).map(([k,el])=>[k,el.value]));
   saving=true;save.disabled=cancel.disabled=true;notice.textContent="";
   const previouslyDisabled=Object.values(controls).map(el=>el.disabled);Object.values(controls).forEach(el=>el.disabled=true);
   try{const error=await onSave(values,notice);if(error)notice.textContent=error}
   catch{notice.textContent="Modification non appliquée. Réessaie."}
   finally{saving=false;save.disabled=cancel.disabled=false;Object.values(controls).forEach((el,i)=>el.disabled=previouslyDisabled[i])}
  });
  return {controls,notice};
 }
 // Read-only lookup, scoped to the signed-in pilot household; no AI and no writes.
 async function readEditedBudget(op){
  if(!session||!op.categoryId||!core.validDate(op.date))return null;
  const {token,householdId}=session,month=op.date.slice(0,7)+"-01";
  const query="/rest/v1/categories?select=id,legacy_id&household_id=eq."+encodeURIComponent(householdId)+"&archived_at=is.null&limit=301";
  const cats=await json(query,{method:"GET",headers:headers(token)});
  if(session?.token!==token||session.householdId!==householdId||!cats.ok||!Array.isArray(cats.body)||cats.body.length>300)return null;
  const found=cats.body.filter(c=>(c.legacy_id||c.id)===op.categoryId);
  if(found.length!==1||typeof found[0].id!=="string")return null;
  const path="/rest/v1/budgets?select=month,planned_amount,scope&household_id=eq."+encodeURIComponent(householdId)+"&category_id=eq."+encodeURIComponent(found[0].id)+"&archived_at=is.null&month=lte."+encodeURIComponent(month)+"&order=month.desc&limit=301";
  const rows=await json(path,{method:"GET",headers:headers(token)});
  if(session?.token!==token||session.householdId!==householdId||!rows.ok||!Array.isArray(rows.body)||rows.body.length>300)return null;
  const before=core.readBudgetCents(rows.body,month.slice(0,7));
  return Number.isSafeInteger(before)&&before>=0?{key:reviewEditor.key(op),beforeCents:before}:null;
 }
 function renderCategoryDraft(v,ctx){
  const draft={...v};pendingReview=draft;let editing=false,locked=false;
  const group=document.createElement("div");group.className="pilot-review";result.append(group);
  function active(){return !busy&&pendingReview===draft&&!locked}
  function draw(){
   group.replaceChildren();const heading=document.createElement("strong");heading.textContent=draft.name;heading.className="pilot-category-heading";group.append(heading);
   const note=document.createElement("p");note.className="pilot-op-meta";note.textContent="Nouvelle catégorie de dépenses · "+draft.month;group.append(note);
   if(draft.budgetCents!==null)group.append(reviewRow("Budget prévu",draft.budgetCents,"pilot-plan"));
   if(draft.expenseCents!==null)group.append(reviewRow("Dépense à enregistrer",draft.expenseCents,"pilot-negative"));
   if(draft.budgetCents!==null&&draft.expenseCents!==null){
    if(draft.budgetCents>0){const bar=document.createElement("div");bar.className="pilot-category-progress";const used=document.createElement("span");used.style.width=Math.min(100,draft.expenseCents/draft.budgetCents*100)+"%";bar.append(used);group.append(bar)}
    const remain=draft.budgetCents-draft.expenseCents;group.append(reviewRow("Budget restant",remain,remain>=0?"pilot-positive":"pilot-negative"));
   }
   if(!locked){
    if(editing){
     reviewForm(group,[{key:"name",label:"Nom de la catégorie",value:draft.name,wide:true,maxLength:60,required:true},
      {key:"budget",label:"Budget (€)",money:true,value:reviewEditor.money(draft.budgetCents)},
      {key:"expense",label:"Dépense (€)",money:true,value:reviewEditor.money(draft.expenseCents)},
      {key:"month",label:"Mois du budget",type:"month",value:draft.month,min:ctx.firstMonth,max:ctx.lastMonth,required:true,wide:true}],
      fields=>{if(!active())return "Proposition périmée.";const checked=reviewEditor.categoryFromFields(draft,fields,ctx);if(!checked.ok)return checked.error;Object.assign(draft,checked.value);history=[];editing=false;draw();return null},
      ()=>{editing=false;draw()});
    }else{const edit=reviewButton("Modifier","pilot-link");edit.addEventListener("click",()=>{if(active()){editing=true;draw()}});group.append(edit)}
   }
   const safe=document.createElement("p");safe.className="pilot-op-meta";safe.textContent=locked?"Confirmé en simulation. Aucune écriture Supabase.":"Création, budget et dépense : confirmation groupée de test uniquement.";group.append(safe);
   const actions=document.createElement("div");actions.className="pilot-review-actions";const cancel=reviewButton("Annuler"),ok=reviewButton("Confirmer","sb-assistant-send");
   cancel.disabled=locked;ok.disabled=locked||editing||!core.validateCategoryDraft(draft,ctx).ok;
   cancel.addEventListener("click",()=>{if(active()){wipe();status.textContent="Brouillon annulé."}});
   ok.addEventListener("click",()=>{if(!active()||ok.disabled||!core.validateCategoryDraft(draft,ctx).ok)return;locked=true;pendingReview=null;history=[];status.dataset.source="";status.textContent="Confirmation réussie · aucun appel IA supplémentaire.";draw()});
   actions.append(cancel,ok);group.append(actions);
  }
  draw();
 }
 function renderCategoryReport(r){
  const amounts=[r.plannedCents,r.actualCents,r.remainingCents,r.recurringCents];if(!amounts.every(Number.isSafeInteger))return false;
  const group=document.createElement("div");group.className="pilot-review";
  const heading=document.createElement("strong");heading.className="pilot-category-heading";heading.textContent=r.name;
  const subtitle=document.createElement("p");subtitle.className="pilot-op-meta";subtitle.textContent=new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(r.month+"-01T12:00:00Z"));
  group.append(heading,subtitle);
  for(const [label,value,cls] of [["Budget prévu",r.plannedCents,"pilot-plan"],["Dépenses réelles",r.actualCents,"pilot-negative"],["Reste sur le budget",r.remainingCents,r.remainingCents>=0?"pilot-positive":"pilot-negative"]]){const line=document.createElement("div");line.className="pilot-review-total";const n=document.createElement("span"),a=document.createElement("strong");n.textContent=label;a.textContent=euro(value);a.className=cls;line.append(n,a);group.append(line)}
  const note=document.createElement("p");note.className="pilot-op-meta";note.textContent="Données enregistrées du foyer de test"+(r.recurringCents?" · dont récurrences : "+euro(r.recurringCents):"")+". Pas de modification ni de vérification bancaire.";group.append(note);result.append(group);return true;
 }
 function renderDraft(v,ctx,previews,suggestions){
  ruleContext=ctx;showRules();
  const review=JSON.parse(JSON.stringify(v));pendingReview=review;let editing=-1,locked=false;
  const entries=review.operations.map((o,i)=>{
   const original=o.categoryId,personal=core.classifyCategory(o,ctx,{overrides:personalRules});
   const remembered=ruleUtils.resolve(o,ctx.categories,personalRules);
   if(remembered)o.categoryId=remembered.categoryId;
   else if(o.kind!=="plan"&&personal.source==="personal")o.categoryId=personal.categoryId;
   const suggestion=suggestions.find(s=>s.index===i),rule=core.draftCategorySuggestion(o,ctx,remembered?.ruleKey||suggestion?.ruleKey);
   const p=previews.find(x=>x.index===i),baseline=o.kind==="plan"&&original===o.categoryId&&o.categoryId&&Number.isSafeInteger(p?.beforeCents)&&p.beforeCents>=0?{key:reviewEditor.key(o),beforeCents:p.beforeCents}:null;
   return {op:o,ruleKey:rule?.key||null,baseline};
  });
  const iconPaths={cart:"M3 3h2l3 12h11l3-8H6M9 20h.01M18 20h.01",food:"M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-3 0-5 3-5 6v4h5M20 3v18",home:"M3 10l9-7 9 7v10H3zM9 20v-6h6v6",game:"M7 7h10c3 0 5 3 5 7 0 2-1 3-3 3l-4-3H9l-4 3c-2 0-3-1-3-3 0-4 2-7 5-7zM7 9v4M5 11h4M16 10h.01M19 12h.01",transfer:"M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4",income:"M5 5l14 14M5 5v9M5 5h9",card:"M3 5h18v14H3zM3 10h18M6 15h4",fuel:"M4 21V3h10v18M4 11h10M14 13h2l2 3h2V7l-3-3",car:"M4 16l2-8h12l2 8v3H4zM4 16h16M7 19v2M17 19v2",health:"M12 3v18M3 12h18",shirt:"M8 3l4 3 4-3 5 4-4 4v10H7V11L3 7z",gift:"M3 9h18v12H3zM12 9v12M2 5h20v4H2zM12 5C5-3 2 6 12 5c10 1 7-8 0 0",saving:"M12 3l8 5v5c0 5-3 8-8 9-5-1-8-4-8-9V8zM9 13l2 2 4-4"};
  function icon(key){const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg"),path=document.createElementNS(ns,"path");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");path.setAttribute("d",iconPaths[key]||iconPaths.card);svg.append(path);return svg}

  const group=document.createElement("div");group.className="pilot-review";result.append(group);
  function active(){return !busy&&pendingReview===review&&!locked}
  function sync(){review.operations=entries.map(e=>e.op);history=[]}
  function renderEdit(card,entry,i){
   const o=entry.op,parts=o.kind==="expense"?core.expenseLabelParts(o.label):{merchant:o.label,detail:null};
   const options=(op)=>[{value:"",name:"Choisir une catégorie"},...reviewEditor.choices(op,ctx)];
   const fields=[
    {key:"name",label:o.kind==="expense"?"Magasin / nom":"Nom",value:parts.merchant,wide:true,maxLength:120,required:true},
    ...(o.kind==="expense"?[{key:"detail",label:"Libellé (facultatif)",value:parts.detail||"",wide:true,maxLength:120}]:[]),
    {key:"amount",label:o.kind==="plan"&&o.planMode!=="set"?"Montant de la variation (€)":"Montant (€)",value:reviewEditor.money(o.amountCents),money:true,required:true},
    {key:"date",label:o.kind==="plan"?"Mois du budget":"Date",type:o.kind==="plan"?"month":"date",value:o.kind==="plan"?o.date.slice(0,7):o.date,required:true,
     min:o.kind==="plan"?ctx.firstMonth:ctx.firstMonth+"-01",max:o.kind==="plan"?ctx.lastMonth:ctx.lastMonth+"-31"},
    {key:"category",label:"Catégorie",value:reviewEditor.selected(entry),options:options(o),wide:true,required:true},
    ...(o.kind==="plan"?[{key:"planMode",label:"Type de modification",value:o.planMode||"set",options:[{value:"set",name:"Fixer"},{value:"increase",name:"Augmenter"},{value:"decrease",name:"Diminuer"}],wide:true}]:[
     {key:"owner",label:"Payeur / bénéficiaire",value:o.owner,options:(ctx.solo?["B"]:["B","A","common"]).map(value=>({value,name:ctx.members?.[value]||(value==="common"?"À deux":value)})),disabled:ctx.solo}]),
    {key:"frequency",label:o.kind==="plan"?"Période":"Fréquence",value:o.frequency,options:[{value:"once",name:o.kind==="plan"?"Ce mois uniquement":"Unique"},...(o.kind==="saving"?[]:[{value:"monthly",name:o.kind==="plan"?"À partir de ce mois":"Mensuelle"}])],disabled:o.kind==="saving"}
   ];
   const {controls,notice}=reviewForm(card,fields,async values=>{
    if(!active()||editing!==i)return "Proposition périmée.";
    if(o.kind==="plan")values.date=values.date+"-01";
    const checked=reviewEditor.fromFields(entry,values,ctx);if(!checked.ok)return checked.error;
    const next=checked.entry;
    if(next.op.kind==="plan"&&next.op.categoryId&&!next.baseline){
     notice.textContent="Lecture du budget actuel…";
     next.baseline=await readEditedBudget(next.op);
     if(!active()||editing!==i)return "Proposition périmée.";
     if(!next.baseline)return "Impossible de lire ce budget. Aucune modification appliquée.";
    }
    if(next.op.kind==="plan"&&!reviewEditor.planPreview(next))return "Variation impossible pour ce budget.";
    entries[i]=next;sync();editing=-1;draw();return null;
   },()=>{if(active()){editing=-1;draw()}});
   function updateCategories(){
    const before=controls.category.value,op={...o,date:o.kind==="plan"?controls.date.value+"-01":controls.date.value};
    const opts=options(op);controls.category.replaceChildren();
    for(const option of opts){const el=document.createElement("option");el.value=option.value;el.textContent=option.name;controls.category.append(el)}
    controls.category.value=opts.some(p=>p.value===before)?before:"";showLivePlan();
   }
   function showLivePlan(){
    if(o.kind!=="plan")return;
    const date=controls.date.value+"-01",target=controls.category.value,amountCents=reviewEditor.cents(controls.amount.value);
    const previewOp={...o,date,categoryId:target.startsWith("id:")?target.slice(3):null,amountCents,planMode:controls.planMode.value};
    const candidate={op:previewOp,ruleKey:target.startsWith("rule:")?target.slice(5):null,baseline:entry.baseline};
    const preview=reviewEditor.planPreview(candidate);
    notice.textContent=preview?euro(preview.beforeCents)+" → "+euro(preview.afterCents):"Le total sera recalculé à l’application.";
   }
   controls.date.addEventListener("change",updateCategories);
   if(o.kind==="plan"){for(const field of ["category","amount","planMode"])controls[field].addEventListener("input",showLivePlan);showLivePlan()}
  }
  function draw(){
   group.replaceChildren();
   for(const [i,entry] of entries.entries()){
    const o=entry.op,rule=core.draftCategorySuggestion(o,ctx,entry.ruleKey),category=ctx.categories.find(c=>c.id===o.categoryId);
    const guessed=core.classifyCategory(o,ctx).ruleKey;
    const card=document.createElement("div");card.className="pilot-op";
    const top=document.createElement("div");top.className="pilot-op-top";const iconBox=document.createElement("div");iconBox.className="pilot-op-icon";iconBox.append(icon(rule?.icon||core.categoryRules.find(r=>r.key===guessed)?.icon||(o.kind==="income"?"income":o.kind==="saving"?"saving":o.kind==="plan"?"home":"card")));
    const info=document.createElement("div");info.className="pilot-op-info";const name=document.createElement("strong");const parts=o.kind==="expense"?core.expenseLabelParts(o.label):{merchant:o.label,detail:null};name.textContent=parts.merchant;info.append(name);
    if(parts.detail){const detailLabel=document.createElement("div");detailLabel.className="pilot-expense-detail";detailLabel.textContent="Libellé : "+parts.detail;info.append(detailLabel)}
    const sub=document.createElement("div");sub.className="pilot-op-meta";sub.textContent=(ctx.members[o.owner]||"À deux")+" · "+(category?.name||rule?.name||"Catégorie à choisir");if(rule){const tag=document.createElement("span");tag.className="pilot-new";tag.textContent=" · Nouvelle";sub.append(tag)}info.append(sub);
    const amount=document.createElement("strong");amount.className="pilot-op-money "+(o.kind==="income"?"pilot-positive":o.kind==="saving"?"pilot-plan":o.kind==="plan"?"pilot-plan":"pilot-negative");
    const base=reviewEditor.planPreview(entry);
    if(o.kind==="plan"&&base){const prev=document.createElement("span");prev.className="pilot-old-amount";prev.textContent=euro(base.beforeCents);amount.append(prev,document.createTextNode(" → "+euro(base.afterCents)));const delta=base.afterCents-base.beforeCents,change=document.createElement("span");change.className="pilot-budget-delta "+(delta>0?"pilot-positive":delta<0?"pilot-negative":"");change.textContent=(delta>0?"+":delta<0?"−":"")+euro(Math.abs(delta));amount.append(change)}
    else amount.textContent=(o.kind==="income"||o.kind==="saving"?"+":o.kind==="plan"?(o.planMode==="decrease"?"−":o.planMode==="increase"?"+":""):"−")+euro(o.amountCents);
    top.append(iconBox,info,amount);card.append(top);
    const detail=document.createElement("div");detail.className="pilot-op-detail";detail.textContent=o.date+(o.frequency==="monthly"?" · Mensuel":"")+(o.kind==="saving"?" · Transfert vers l’épargne, pas une dépense":"");card.append(detail);
    if(!locked){
     if(editing===i)renderEdit(card,entry,i);
     else{
      const edit=reviewButton("Modifier","pilot-link");edit.disabled=editing!==-1;edit.addEventListener("click",()=>{if(active()&&editing===-1){editing=i;draw()}});const actions=document.createElement("div");actions.className="pilot-op-controls";actions.append(edit);
      if(entries.length>1){const remove=reviewButton("Retirer","pilot-link pilot-remove");remove.disabled=editing!==-1;remove.addEventListener("click",()=>{if(active()&&editing===-1&&entries.length>1){entries.splice(i,1);sync();draw()}});actions.append(remove)}card.append(actions);
     }
    }
    group.append(card);
   }
   const totals=reviewEditor.totals(entries);
   if(entries.length>1&&(totals.income||totals.expense))group.append(reviewRow("Net revenus / dépenses · hors épargne",totals.net,totals.net>=0?"pilot-positive":"pilot-negative"));
   if(totals.saving>0){group.append(reviewRow("Transféré vers l’épargne · pas une dépense",totals.saving,"pilot-plan"));group.append(reviewRow("Variation du solde disponible",totals.available,totals.available>=0?"pilot-positive":"pilot-negative"))}
   const checked=reviewEditor.validate(entries,ctx),count=new Set(entries.filter(e=>e.op.categoryId===null&&e.ruleKey).map(e=>e.ruleKey)).size;
   const note=document.createElement("p");note.className="pilot-op-meta";note.textContent=locked?"Confirmé en simulation. Aucune catégorie ou opération créée dans Supabase.":editing!==-1?"Applique ou annule la modification avant de confirmer.":!checked.ok?checked.error:(count?count+" catégorie(s) à créer · ":"")+"Confirmation de test, aucune écriture Supabase.";group.append(note);
   const actions=document.createElement("div");actions.className="pilot-review-actions";const cancel=reviewButton("Annuler"),ok=reviewButton(entries.length===1?"Confirmer":"Confirmer les "+entries.length+" opérations","sb-assistant-send");
   cancel.disabled=locked;ok.disabled=locked||editing!==-1||!checked.ok;
   cancel.addEventListener("click",()=>{if(active()){wipe();status.textContent="Brouillon annulé."}});
   ok.addEventListener("click",()=>{if(!active()||ok.disabled||!reviewEditor.validate(entries,ctx).ok)return;locked=true;pendingReview=null;history=[];status.dataset.source="";status.textContent="Confirmation réussie · aucun appel IA supplémentaire.";draw()});
   actions.append(cancel,ok);group.append(actions);
  }
  draw();
 }
 function wipe(){pendingReview=null;history=[];$("pilotSubmitted").hidden=true;$("pilotSubmittedText").textContent="";result.replaceChildren();input.value="";resizeComposer();$("cancel").hidden=true;voice.stop({discard:true})}
 function logout(){epoch++;usageRequest++;session=null;ruleContext=null;personalRules=Object.create(null);showRules();ruleNotice("");busy=false;send.disabled=false;wipe();resetMeter();$("pilotAssistant").hidden=true;$("pilotSession").hidden=true;$("pilotLogin").hidden=false;$("pilotPassword").value="";$("pilotLoginStatus").textContent="Session terminée."}
 function headers(token){return {apikey:PILOT_PUBLIC_KEY,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})}}
 async function json(path,options){const r=await fetch(PILOT_URL+path,{...options,cache:"no-store",signal:AbortSignal.timeout(45000)});let b;try{b=await r.json()}catch{b={}}return {ok:r.ok,status:r.status,body:b}}
 const number=n=>new Intl.NumberFormat("fr-FR").format(n);
 function resetMeter(){$("pilotQuotaBar").value=0;$("pilotQuotaText").textContent="— / 8 000";$("pilotRequests").textContent="— demandes IA";$("pilotQuotaRemaining").textContent="Quota UTC";$("pilotLastUsage").textContent="Dernier prompt : —"}
 function displayQuota(quota){
  if(!quota||!Number.isSafeInteger(quota.units)||quota.units<0||quota.units>8000||!Number.isSafeInteger(quota.requests)||quota.requests<0||quota.requests>100)return false;
  $("pilotQuotaBar").value=quota.units;$("pilotQuotaText").textContent=number(quota.units)+" / 8 000";
  $("pilotRequests").textContent=number(quota.requests)+" appel"+(quota.requests===1?"":"s")+" IA aujourd’hui";
  $("pilotQuotaRemaining").textContent=number(8000-quota.units)+" restants · UTC";return true;
 }
 function displayLastMeter(metering){
  const label=$("pilotLastUsage");if(!metering)return;
  if(metering.source==="local-rules"){label.textContent="Dernier prompt : 0 token IA · 0 neurone";return}
  if(metering.source!=="cloudflare")return;
  const usage=metering.tokens,reserved=metering.reservedNeurons;
  const neurons=Number.isSafeInteger(reserved)&&reserved>=0?" · "+number(reserved)+" neurones réservés (estim.)":"";
  if(usage&&Number.isSafeInteger(usage.total)&&usage.total>=0&&Number.isSafeInteger(usage.input)&&Number.isSafeInteger(usage.output)){
   label.textContent="Dernier prompt : "+number(usage.total)+" tokens ("+number(usage.input)+" entrée, "+number(usage.output)+" sortie)"+neurons;
  }else label.textContent="Dernier prompt : tokens non fournis par Cloudflare"+neurons;
 }
 async function refreshQuota(){
  if(!session)return;const current=++usageRequest,token=session.token,householdId=session.householdId;
  try{const r=await json("/functions/v1/smart-assistant",{method:"POST",headers:headers(token),body:JSON.stringify({householdId,action:"usage"})});
   if(current!==usageRequest||!session||session.token!==token)return;
   if(!r.ok||!displayQuota(r.body.quota))$("pilotQuotaText").textContent="Quota indisponible";
  }catch{if(current===usageRequest&&session?.token===token)$("pilotQuotaText").textContent="Quota indisponible"}
 }

 $("pilotLoginForm").addEventListener("submit",async e=>{
  e.preventDefault();if($("pilotSignIn").disabled)return;
  const pw=$("pilotPassword").value;$("pilotPassword").value="";$("pilotSignIn").disabled=true;$("pilotLoginStatus").textContent="Connexion…";
  try{
   const a=await json("/auth/v1/token?grant_type=password",{method:"POST",headers:headers(),body:JSON.stringify({email:"testtest@id.budget-foyer.example.com",password:pw})});
   if(!a.ok||!a.body.access_token||!a.body.user?.id)throw Error("Connexion au compte de test impossible.");
   const t=a.body.access_token,u=a.body.user.id;if(!/^[a-f0-9-]{36}$/i.test(u))throw Error("Session invalide.");
   const m=await json("/rest/v1/household_members?select=household_id,slot&user_id=eq."+encodeURIComponent(u)+"&limit=2",{headers:headers(t)});
   if(!m.ok||!Array.isArray(m.body)||m.body.length!==1||m.body[0].slot!=="B")throw Error("Le compte de test doit disposer d’un foyer isolé.");
   session={token:t,householdId:m.body[0].household_id};resetMeter();readPersonal();showRules();epoch++;wipe();$("pilotLogin").hidden=true;$("pilotSession").hidden=false;$("pilotAssistant").hidden=false;status.textContent="";void refreshQuota();void loadRuleCategories();
  }catch(e){$("pilotLoginStatus").textContent=e.message||"Connexion impossible."}
  finally{$("pilotSignIn").disabled=false}
 });
 $("pilotLogout").addEventListener("click",logout);
 $("cancel").addEventListener("click",()=>{epoch++;busy=false;send.disabled=false;wipe();status.textContent="Nouvelle demande."});
 document.querySelectorAll("[data-assistant-suggestion]").forEach(b=>b.addEventListener("click",()=>{voice.stop({discard:true});input.value=b.dataset.assistantSuggestion;resizeComposer();input.focus()}));
 input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}});
 
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!session||busy)return;voice.stop();
  const command=input.value.trim();if(!command)return;
  pendingReview=null;status.dataset.source="";result.replaceChildren();$("pilotSubmittedText").textContent=command;$("pilotSubmitted").hidden=false;const current=++epoch;busy=true;send.disabled=true;status.textContent="Analyse de ta demande…";
  try{const r=await json("/functions/v1/smart-assistant",{method:"POST",headers:headers(session.token),body:JSON.stringify({householdId:session.householdId,command,context:{},...(history.length?{history}:{})})});
   if(current!==epoch)return;
   if(r.body.metering)displayLastMeter(r.body.metering);
   void refreshQuota();
   if(r.status===401){logout();$("pilotLoginStatus").textContent="Session expirée. Reconnecte-toi.";return}
   if(!r.ok){status.textContent=errorMessages[r.body.error]||"Erreur de la passerelle IA ("+r.status+").";return}
   const ctx=r.body.context,checked=r.body.result?.kind==="categoryDraft"?core.validateCategoryDraft(r.body.result,ctx):r.body.result?.kind==="draft"?core.validateReview(r.body.result,ctx):core.validateResult(r.body.result,ctx);if(!checked.ok){status.textContent="Brouillon refusé : "+checked.error;return;}
   pendingReview=null;result.replaceChildren();input.value="";resizeComposer();const v=checked.value;
   if(v.kind==="categoryDraft"){renderCategoryDraft(v,ctx)}
   else if(v.kind==="draft"){renderDraft(v,ctx,r.body.planPreviews||[],r.body.categorySuggestions||[]);}
   else if(v.kind==="query"&&r.body.categoryReport&&renderCategoryReport(r.body.categoryReport)){}
   else if(v.kind==="query"){append(queries[v.query]+" · "+v.month+(v.compareMonth?" / "+v.compareMonth:"")+(v.categoryId?" · "+(ctx.categories.find(c=>c.id===v.categoryId)?.name||"Catégorie"):""));append("Consultation comprise. Calcul à raccorder à l’application complète.");}
   else append(v.message);
   history=["draft","clarify"].includes(v.kind)?[...history,{command,result:v}].slice(-2):[];$("cancel").hidden=false;
   const local=r.body.metering?.source==="local-rules";
   status.dataset.source=local?"smart-engine":"gemma";
   const tokenCount=r.body.metering?.tokens?.total;
   status.textContent=local?"Smart Engine · 0 token IA":("Gemma 4 · "+(Number.isSafeInteger(tokenCount)?new Intl.NumberFormat("fr-FR").format(tokenCount)+" tokens":"tokens non disponibles"));
  }catch{if(current===epoch){status.textContent="Communication interrompue. Réessaie sans envoi automatique.";void refreshQuota()}}
  finally{if(current===epoch){busy=false;send.disabled=false}}
 });
})();