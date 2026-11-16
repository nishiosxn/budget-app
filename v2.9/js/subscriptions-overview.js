// V2.9 — aperçu en lecture seule des abonnements et récurrences.
// Un budget prévu ne prouve jamais qu'un prélèvement bancaire a eu lieu.
function subscriptionOverviewData(categories,transactions){
 const subscriptions=(categories||[]).filter(c=>c.section==="Abonnements"&&!c.saving);
 const occurrences=(transactions||[]).filter(t=>t.recurringOccurrence&&t.type==="expense");
 const byCategory=new Map(subscriptions.map(c=>[c.id,{category:c,occurrences:[]}]));
 const other=[];
 for(const t of occurrences){
  const group=byCategory.get(t.category);
  if(group)group.occurrences.push(t);else other.push(t);
 }
 for(const group of byCategory.values())group.occurrences.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
 other.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
 return {groups:[...byCategory.values()],other,
  occurrenceCount:occurrences.length,subscriptionCount:subscriptions.length,
  scheduledAmount:occurrences.reduce((sum,t)=>sum+(Number(t.amount)||0),0),
  budgetAmount:subscriptions.reduce((sum,c)=>sum+(Number(c.budget)||0),0)};
}
function subscriptionOccurrenceMarkup(t){
 const id=String(t.sourceId||"");
 const parsed=new Date(String(t.date||"")+"T12:00:00");
 const date=Number.isNaN(parsed.getTime())?String(t.date||""):
  parsed.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
 const cat=catById(t.category,t.type),name=String(t.label||"").trim()||cat?.name||"Récurrence";
 return `<div class="subscription-occurrence">
  <div class="subscription-occurrence-info">
   <span class="subscription-occurrence-name">${escapeHtml(name)}</span>
   <span class="subscription-occurrence-meta">${escapeHtml(date)} · ${escapeHtml(ownerLabel(transactionOwner(t)))}</span>
  </div>
  <strong class="subscription-amount">${euro(Math.abs(Number(t.amount)||0))}</strong>
  <div class="subscription-actions">
   <button type="button" data-subscription-edit="${escapeHtml(id)}" aria-label="Modifier ${escapeHtml(name)}">Modifier</button>
   <button type="button" data-subscription-stop="${escapeHtml(id)}" aria-label="Gérer l'arrêt de ${escapeHtml(name)}">Arrêter…</button>
  </div>
 </div>`;
}
function renderSubscriptionsOverview(m){
 const root=document.getElementById("subscriptionsOverview");
 if(!root||!m)return;
 const data=subscriptionOverviewData(visibleExpenseCategories(),m.tx);
 const plural=(n,singular,plural)=>n===1?singular:plural;
 const configured=data.groups.filter(group=>group.occurrences.length);
 const unconfigured=data.groups.filter(group=>!group.occurrences.length);
 const groupHtml=configured.map(({category,occurrences})=>{
  const actual=Number(m.expMap?.[category.id])||0;
  return `<div class="subscription-category">
   <div class="subscription-category-top">
    <strong>${escapeHtml(category.name)}</strong>
    <span>${euro(actual)} réel · ${euro(Number(category.budget)||0)} prévu</span>
   </div>
   ${occurrences.length?occurrences.map(subscriptionOccurrenceMarkup).join(""):
     '<div class="subscription-no-recurrence">Aucune opération récurrente configurée pour ce mois.</div>'}
  </div>`;
 }).join("");
 const inactiveMarkup=unconfigured.length?`<details class="subscription-unconfigured">
  <summary>${unconfigured.length} ${plural(unconfigured.length,"catégorie","catégories")} sans récurrence ce mois-ci</summary>
  <div class="subscription-unconfigured-list">${unconfigured.map(({category})=>`<div>
   <span>${escapeHtml(category.name)}</span><span>Budget prévu : ${euro(Number(category.budget)||0)}</span>
  </div>`).join("")}</div>
 </details>`:"";
 const extras=data.other.length?`<div class="subscription-extra">
  <h3>Autres récurrences du mois</h3>
  ${data.other.map(subscriptionOccurrenceMarkup).join("")}
 </div>`:"";
 root.innerHTML=`<div class="subscriptions-heading">
  <div><div class="subscriptions-eyebrow">Ce mois-ci</div><h2>Abonnements et récurrences</h2></div>
  <span class="subscriptions-count">${data.subscriptionCount} ${plural(data.subscriptionCount,"catégorie","catégories")} · ${data.occurrenceCount} ${plural(data.occurrenceCount,"récurrence","récurrences")}</span>
 </div>
 <div class="subscriptions-summary">
  <div><span>Budget prévu · abonnements</span><strong>${euro(data.budgetAmount)}</strong></div>
  <div><span>Récurrences comptabilisées</span><strong>${euro(data.scheduledAmount)}</strong></div>
 </div>
 <p class="subscriptions-explain">Les échéances affichées viennent de Smart Budget. Elles ne prouvent pas qu'un prélèvement bancaire a eu lieu.</p>
 <div class="subscription-list">${groupHtml||'<p class="subscriptions-empty">Aucune récurrence d’abonnement configurée pour ce mois.</p>'}${inactiveMarkup}</div>
 ${extras}`;
}
document.getElementById("subscriptionsOverview")?.addEventListener("click",event=>{
 const edit=event.target.closest("[data-subscription-edit]");
 if(edit){if(edit.dataset.subscriptionEdit)openRecurrenceEdit(edit.dataset.subscriptionEdit);return;}
 const stop=event.target.closest("[data-subscription-stop]");
 if(stop&&stop.dataset.subscriptionStop)openRecurrenceDelete(stop.dataset.subscriptionStop);
});
