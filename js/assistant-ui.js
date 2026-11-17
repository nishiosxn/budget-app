/* V3.1 laboratory: typed proposals and bounded reads only. */
(()=>{
 "use strict";
 const core=globalThis.SmartBudgetAssistantCore,form=document.getElementById("sbAssistantForm"),input=document.getElementById("sbAssistantInput"),mic=document.getElementById("sbAssistantMic"),send=document.getElementById("sbAssistantSend"),consent=document.getElementById("sbAssistantConsent"),status=document.getElementById("sbAssistantStatus"),result=document.getElementById("sbAssistantResult");
 if(!form||!core)return;
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
 const identity=()=>cloudSyncReady&&cloudSession?.user?.id&&activeHouseholdId?cloudSession.user.id+"|"+activeHouseholdId:null;
 function assistantContext(){
  const h=normalizeHousehold(state.household),first=state.createdMonth,last=monthKey(MONTHS[MONTHS.length-1]),current=monthKey(state.selectedMonth);
  const cats=(list,kind)=>list.filter(c=>!(kind==="income"?state.deletedIncomeCategoriesGlobal:state.deletedCategoriesGlobal)?.includes(c.id)).map(c=>({id:c.id,name:c.name,kind:kind==="expense"&&c.saving?"saving":kind,owner:h.mode==="solo"?"B":planForCategoryAtKey(c,current,kind).owner,createdFrom:c.createdFrom||first,hiddenMonths:Object.entries(kind==="income"?state.deletedIncomeCategoryMonths||{}:state.deletedCategoryMonths||{}).filter(([,ids])=>ids.includes(c.id)).map(([key])=>key)}));
  return {today:today(),firstMonth:first,lastMonth:last,selectedMonth:current,solo:h.mode==="solo",actor:activeMembership?.slot==="A"?"A":activeMembership?.slot==="B"?"B":null,members:{B:h.personB,A:h.mode==="solo"?null:h.personA},categories:[...cats(INCOME_CATEGORIES,"income"),...cats(EXPENSE_CATEGORIES,"expense")]};
 }
 const line=value=>{const el=document.createElement("div");el.className="sb-assistant-result-row";el.textContent=value;result.append(el)};
 function showAssistantRead(q,ctx){
  const month=k=>{const [y,m]=k.split("-").map(Number);return labelFromYM(y,m)};
  const metric=metricsForMonth(month(q.month));
  if(q.query==="summary"){line(month(q.month)+" : revenus "+euro(metric.income)+" · dépenses "+euro(metric.expense)+" · épargne "+euro(metric.saving)+" · reste "+euro(metric.balance));return}
  if(q.query==="comparison"){const other=metricsForMonth(month(q.compareMonth));line(month(q.month)+" : reste "+euro(metric.balance)+" · "+month(q.compareMonth)+" : "+euro(other.balance)+" · écart "+euro(metric.balance-other.balance));return}
  const tx=metric.tx.filter(t=>(q.categoryId===null||t.category===q.categoryId)&&(q.owner===null||transactionOwner(t)===q.owner));
  if(q.query==="transactions"){line(tx.length+" opération(s) · "+month(q.month));tx.slice(0,30).forEach(t=>line(t.date+" · "+(t.label||catById(t.category,t.type)?.name||"Opération")+" · "+euro(t.amount)+(t.recurringOccurrence?" · récurrence":"")));if(tx.length>30)line("30 premiers résultats affichés.");return}
  const totals=new Map();
  for(const t of tx){const cat=catById(t.category,t.type),key=t.type+"|"+t.category,entry=totals.get(key)||{name:cat?.name||"Catégorie historique",total:0,budget:cat?planForCategoryAtKey(cat,q.month,t.type).budget:null};entry.total+=Number(t.amount)||0;totals.set(key,entry)}
  if(q.categoryId!==null&&!totals.size){const c=ctx.categories.find(x=>x.id===q.categoryId),def=c&&catById(c.id,c.kind==="income"?"income":"expense");line((c?.name||"Catégorie")+" · "+euro(0)+(def&&q.owner===null?" · prévu "+euro(planForCategoryAtKey(def,q.month,c.kind==="income"?"income":"expense").budget):""));return}
  if(!totals.size)line("Aucune opération enregistrée.");
  for(const t of totals.values())line(t.name+" · "+euro(t.total)+(t.budget!==null&&q.owner===null?" · prévu "+euro(t.budget):""));
 }
 let busy=false,seq=0,history=[];
 const reset=document.createElement("button");reset.type="button";reset.textContent="Nouvelle demande";reset.hidden=true;
 const hint=document.createElement("p");hint.hidden=true;hint.textContent="Les demandes suivantes peuvent préciser ou corriger ce brouillon non enregistré. Les deux derniers échanges sont transmis à l’IA.";
 result.after(hint,reset);
 function clearConversation(){history=[];hint.hidden=true;reset.hidden=true}
 reset.addEventListener("click",()=>{voice.stop({discard:true});seq++;busy=false;send.disabled=false;clearConversation();result.replaceChildren();input.value="";status.textContent="Nouvelle demande · aucune opération enregistrée.";input.focus()});
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(busy)return;voice.stop();
  const command=input.value.trim(),who=identity();
  if(!command)return;if(!who){status.textContent="Connecte-toi à un foyer.";return}
  if(!consent.checked){status.textContent="Autorise d’abord l’envoi de la demande.";return}
  const ctx=assistantContext();if(!ctx.actor){status.textContent="Impossible d’identifier ton rôle.";return}
  result.replaceChildren();busy=true;send.disabled=true;const request=++seq;status.textContent="Analyse de la demande…";
  try{
   const {data,error}=await cloudClient.functions.invoke("smart-assistant",{body:{householdId:activeHouseholdId,command,context:ctx,...(history.length?{history}:{})}});
   if(identity()!==who||request!==seq)return;
   if(error||!data?.result){status.textContent="Analyse indisponible ou contexte périmé. Réessaie ou commence une nouvelle demande. Aucune opération enregistrée.";return}
   const latest=assistantContext(),checked=core.validateResult(data.result,latest);
   if(!checked.ok){status.textContent="Réponse refusée : "+checked.error;return}
   if(["draft","clarify"].includes(checked.value.kind)){history=[...history,{command,result:checked.value}].slice(-2);hint.hidden=false;reset.hidden=false}else clearConversation();
   if(input.value.trim()===command)input.value="";
   status.textContent="Analyse terminée · aucune écriture automatique.";
   if(checked.value.kind==="draft"){
    for(const op of checked.value.operations){const c=latest.categories.find(x=>x.id===op.categoryId);line(op.label+" · "+c.name+" · "+euro(op.amountCents/100)+" · "+op.date+" · "+(op.owner==="common"?"À deux":latest.members[op.owner])+" · "+(op.kind==="plan"?"Budget prévu : ":"")+(op.frequency==="monthly"?"mensuel":"unique"))}
    line("Brouillon uniquement. La confirmation sera activée après les tests sur un foyer isolé.");
   }else if(checked.value.kind==="query")showAssistantRead(checked.value,latest);else line(checked.value.message);
  }catch{if(identity()===who&&request===seq)status.textContent="Erreur de communication. Aucune opération enregistrée."}
  finally{if(request===seq){busy=false;send.disabled=false}}
 });
 consent.addEventListener("change",()=>{if(!consent.checked){voice.stop({discard:true});seq++;busy=false;send.disabled=false;clearConversation();result.replaceChildren();status.textContent="Consentement retiré · aucune opération enregistrée."}});
 const voice=globalThis.SmartBudgetAssistantVoice.bind({input,button:mic,status,clock:document.querySelector(".sb-voice-clock"),authorize:()=>window.confirm("La dictée peut transmettre ton audio au service vocal du navigateur. Continuer ?")});
 document.querySelectorAll("[data-assistant-suggestion]").forEach(b=>b.addEventListener("click",()=>{voice.stop({discard:true});input.value=b.dataset.assistantSuggestion;input.focus()}));
 input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}});
 // Clear transient content when account/household changes; never persist prompts.
 let previous=identity();setInterval(()=>{const now=identity();if(now!==previous){previous=now;seq++;busy=false;send.disabled=false;clearConversation();result.replaceChildren();input.value="";consent.checked=false;status.textContent="Assistant V3.1 · laboratoire";voice.stop({discard:true})}},500);
})();
