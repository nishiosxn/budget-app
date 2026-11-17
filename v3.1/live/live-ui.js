(()=>{"use strict";
 const $=id=>document.getElementById(id),input=$("sbAssistantInput"),status=$("sbAssistantStatus"),result=$("sbAssistantResult"),consent=$("pilotConsent"),form=$("sbAssistantForm"),send=$("send");
 const core=globalThis.SmartBudgetAssistantCore;
 let session=null,history=[],epoch=0,busy=false;
 const euro=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n/100);
 const kinds={expense:"Dépense",income:"Revenu",saving:"Épargne",plan:"Budget prévu"};
 const queries={summary:"Résumé",categories:"Catégories",transactions:"Transactions",comparison:"Comparaison"};
 const errorMessages={assistant_not_enabled:"Assistant non activé côté serveur. Vérifie les secrets d’activation.",authentication_required:"Reconnecte-toi.",household_not_authorized:"Ce foyer n’est pas autorisé pour le pilote.",authorization_unavailable:"Vérification du foyer indisponible.",quota_exhausted:"Quota de test atteint. Réessaie demain (UTC).",quota_unavailable:"Compteur indisponible : aucune demande IA envoyée.",context_too_large:"Demande trop volumineuse.",invalid_history:"Brouillon périmé. Commence une nouvelle demande.",invalid_model_result:"Réponse du modèle refusée par le validateur.",model_unavailable_or_invalid:"Le modèle n’a pas fourni une réponse exploitable."};
 const voice=globalThis.SmartBudgetAssistantVoice.bind({input,button:$("mic"),status,clock:document.querySelector(".sb-voice-clock"),authorize:()=>window.confirm("Autoriser la dictée du navigateur ? Utilise uniquement des données fictives.")});
 function append(v){const line=document.createElement("div");line.className="sb-assistant-result-row";line.textContent=v;result.append(line)}
 function wipe(){history=[];result.replaceChildren();input.value="";$("cancel").hidden=true;voice.stop({discard:true})}
 function logout(){epoch++;session=null;busy=false;send.disabled=false;wipe();consent.checked=false;$("pilotAssistant").hidden=true;$("pilotSession").hidden=true;$("pilotLogin").hidden=false;$("pilotPassword").value="";$("pilotLoginStatus").textContent="Session terminée."}
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
   session={token:t,householdId:m.body[0].household_id};epoch++;wipe();$("pilotLogin").hidden=true;$("pilotSession").hidden=false;$("pilotAssistant").hidden=false;status.textContent="Connecté au compte de test. Autorise l’IA, puis saisis une demande.";
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
  const current=++epoch;busy=true;send.disabled=true;status.textContent="Gemma 4 analyse ta demande…";
  try{const r=await json("/functions/v1/smart-assistant",{method:"POST",headers:headers(session.token),body:JSON.stringify({householdId:session.householdId,command,context:{},...(history.length?{history}:{})})});
   if(current!==epoch)return;
   if(r.status===401){logout();$("pilotLoginStatus").textContent="Session expirée. Reconnecte-toi.";return}
   if(!r.ok){status.textContent=errorMessages[r.body.error]||"Erreur de la passerelle IA ("+r.status+").";return}
   const ctx=r.body.context,checked=core.validateResult(r.body.result,ctx);if(!checked.ok){status.textContent="Réponse inconnue ou invalide.";return;}
   result.replaceChildren();input.value="";const v=checked.value;
   if(v.kind==="draft"){for(const o of v.operations)append(kinds[o.kind]+" · "+o.label+" · "+(ctx.categories.find(c=>c.id===o.categoryId)?.name||"Catégorie")+" · "+euro(o.amountCents)+" · "+o.date+" · "+(o.frequency==="monthly"?"Mensuel":"Unique"));append("Brouillon uniquement. Aucun enregistrement.");}
   else if(v.kind==="query"){append(queries[v.query]+" · "+v.month+(v.compareMonth?" / "+v.compareMonth:"")+(v.categoryId?" · "+(ctx.categories.find(c=>c.id===v.categoryId)?.name||"Catégorie"):""));append("Consultation comprise. Calcul à raccorder à l’application complète.");}
   else append(v.message);
   history=["draft","clarify"].includes(v.kind)?[...history,{command,result:v}].slice(-2):[];$("cancel").hidden=false;
   status.textContent="Réponse IA reçue et validée · "+r.body.model;
  }catch{if(current===epoch)status.textContent="Communication interrompue. Réessaie sans envoi automatique."}
  finally{if(current===epoch){busy=false;send.disabled=false}}
 });
})();