(()=>{"use strict";
 const $=id=>document.getElementById(id),input=$("sbAssistantInput"),status=$("sbAssistantStatus"),result=$("sbAssistantResult"),consent=$("pilotConsent"),form=$("sbAssistantForm"),send=$("send");
 const core=globalThis.SmartBudgetAssistantCore;
 let session=null,history=[],epoch=0,busy=false,pendingReview=null;
 const euro=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n/100);
 const kinds={expense:"Dépense",income:"Revenu",saving:"Épargne",plan:"Budget prévu"};
 const queries={summary:"Résumé",categories:"Catégories",transactions:"Transactions",comparison:"Comparaison"};
 const errorMessages={assistant_not_enabled:"Assistant non activé côté serveur. Vérifie les secrets d’activation.",authentication_required:"Reconnecte-toi.",household_not_authorized:"Ce foyer n’est pas autorisé pour le pilote.",authorization_unavailable:"Vérification du foyer indisponible.",quota_exhausted:"Quota de test atteint. Réessaie demain (UTC).",quota_unavailable:"Compteur indisponible : aucune demande IA envoyée.",context_too_large:"Demande trop volumineuse.",invalid_history:"Brouillon périmé. Commence une nouvelle demande.",invalid_model_result:"Réponse du modèle refusée par le validateur.",model_unavailable_or_invalid:"Le modèle n’a pas fourni une réponse exploitable."};
 const voice=globalThis.SmartBudgetAssistantVoice.bind({input,button:$("mic"),status,clock:document.querySelector(".sb-voice-clock"),authorize:()=>window.confirm("Autoriser la dictée du navigateur ? Utilise uniquement des données fictives.")});
 function append(v){const line=document.createElement("div");line.className="sb-assistant-result-row";line.textContent=v;result.append(line)}
 let ruleContext=null,personalRules=Object.create(null);
 const ruleStorageKey=()=>session?"smart-budget-v31-test-category-rules:"+session.householdId:null;
 function readPersonal(){try{const raw=localStorage.getItem(ruleStorageKey());const parsed=JSON.parse(raw||"null");if(!parsed||parsed.enabled!==true||!Array.isArray(parsed.rules))return; $("rememberRules").checked=true;for(const [label,id] of parsed.rules.slice(0,200)){if(typeof label==="string"&&label.length<=80&&typeof id==="string"&&id.length<=120)personalRules[label]=id}}catch{}}
 function savePersonal(){try{const key=ruleStorageKey();if(!key)return;if($("rememberRules").checked)localStorage.setItem(key,JSON.stringify({enabled:true,rules:Object.entries(personalRules).slice(0,200)}));else localStorage.removeItem(key)}catch{}}
 function setPersonal(label,id){const normalized=core.normalizeCategory(label);if(!normalized||normalized.length>80||!ruleContext?.categories.some(c=>c.id===id))return; if(Object.keys(personalRules).length>=200&&!Object.hasOwn(personalRules,normalized))return;personalRules[normalized]=id;savePersonal();showRules()}
 function showRules(){
  const list=$("rulePersonal"),def=$("ruleDefault"),sel=$("ruleCategory");list.replaceChildren();def.replaceChildren();sel.replaceChildren();
  const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Choisir une catégorie";sel.append(placeholder);
  for(const c of ruleContext?.categories||[]){const opt=document.createElement("option");opt.value=c.id;opt.textContent=c.name;sel.append(opt)}
  for(const [label,id] of Object.entries(personalRules)){const c=ruleContext?.categories.find(x=>x.id===id);const row=document.createElement("div");row.className="pilot-rule-row";const text=document.createElement("span");text.textContent=label+" → "+(c?.name||"Catégorie indisponible");const del=document.createElement("button");del.type="button";del.className="pilot-link";del.textContent="Supprimer";del.addEventListener("click",()=>{delete personalRules[label];savePersonal();showRules()});row.append(text,del);list.append(row)}
  for(const r of core.categoryRules){const row=document.createElement("div");row.className="pilot-rule-row";const name=document.createElement("strong"),example=document.createElement("span");name.textContent=r.name;example.textContent=r.terms.slice(0,7).join(", ");row.append(name,example);def.append(row)}
 }
 $("rememberRules").addEventListener("change",savePersonal);
 $("addRule").addEventListener("click",()=>{const label=$("ruleMerchant").value.trim(),id=$("ruleCategory").value;if(label&&id){setPersonal(label,id);$("ruleMerchant").value=""}});
 $("clearRules").addEventListener("click",()=>{personalRules=Object.create(null);savePersonal();showRules()});
 function renderDraft(v,ctx,previews,suggestions){
  ruleContext=ctx;showRules();
  const review=JSON.parse(JSON.stringify(v));pendingReview=review;
  const newRules=new Map(),changes=new Map(),cards=[];
  const iconPaths={cart:"M3 3h2l3 12h11l3-8H6M9 20h.01M18 20h.01",food:"M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-3 0-5 3-5 6v4h5M20 3v18",home:"M3 10l9-7 9 7v10H3zM9 20v-6h6v6",game:"M7 7h10c3 0 5 3 5 7 0 2-1 3-3 3l-4-3H9l-4 3c-2 0-3-1-3-3 0-4 2-7 5-7zM7 9v4M5 11h4M16 10h.01M19 12h.01",transfer:"M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4",income:"M5 5l14 14M5 5v9M5 5h9",card:"M3 5h18v14H3zM3 10h18M6 15h4",fuel:"M4 21V3h10v18M4 11h10M14 13h2l2 3h2V7l-3-3",car:"M4 16l2-8h12l2 8v3H4zM4 16h16M7 19v2M17 19v2",health:"M12 3v18M3 12h18",shirt:"M8 3l4 3 4-3 5 4-4 4v10H7V11L3 7z",gift:"M3 9h18v12H3zM12 9v12M2 5h20v4H2zM12 5C5-3 2 6 12 5c10 1 7-8 0 0"};
  function icon(key){const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg"),path=document.createElementNS(ns,"path");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");path.setAttribute("d",iconPaths[key]||iconPaths.card);svg.append(path);return svg}
  const group=document.createElement("div");group.className="pilot-review";
  for(const [i,o] of review.operations.entries()){
   const original=o.categoryId,personal=core.classifyCategory(o,ctx,{overrides:personalRules});
   if(o.kind!=="plan"&&personal.source==="personal")o.categoryId=personal.categoryId;
   const suggestion=suggestions.find(s=>s.index===i),rule=core.draftCategorySuggestion(o,ctx,suggestion?.ruleKey);
   if(rule)newRules.set(i,rule);
   const p=previews.find(x=>x.index===i),oldLabel=core.normalizeCategory(o.label);
   const card=document.createElement("div");card.className="pilot-op";
   const top=document.createElement("div");top.className="pilot-op-top";
   const iconBox=document.createElement("div");iconBox.className="pilot-op-icon";
   const category=ctx.categories.find(c=>c.id===o.categoryId);
   const guessed=personal.ruleKey&&core.categoryRules.find(r=>r.key===personal.ruleKey);
   iconBox.append(icon(rule?.icon||guessed?.icon||(o.kind==="income"?"income":o.kind==="plan"?"home":"card")));
   const info=document.createElement("div");info.className="pilot-op-info";
   const name=document.createElement("strong");name.textContent=o.label;
   const sub=document.createElement("div");sub.className="pilot-op-meta";
   const catLabel=document.createElement("span");
   sub.textContent=(ctx.members[o.owner]||"À deux")+" · ";sub.append(catLabel);
   info.append(name,sub);const amount=document.createElement("strong");
   amount.className="pilot-op-money "+(o.kind==="income"?"pilot-positive":o.kind==="plan"?"pilot-plan":"pilot-negative");
   top.append(iconBox,info,amount);card.append(top);
   const detail=document.createElement("div");detail.className="pilot-op-detail";detail.textContent=o.date+(o.frequency==="monthly"?" · Mensuel":"");
   card.append(detail);
   const choose=document.createElement("select");choose.setAttribute("aria-label","Catégorie de "+o.label);choose.className="pilot-category-select";
   const missing=document.createElement("option");missing.value="";missing.textContent="Choisir une catégorie";choose.append(missing);
   for(const c of core.availableCategories(o,ctx)){const opt=document.createElement("option");opt.value=c.id;opt.textContent=c.name;choose.append(opt)}
   if(rule){const n=document.createElement("option");n.value="__new";n.textContent="Créer "+rule.name;choose.append(n)}
   choose.value=o.categoryId||(rule?"__new":"");
   const edit=document.createElement("button");edit.type="button";edit.className="pilot-link";edit.textContent="Modifier";choose.hidden=!!choose.value;
   const editing=document.createElement("div");editing.className="pilot-edit-row";editing.append(edit,choose);card.append(editing);
   if(o.kind==="plan"&&p){edit.hidden=true;choose.disabled=true}
   else edit.addEventListener("click",()=>{choose.hidden=!choose.hidden;if(!choose.hidden)choose.focus()});
   if(o.kind==="plan"&&!p&&!rule){const note=document.createElement("p");note.className="pilot-op-meta";note.textContent="Montant actuel non chargé. Modification non confirmable.";card.append(note)}
   function paint(){
    const chosen=ctx.categories.find(c=>c.id===o.categoryId),fresh=choose.value==="__new"?rule:null;
    catLabel.textContent=chosen?.name||fresh?.name||"Catégorie à choisir";
    if(fresh){const newTag=document.createElement("span");newTag.className="pilot-new";newTag.textContent=" · Nouvelle";catLabel.append(newTag)}
    const base=o.kind==="plan"?(p&&o.categoryId===original?p:fresh?core.resolvePlanAmount(o,0):null):null;
    amount.replaceChildren();if(o.kind==="plan"&&base){const old=document.createElement("span");old.className="pilot-old-amount";old.textContent=euro(base.beforeCents);amount.append(old,document.createTextNode(" → "+euro(base.afterCents)))}else amount.textContent=(o.kind==="income"?"+":o.kind==="plan"?(o.planMode==="decrease"?"−":o.planMode==="increase"?"+":""):"−")+euro(o.amountCents);
    return o.kind!=="plan"||!!base;
   }
   choose.addEventListener("change",()=>{o.categoryId=choose.value&&choose.value!=="__new"?choose.value:null;if(o.kind==="plan"&&o.categoryId)o.owner=ctx.categories.find(c=>c.id===o.categoryId)?.owner||o.owner;if(o.kind!=="plan"&&o.categoryId&&o.categoryId!==original)changes.set(oldLabel,o.categoryId);else changes.delete(oldLabel);paint();refresh()});
   cards.push({o,choose,rule,paint});paint();group.append(card);
  }
  const net=review.operations.filter(o=>o.kind!=="plan"&&o.frequency==="once").reduce((n,o)=>n+(o.kind==="income"?1:-1)*o.amountCents,0);
  if(review.operations.length>1&&review.operations.some(o=>o.kind!=="plan"&&o.frequency==="once")){const sum=document.createElement("div");sum.className="pilot-review-total";const label=document.createElement("span"),money=document.createElement("strong");label.textContent="Variation du solde · opérations uniques";money.textContent=(net>0?"+":"")+euro(net);sum.append(label,money);group.append(sum)}
  const note=document.createElement("p");note.className="pilot-op-meta";const actions=document.createElement("div");actions.className="pilot-review-actions";
  const cancel=document.createElement("button");cancel.type="button";cancel.className="sb-assistant-secondary";cancel.textContent="Annuler";
  const ok=document.createElement("button");ok.type="button";ok.className="sb-assistant-send";ok.textContent=review.operations.length===1?"Confirmer":"Confirmer les "+review.operations.length+" opérations";
  function refresh(){const missing=cards.some(({o,choose,rule,paint})=>(!o.categoryId&&!(choose.value==="__new"&&rule))||!paint());ok.disabled=missing;const count=new Set(cards.filter(x=>x.choose.value==="__new").map(x=>x.rule?.key)).size;note.textContent=missing?"Complète la proposition sans relancer l’IA.":(count?count+" catégorie(s) à créer · ":"")+"Confirmation de test, aucune écriture Supabase."}
  cancel.addEventListener("click",()=>{if(pendingReview!==review||busy)return;wipe();status.textContent="Brouillon annulé."});
  ok.addEventListener("click",()=>{if(busy||ok.disabled||pendingReview!==review)return;const validated=core.validateReview(review,ctx);if(!validated.ok){status.textContent=validated.error;return}pendingReview=null;history=[];for(const [label,id] of changes)if($("rememberRules").checked)setPersonal(label,id);ok.disabled=true;cancel.disabled=true;for(const x of cards)x.choose.disabled=true;note.textContent="Confirmé en simulation. Aucune catégorie ou opération créée dans Supabase.";status.textContent="Confirmation réussie · aucun appel IA supplémentaire."});
  actions.append(cancel,ok);group.append(note,actions);result.append(group);refresh();
 }
 function wipe(){pendingReview=null;history=[];result.replaceChildren();input.value="";$("cancel").hidden=true;voice.stop({discard:true})}
 function logout(){epoch++;session=null;ruleContext=null;personalRules=Object.create(null);$("rememberRules").checked=false;showRules();busy=false;send.disabled=false;wipe();consent.checked=false;$("pilotAssistant").hidden=true;$("pilotSession").hidden=true;$("pilotLogin").hidden=false;$("pilotPassword").value="";$("pilotLoginStatus").textContent="Session terminée."}
 function headers(token){return {apikey:PILOT_PUBLIC_KEY,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})}}
 async function json(path,options){const r=await fetch(PILOT_URL+path,{...options,cache:"no-store",signal:AbortSignal.timeout(45000)});let b;try{b=await r.json()}catch{b={}}return {ok:r.ok,status:r.status,body:b}}
 $("pilotLoginForm").addEventListener("submit",async e=>{
  e.preventDefault();if($("pilotSignIn").disabled)return;
  const pw=$("pilotPassword").value;$("pilotPassword").value="";$("pilotSignIn").disabled=true;$("pilotLoginStatus").textContent="Connexion…";
  try{
   const a=await json("/auth/v1/token?grant_type=password",{method:"POST",headers:headers(),body:JSON.stringify({email:"testtest@id.budget-foyer.example.com",password:pw})});
   if(!a.ok||!a.body.access_token||!a.body.user?.id)throw Error("Connexion au compte de test impossible.");
   const t=a.body.access_token,u=a.body.user.id;if(!/^[a-f0-9-]{36}$/i.test(u))throw Error("Session invalide.");
   const m=await json("/rest/v1/household_members?select=household_id,slot&user_id=eq."+encodeURIComponent(u)+"&limit=2",{headers:headers(t)});
   if(!m.ok||!Array.isArray(m.body)||m.body.length!==1||m.body[0].slot!=="B")throw Error("Le compte de test doit disposer d’un foyer isolé.");
   session={token:t,householdId:m.body[0].household_id};readPersonal();showRules();epoch++;wipe();$("pilotLogin").hidden=true;$("pilotSession").hidden=false;$("pilotAssistant").hidden=false;status.textContent="Connecté au compte de test. Autorise l’IA, puis saisis une demande.";
  }catch(e){$("pilotLoginStatus").textContent=e.message||"Connexion impossible."}
  finally{$("pilotSignIn").disabled=false}
 });
 $("pilotLogout").addEventListener("click",logout);
 $("cancel").addEventListener("click",()=>{epoch++;busy=false;send.disabled=false;wipe();status.textContent="Nouvelle demande."});
 document.querySelectorAll("[data-assistant-suggestion]").forEach(b=>b.addEventListener("click",()=>{voice.stop({discard:true});input.value=b.dataset.assistantSuggestion;input.focus()}));
 input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}});
 consent.addEventListener("change",()=>{if(!consent.checked){epoch++;busy=false;send.disabled=false;wipe();status.textContent="Autorisation retirée."}});
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!session||busy)return;voice.stop();
  const command=input.value.trim();if(!command)return;if(!consent.checked){status.textContent="Autorise d’abord le traitement par Cloudflare.";return;}
  pendingReview=null;const current=++epoch;busy=true;send.disabled=true;status.textContent="Gemma 4 analyse ta demande…";
  try{const r=await json("/functions/v1/smart-assistant",{method:"POST",headers:headers(session.token),body:JSON.stringify({householdId:session.householdId,command,context:{},...(history.length?{history}:{})})});
   if(current!==epoch)return;
   if(r.status===401){logout();$("pilotLoginStatus").textContent="Session expirée. Reconnecte-toi.";return}
   if(!r.ok){status.textContent=errorMessages[r.body.error]||"Erreur de la passerelle IA ("+r.status+").";return}
   const ctx=r.body.context,checked=r.body.result?.kind==="draft"?core.validateReview(r.body.result,ctx):core.validateResult(r.body.result,ctx);if(!checked.ok){status.textContent="Brouillon refusé : "+checked.error;return;}
   pendingReview=null;result.replaceChildren();input.value="";const v=checked.value;
   if(v.kind==="draft"){renderDraft(v,ctx,r.body.planPreviews||[],r.body.categorySuggestions||[]);}
   else if(v.kind==="query"){append(queries[v.query]+" · "+v.month+(v.compareMonth?" / "+v.compareMonth:"")+(v.categoryId?" · "+(ctx.categories.find(c=>c.id===v.categoryId)?.name||"Catégorie"):""));append("Consultation comprise. Calcul à raccorder à l’application complète.");}
   else append(v.message);
   history=["draft","clarify"].includes(v.kind)?[...history,{command,result:v}].slice(-2):[];$("cancel").hidden=false;
   status.textContent="Réponse IA reçue et validée · "+r.body.model;
  }catch{if(current===epoch)status.textContent="Communication interrompue. Réessaie sans envoi automatique."}
  finally{if(current===epoch){busy=false;send.disabled=false}}
 });
})();