// V2.3 — rendu général, historique, menus et navigation
function render(){
 syncHouseholdUi();
 const m=metrics();
 document.getElementById("balanceValue").innerHTML=`${euro(m.balance).replace("€","")}<small>€</small>`;
 document.getElementById("balanceSummary").textContent=`${euro(m.income)} de revenus · ${euro(m.expense+m.saving)} de sorties`;
 document.getElementById("balanceRestB").textContent=euro(m.restB);
 document.getElementById("balanceRestA").textContent=euro(m.restA);
 document.getElementById("incomeTotal").textContent=euro(m.income);document.getElementById("incomePlanned").textContent=`Prévu ${euro(m.plannedIncome)}`;
 document.getElementById("expenseTotal").textContent=euro(m.expense);document.getElementById("expensePlanned").textContent=`Budget ${euro(m.plannedExpense)}`;
 document.getElementById("saveB").textContent=euro(m.savingsBMonth);document.getElementById("saveA").textContent=euro(m.savingsAMonth);document.getElementById("saveBCumulative").textContent=euro(m.savingsB);document.getElementById("saveACumulative").textContent=euro(m.savingsA);
 document.getElementById("openingBValue").textContent=euro(m.openingB);document.getElementById("openingAValue").textContent=euro(m.openingA);
 document.getElementById("accountBalanceB").textContent=euro(m.accountBalanceB);document.getElementById("accountBalanceA").textContent=euro(m.accountBalanceA);
 document.getElementById("personBDetail").textContent=`Départ ${euro(m.openingB)} · +${euro(m.incomeB)} · −${euro(m.expenseB+m.savingBShare)}`;
 document.getElementById("personADetail").textContent=`Départ ${euro(m.openingA)} · +${euro(m.incomeA)} · −${euro(m.expenseA+m.savingAShare)}`;
 renderBudgetAlerts(m);renderSections(m);renderTop(m);renderRecent(m);globalThis.SmartBudgetCategoryDistribution?.render();renderCategories(m);renderHistory(m);renderTracking();
 window.SmartBudgetMotion?.afterRender();
 document.getElementById("transactionCount").textContent=`${m.tx.length} opération${m.tx.length>1?"s":""}`;
}
function renderSections(m){const sections=["Obligatoires","Abonnements","Vie courante"];document.getElementById("sectionCards").innerHTML=sections.map(s=>{const cats=visibleExpenseCategories().filter(c=>c.section===s),planned=sum(cats.map(c=>c.budget)),actual=sum(EXPENSE_CATEGORIES.filter(c=>!c.saving&&c.section===s).map(c=>m.expMap[c.id]||0))+sum(Object.values(LEGACY_CATEGORY_DEFS).filter(c=>c.type==="expense"&&c.section===s).map(c=>m.expMap[c.id]||0)),pct=planned?actual/planned*100:(actual?100:0),over=actual>planned;return `<article class="card budget-card"><div class="budget-card-head"><h3>${s}</h3><span class="${over?'row-value exp':'row-sub'}">${Math.round(pct)}%</span></div><div class="nums"><strong>${euro(actual)}</strong> / ${euro(planned)}</div><div class="progress ${over?'over':''}"><span style="width:${Math.min(pct,100)}%"></span></div><div class="budget-foot">${over?`Dépassement de ${euro(actual-planned)}`:`Il reste ${euro(Math.max(planned-actual,0))}`}</div></article>`}).join("")}
function renderTop(m){const items=visibleExpenseCategories().map(c=>{const actual=m.expMap[c.id]||0,pct=c.budget>0?actual/c.budget*100:(actual>0?999:0);return {...c,actual,pct}}).filter(c=>c.actual>0&&(c.pct>=75||c.budget===0)).sort((a,b)=>b.pct-a.pct).slice(0,6);document.getElementById("topCategories").innerHTML=items.length?items.map(c=>{const over=c.budget>0&&c.actual>c.budget,remaining=c.budget>0?c.budget-c.actual:0,label=over?`Dépassé de ${euro(Math.abs(remaining))}`:c.budget>0?`Il reste ${euro(Math.max(remaining,0))}`:"Aucun budget prévu",pill=over?"danger":c.pct>=90?"warn":"ok";return `<div class="row"><div class="watch-status"><div class="watch-copy"><div class="watch-title">${escapeHtml(c.name)}</div><div class="watch-sub">${euro(c.actual)} / ${euro(c.budget)}</div></div><span class="watch-pill ${pill}">${label}</span></div></div>`}).join(""):`<div class="empty">Tout est dans les budgets ce mois-ci.</div>`}
function sortedTransactions(m){return [...m.tx].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||String(b.id).localeCompare(String(a.id)))}
function transactionPresentation(t){const c=catById(t.category,t.type),amount=Number(t.amount)||0,saving=t.type==="expense"&&!!c?.saving;let cls,icon,prefix;if(saving){cls="saving";icon="↗";prefix=amount>=0?"+":"−"}else if(t.type==="income"){cls=amount>=0?"inc":"exp";icon=amount>=0?"+":"−";prefix=amount>=0?"+":"−"}else{cls=amount>=0?"exp":"inc";icon=amount>=0?"−":"+";prefix=amount>=0?"−":"+"}return {c,amount,saving,cls,icon,prefix}}
function transactionTitle(t){const c=catById(t.category,t.type),label=String(t.label||"").trim();return label||c?.name||"Catégorie"}
function transactionContext(t,short=false){const who=ownerLabel(transactionOwner(t)),date=new Date((t.date||transactionDateForSelectedMonth())+'T12:00:00').toLocaleDateString('fr-FR',short?{day:'2-digit',month:'short'}:{day:'2-digit',month:'long',year:'numeric'}),c=catById(t.category,t.type),categoryPrefix=String(t.label||"").trim()&&c?.name?`${escapeHtml(c.name)} · `:"";if(t.adjustment)return `${categoryPrefix}${escapeHtml(t.adjustmentLabel||"Ajustement manuel")} · ${date} · ${who}`;if(t.seed)return `${categoryPrefix}Import du tableur · ${who}`;if(t.recurringOccurrence||t.scope==="forward")return `${categoryPrefix}Récurrent · ${date} · ${who}`;return `${categoryPrefix}${date} · ${who}`}
function historyEntries(m){const sorted=sortedTransactions(m),seen=new Set(),entries=[];for(const t of sorted){if(t.bulkGroupId){if(seen.has(t.bulkGroupId))continue;const tx=sorted.filter(x=>x.bulkGroupId===t.bulkGroupId);seen.add(t.bulkGroupId);entries.push({group:true,id:t.bulkGroupId,label:t.bulkLabel||t.adjustmentLabel||"Mise à jour groupée",tx,date:t.date})}else entries.push({group:false,tx:t,date:t.date})}return entries}
function groupPresentation(entry){const amount=sum(entry.tx.map(t=>Number(t.amount)||0)),type=entry.tx.every(t=>t.type==="income")?"income":entry.tx.every(t=>catById(t.category,t.type)?.saving)?"saving":"expense",cls=type==="income"?(amount>=0?"inc":"exp"):type==="saving"?"saving":(amount>=0?"exp":"inc"),prefix=type==="expense"?(amount>=0?"−":"+"):(amount>=0?"+":"−"),icon=type==="income"?"+":type==="saving"?"↗":"−";return {amount,type,cls,prefix,icon}}
function renderRecent(m){const entries=historyEntries(m).slice(0,6);document.getElementById("recentTransactions").innerHTML=entries.length?entries.map(entry=>{if(entry.group){const p=groupPresentation(entry);return `<div class="row"><div class="row-main"><div class="row-title">${escapeHtml(entry.label)}</div><div class="row-sub">${entry.tx.length} opérations · ${new Date((entry.date||transactionDateForSelectedMonth())+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</div></div><div class="row-value ${p.cls}">${p.prefix}${euro(Math.abs(p.amount))}</div></div>`}const t=entry.tx,p=transactionPresentation(t);return `<div class="row"><div class="row-main"><div class="row-title">${escapeHtml(transactionTitle(t))}</div><div class="row-sub">${transactionContext(t,true)}</div></div><div class="row-value ${p.cls}">${p.prefix}${euro(Math.abs(p.amount))}</div></div>`}).join(""):`<div class="empty">Aucun mouvement pour ce mois.</div>`}
const expandedCategoryDetails=new Set();
function categoryDetailsKey(id,type){return `${type}:${id}`}
function categoryDetailsOpen(id,type){return expandedCategoryDetails.has(categoryDetailsKey(id,type))}
function toggleCategoryDetails(id,type){
 const key=categoryDetailsKey(id,type);
 if(expandedCategoryDetails.has(key))expandedCategoryDetails.delete(key);else expandedCategoryDetails.add(key);
 render();
}
function categoryDetailDate(t){
 const raw=String(t.date||transactionDateForSelectedMonth());
 const date=new Date(raw+"T12:00:00");
 return Number.isNaN(date.getTime())?"":date.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
}
function categoryDetailOwner(t,type){
 const owner=transactionOwner(t),name=ownerLabel(owner);
 if(owner==="common")return "À deux";
 if(type==="income")return `Reçu par ${name}`;
 const category=catById(t.category,type);
 if(category?.saving)return `Épargné par ${name}`;
 return `Payé par ${name}`;
}
function categoryDetailLabel(t){
 const label=String(t.label||"").trim();
 if(label)return label;
 if(t.adjustment)return t.adjustmentLabel||"Ajustement";
 if(t.recurringOccurrence||t.scope==="forward")return "Opération récurrente";
 return "Opération";
}
function categoryDetailAmount(t,type){
 const amount=Number(t.amount)||0;
 if(amount<0)return `−${euro(Math.abs(amount))}`;
 return euro(amount);
}
function categoryDetailsMarkup(c,type,m){
 const all=(m?.tx||[]).filter(t=>t.type===type&&t.category===c.id);
 const transactions=all.filter(t=>!t.adjustment).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||String(b.id).localeCompare(String(a.id)));
 const adjustments=all.filter(t=>t.adjustment),adjustmentTotal=Math.round(sum(adjustments.map(t=>Number(t.amount)||0))*100)/100;
 if(!transactions.length&&Math.abs(adjustmentTotal)<.005)return {count:0,html:""};
 const open=categoryDetailsOpen(c.id,type);
 let rows=transactions.map(t=>`<div class="cat-detail-row">
   <div class="cat-detail-main">
    <div class="cat-detail-label">${escapeHtml(categoryDetailLabel(t))}</div>
    <div class="cat-detail-meta">${escapeHtml(categoryDetailDate(t))} · ${escapeHtml(categoryDetailOwner(t,type))}</div>
   </div>
   <strong class="cat-detail-amount">${categoryDetailAmount(t,type)}</strong>
  </div>`).join("");
 if(Math.abs(adjustmentTotal)>=.005){
  rows+=`<div class="cat-detail-row cat-detail-adjustment">
   <div class="cat-detail-main">
    <div class="cat-detail-label">Ajustement du total</div>
    <div class="cat-detail-meta">Correction manuelle · non liée à un achat précis</div>
   </div>
   <strong class="cat-detail-amount">${adjustmentTotal<0?"−":""}${euro(Math.abs(adjustmentTotal))}</strong>
  </div>`;
 }
 const count=transactions.length+(Math.abs(adjustmentTotal)>=.005?1:0);
 return {count,open,html:`<div class="cat-details" data-category-details="${escapeHtml(c.id)}" ${open?"":"hidden"}>${rows}</div>`};
}
function categoryProgressMarkup(c,actual,type){
 const isSaving=type==="expense"&&!!c.saving;
 const expense=type==="expense"&&!isSaving;
 const planned=Math.max(0,Number(c.budget)||0),current=Math.max(0,Number(actual)||0);
 const pct=planned>.005?Math.round(current/planned*100):null;
 const exceeded=expense&&planned>.005&&current>planned+.005;
 const difference=planned-current;
 const severity=exceeded?(current/planned>1.15?"danger":"warning"):"normal";
 const fill=pct===null?0:Math.max(0,Math.min(100,pct));
 let label;
 if(pct===null)label=current>.005?"Sans budget prévu":"Pas de budget";
 else if(exceeded)label="+"+euro(-difference)+" · "+pct+" %";
 else if(!expense&&difference<-.005)label="+"+euro(-difference)+" · "+pct+" %";
 else if(Math.abs(difference)<.005)label="100 % atteint";
 else if(isSaving)label=euro(difference)+" à épargner · "+pct+" %";
 else if(type==="income")label=euro(difference)+" à recevoir · "+pct+" %";
 else label=euro(difference)+" restants · "+pct+" %";
 const progressInfo=pct===null?(current>.005?euro(current)+" de réel sans budget prévu":"Aucun budget prévu"):
  pct+" % du prévu"+(exceeded?", dépassement de "+euro(-difference):"");
 const usedName=type==="income"?"Reçu":isSaving?"Épargné":"Utilisé";
 const remainingName=planned<=.005?"Reste":difference<-.005?(expense?"Dépassement":"Au-dessus du prévu"):
  type==="income"?"À recevoir":isSaving?"À épargner":"Reste";
 const remainingValue=planned<=.005?"Sans budget":euro(Math.abs(difference));
 const detailId="category-progress-"+type+"-"+c.id;
 const tip='<div id="'+escapeHtml(detailId)+'" class="cat-progress-tooltip" role="tooltip">'+
  '<strong>'+escapeHtml(c.name)+'</strong>'+
  '<dl><div><dt>'+usedName+'</dt><dd>'+euro(current)+'</dd></div>'+
  '<div><dt>Budget prévu</dt><dd>'+euro(planned)+'</dd></div>'+
  '<div><dt>'+remainingName+'</dt><dd>'+remainingValue+'</dd></div></dl></div>';
 const accessibleDetails=usedName+" : "+euro(current)+", budget prévu : "+euro(planned)+", "+remainingName+" : "+remainingValue;
 return '<div class="cat-progress-row"><div class="cat-progress-track'+(pct===null&&current>.005?" is-unbudgeted":"")+'" role="progressbar" tabindex="0" data-progress-track aria-describedby="'+escapeHtml(detailId)+'" aria-label="'+escapeHtml(c.name)+" — "+escapeHtml(accessibleDetails)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+fill+'" aria-valuetext="'+escapeHtml(progressInfo)+'">'+
  '<span class="cat-progress-fill is-'+severity+(isSaving?" is-saving":type==="income"?" is-income":"")+'" style="width:'+fill+'%"></span></div>'+
  '<span class="cat-progress-caption '+(exceeded?"is-"+severity:"")+'">'+escapeHtml(label)+'</span>'+
  tip+'</div>';
}
function categoryActionIcon(name){
 if(name==="check")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5"/></svg>';
 if(name==="gear")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.1 2.8h3.8l.6 2.3c.5.2 1 .5 1.4.8l2.2-.7 2.7 2.7-.7 2.2c.3.4.6.9.8 1.4l2.3.6v3.8l-2.3.6c-.2.5-.5 1-.8 1.4l.7 2.2-2.7 2.7-2.2-.7c-.4.3-.9.6-1.4.8l-.6 2.3h-3.8l-.6-2.3c-.5-.2-1-.5-1.4-.8l-2.2.7-2.7-2.7.7-2.2c-.3-.4-.6-.9-.8-1.4l-2.3-.6v-3.8l2.3-.6c.2-.5.5-1 .8-1.4l-.7-2.2 2.7-2.7 2.2.7c.4-.3.9-.6 1.4-.8l.6-2.3Z"/><circle cx="12" cy="14" r="3.1"/></svg>';
 return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg>';
}
function categoryRow(c,actual,type,m){
 const isSaving=type==="expense"&&!!c.saving;
 const current=Number(actual)||0,planned=Number(c.budget)||0,canFill=planned>.005;
 const details=categoryDetailsMarkup(c,type,m),open=!!details.open;
 const stateClass=planned>.005&&Math.abs(current-planned)<.005?"is-matched":Math.abs(current)<.005?"is-empty":"is-different";
 const nameMarkup=details.count
  ?'<button class="cat-tile-name cat-name-toggle" type="button" data-category-details-toggle="'+escapeHtml(c.id)+'" data-category-type="'+type+'" aria-expanded="'+(open?"true":"false")+'" aria-label="'+(open?"Masquer":"Afficher")+' les '+details.count+' opérations de '+escapeHtml(c.name)+'"><span class="cat-name">'+escapeHtml(c.name)+'</span><svg class="cat-detail-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg></button>'
  :'<span class="cat-tile-name cat-name">'+escapeHtml(c.name)+'</span>';
 const id=escapeHtml(c.id),kind=escapeHtml(type),category=escapeHtml(c.name);
 const fillAction=canFill?'<button class="cat-tile-icon cat-tile-fill" type="button" data-demo-fill-category="'+id+'" data-category-type="'+kind+'" aria-label="Aligner le réel de '+category+' sur '+euro(planned)+'" title="Aligner le réel sur le prévu (confirmation si déjà renseigné)" '+(stateClass==="is-matched"?'disabled':'')+'>'+categoryActionIcon("check")+'</button>':"";
 return '<article class="cat-item cat-budget-tile '+stateClass+' '+(open?"details-open":"")+'" data-category-row="'+id+'">'+
  '<div class="cat-tile-head"><div class="cat-tile-identity">'+nameMarkup+'<span class="cat-tile-owner">'+escapeHtml(ownerLabel(c.owner))+'</span></div>'+
   '<div class="cat-tile-actions">'+fillAction+
    '<button class="cat-tile-icon cat-tile-settings" type="button" data-demo-settings="'+id+'" data-category-type="'+kind+'" aria-label="Paramètres de '+category+'" title="Paramètres">'+categoryActionIcon("gear")+'</button>'+
    '<button class="cat-tile-icon cat-tile-delete" type="button" data-delete-category="'+id+'" data-category-type="'+kind+'" aria-label="Supprimer '+category+'" title="Supprimer">'+categoryActionIcon("trash")+'</button></div></div>'+
  '<div class="cat-tile-finances"><div class="cat-tile-money"><span class="cat-tile-kicker">Réel</span>'+
    '<button class="cat-tile-money-button" type="button" data-edit-actual="'+id+'" data-category-type="'+kind+'" aria-label="Modifier le réel de '+category+'">'+euro(current)+'</button></div>'+
   '<div class="cat-tile-money"><span class="cat-tile-kicker">Prévu</span>'+
    '<button class="cat-tile-money-button cat-tile-planned" type="button" data-edit-planned="'+id+'" data-category-type="'+kind+'" aria-label="Modifier le prévu de '+category+'">'+euro(planned)+'</button></div></div>'+
   categoryProgressMarkup(c,current,type)+details.html+'</article>';
}
function archivedCategoryRow(c,actual,type){return `<div class="cat-item archived"><div class="cat-line"><div class="cat-name">${escapeHtml(c.name)} <span class="archive-badge">Archivée</span></div><div class="cat-amount">${euro(actual)}</div></div><div class="cat-meta"><span>Mouvements conservés pour expliquer le total</span><span>${ownerLabel(transactionOwner({category:c.id,type,date:`${monthKey(state.selectedMonth)}-01`}))}</span></div></div>`}
// Normalize legacy and custom groups to the same set used by the chart.
function categorySectionOf(c){
 return ["Obligatoires","Abonnements","Vie courante"].includes(c?.section)?c.section:"Autres";
}
function archivedCategoriesFor(type,section,m){const base=type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES,legacy=Object.values(LEGACY_CATEGORY_DEFS).filter(c=>c.type===type),list=[...base,...legacy],totals=type==="income"?m.incMap:m.expMap;return list.filter(c=>{if(type==="expense"){if(section==="__savings__"&&!c.saving)return false;if(section!=="__savings__"&&(c.saving||categorySectionOf(c)!==section))return false}const hidden=c.legacy||!isCategoryVisible(c.id,state.selectedMonth,type);return hidden&&Math.abs(totals[c.id]||0)>.005}).map(c=>c.legacy?c:categoryView(c,type))}
function archivedBlock(cats,totals,type){return cats.length?`<div class="archived-wrap"><div class="archived-label">Archivées ce mois</div>${cats.map(c=>archivedCategoryRow(c,totals[c.id]||0,type)).join("")}</div>`:""}
function restorableCategoriesFor(type,section){
 const source=type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES,key=monthKey(state.selectedMonth);
 return source.filter(c=>{
  if(key<categoryCreatedFrom(c.id,type)||isCategoryVisible(c.id,state.selectedMonth,type))return false;
  if(type==="income")return true;
  if(section==="__savings__")return !!c.saving;
  return !c.saving&&categorySectionOf(c)===section;
 }).map(c=>categoryView(c,type));
}
function restorableBlock(cats,type){
 if(!cats.length)return "";
 return `<details class="restorable-categories"><summary>Catégories masquées <span>${cats.length}</span></summary><div class="restorable-list">${cats.map(c=>`<div class="restorable-row"><span>${escapeHtml(c.name)}</span><button type="button" data-restore-category="${escapeHtml(c.id)}" data-category-type="${type}">Réactiver</button></div>`).join("")}</div></details>`;
}
function categoryBulkButtons(type,section,label){
 const categoryType=escapeHtml(type),sectionName=escapeHtml(section||""),name=escapeHtml(label);
 return '<div class="cat-section-actions cat-tile-bulk">'+
  '<button class="cat-bulk fill" type="button" data-demo-fill-all data-category-type="'+categoryType+'" data-section="'+sectionName+'" aria-label="Compléter les réels vides de '+name+' sans modifier les montants existants" title="Compléter uniquement les réels à zéro">'+categoryActionIcon("check")+'<span>Remplir les vides</span></button>'+
  '<button class="cat-bulk cat-bulk-clear" type="button" data-demo-clear-all data-category-type="'+categoryType+'" data-section="'+sectionName+'" aria-label="Tout vider dans '+name+'" title="Remettre tous les réels à zéro, sans effacer les opérations">'+categoryActionIcon("trash")+'<span>Tout vider</span></button>'+
  '</div>';
}
function renderCategories(m){
 const filter=globalThis.SmartBudgetCategoryDistribution?.filter()||null;
 const ids=filter?new Set(filter.ids):null;
 const showExtras=!filter;
 const selected=(categories,type)=>filter?(filter.type===type?categories.filter(c=>ids.has(c.id)):[]):categories;
 const incomeCats=selected(visibleIncomeCategories(),"income");
 const incomeActual=filter?sum(incomeCats.map(c=>m.incMap[c.id]||0)):m.income;
 const incomePlanned=sum(incomeCats.map(c=>c.budget));
 const incomeArchived=showExtras?archivedCategoriesFor("income","",m):[];
 const sectionFigures=(actual,planned)=>'<div class="cg-figures"><span><strong>'+euro(actual)+'</strong> réel</span><span><strong>'+euro(planned)+'</strong> prévu</span></div>';
 const list=items=>'<div class="cat-budget-list">'+items.join("")+'</div>';
 const incomeCard='<article class="cat-section cat-section-single income-card">'+list(incomeCats.map(c=>categoryRow(c,m.incMap[c.id]||0,"income",m)))+
   (showExtras?archivedBlock(incomeArchived,m.incMap,"income")+restorableBlock(restorableCategoriesFor("income",""),"income")+
   '<button class="add-category" type="button" data-add-category="Revenus" data-category-type="income">＋ Ajouter un revenu</button>':"")+'</article>';
 const sections=["Obligatoires","Abonnements","Vie courante"];
 const expenseVisible=visibleExpenseCategories();
 if(expenseVisible.some(c=>categorySectionOf(c)==="Autres")||[...EXPENSE_CATEGORIES,...Object.values(LEGACY_CATEGORY_DEFS)].some(c=>!c.saving&&categorySectionOf(c)==="Autres"))sections.push("Autres");
 const expenseSummary=[];
 const expenseCards=sections.map(section=>{
  const cats=selected(expenseVisible.filter(c=>categorySectionOf(c)===section),"expense");
  if(filter&&!cats.length)return "";
  const archived=showExtras?archivedCategoriesFor("expense",section,m):[];
  const actual=filter?sum(cats.map(c=>m.expMap[c.id]||0)):
   sum(EXPENSE_CATEGORIES.filter(c=>!c.saving&&categorySectionOf(c)===section).map(c=>m.expMap[c.id]||0))+
   sum(Object.values(LEGACY_CATEGORY_DEFS).filter(c=>c.type==="expense"&&!c.saving&&categorySectionOf(c)===section).map(c=>m.expMap[c.id]||0));
  const planned=sum(cats.map(c=>c.budget));
  expenseSummary.push({actual,planned});
  return '<article class="cat-section cat-family-block"><div class="cat-section-head"><div class="cat-section-title">'+escapeHtml(section)+
   '<div class="cat-section-total">'+euro(actual)+' réel · '+euro(planned)+' prévu</div></div>'+
   (showExtras?categoryBulkButtons("expense",section,section):"")+'</div>'+
   list(cats.map(c=>categoryRow(c,m.expMap[c.id]||0,"expense",m)))+
   (showExtras?archivedBlock(archived,m.expMap,"expense")+restorableBlock(restorableCategoriesFor("expense",section),"expense")+
    '<button class="add-category" type="button" data-add-category="'+escapeHtml(section)+'" data-category-type="expense">＋ Ajouter une dépense</button>':"")+'</article>';
 }).join("");
 const savingCats=visibleSavingCategories(),savingArchived=archivedCategoriesFor("expense","__savings__",m);
 const savingActual=m.saving,savingPlanned=sum(savingCats.map(c=>c.budget));
 const savingCard='<article class="cat-section cat-section-single saving-card">'+
   list(savingCats.map(c=>categoryRow(c,m.expMap[c.id]||0,"expense",m)))+
   archivedBlock(savingArchived,m.expMap,"expense")+restorableBlock(restorableCategoriesFor("expense","__savings__"),"expense")+
   '<button class="add-category saving-add" type="button" data-add-saving="1">＋ Ajouter une épargne</button></article>';
 const banner=filter?'<div class="category-filter-banner" role="status"><strong>'+escapeHtml(filter.label)+
  '</strong><button type="button" data-clear-category-filter>Tout afficher</button></div>':"";
 const expenseActual=sum(expenseSummary.map(x=>x.actual)),expensePlanned=sum(expenseSummary.map(x=>x.planned));
 const incomeGroup='<section class="category-group card" aria-labelledby="cg-revenues"><div class="category-group-head"><h2 id="cg-revenues">Revenus</h2>'+
  '<div class="cg-head-end">'+sectionFigures(incomeActual,incomePlanned)+(showExtras?categoryBulkButtons("income","","Revenus"):"")+'</div></div>'+
  '<div class="category-cards income-cards">'+incomeCard+'</div></section>';
 const expenseGroup='<section class="category-group card" aria-labelledby="cg-expenses"><div class="category-group-head"><h2 id="cg-expenses">Dépenses</h2>'+
  sectionFigures(expenseActual,expensePlanned)+'</div>'+
  '<div class="category-cards">'+expenseCards+'</div></section>';
 const savingGroup='<section class="category-group card saving-group" aria-labelledby="cg-savings"><div class="category-group-head"><h2 id="cg-savings">Épargne</h2>'+
  '<div class="cg-head-end">'+sectionFigures(savingActual,savingPlanned)+(showExtras?categoryBulkButtons("expense","__savings__","Épargne"):"")+'</div></div>'+
  '<div class="category-cards income-cards">'+savingCard+'</div></section>';
 const gridHost=document.getElementById("categoryGrid");
 const visibleIncome=(!filter||filter.type==="income")?incomeGroup:"";
 const visibleExpense=(!filter||filter.type==="expense")?expenseGroup:"";
 const visibleSaving=!filter?savingGroup:"";
 if(gridHost?.dataset?.layout==="hybrid"){
  // Preserve the chart's node and delegated category listeners on every render.
  // Only the generated group contents are refreshed; no handlers/data are rebuilt.
  document.getElementById("categoryFilterSlot").innerHTML=banner;
  document.getElementById("categoryIncomeSlot").innerHTML=visibleIncome;
  document.getElementById("categoryExpenseSlot").innerHTML=visibleExpense;
  document.getElementById("categorySavingSlot").innerHTML=visibleSaving;
  gridHost.dataset.filterType=filter?.type||"all";
 }else{
  // DOM-light regression harnesses still use the legacy single target.
  gridHost.innerHTML=banner+visibleIncome+visibleExpense+visibleSaving;
 }
}

function personName(owner){return owner==="B"?(state.household?.personB||"Personne 1"):owner==="A"?(state.household?.personA||"Personne 2"):"À deux"}
function ownerLabel(o){return o==="common"?(householdIsSolo()?personName("B"):"À deux"):personName(o)}
function syncHouseholdUi(){
 const household=normalizeHousehold(state.household);state.household=household;
 document.documentElement.classList.toggle("household-solo",household.mode==="solo");
 document.querySelectorAll("[data-person-label]").forEach(el=>{const owner=el.dataset.personLabel;el.textContent=personName(owner)});
 document.querySelectorAll("[data-person-avatar]").forEach(el=>{const name=personName(el.dataset.personAvatar);el.textContent=(name.trim()[0]||"?").toUpperCase()});
 const title=document.getElementById("householdTitle");if(title)title.textContent=household.name||"Budget foyer";
}
function renderHistory(m){const original=historyEntries(m),entries=typeof filterHistoryEntries==='function'?filterHistoryEntries(original,m):original;document.getElementById("historyList").innerHTML=entries.length?entries.map(entry=>{if(entry.group){const p=groupPresentation(entry),date=new Date((entry.date||transactionDateForSelectedMonth())+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});return `<div class="history-group" data-history-group="${entry.id}"><div class="history-row"><div class="history-icon ${p.type}">${p.icon}</div><div><div class="history-title">${escapeHtml(entry.label)}</div><div class="history-date">${entry.tx.length} opérations · ${date} <button class="history-toggle" type="button" data-toggle-group="${entry.id}">Voir le détail</button></div></div><div class="history-amount row-value ${p.cls}">${p.prefix}${euro(Math.abs(p.amount))}</div><div class="history-actions"><button class="history-delete" title="${entry.filteredGroup?'Effacer les filtres avant suppression':'Supprimer ce groupe'}" ${entry.filteredGroup?'disabled':'data-delete-group="'+escapeHtml(entry.id)+'"'} aria-label="Supprimer ce groupe">×</button></div></div><div class="history-group-details">${entry.tx.map(t=>{const tp=transactionPresentation(t);return `<div class="history-detail-row"><span>${escapeHtml(transactionTitle(t))}</span><strong>${tp.prefix}${euro(Math.abs(tp.amount))}</strong></div>`}).join("")}</div></div>`}const t=entry.tx,p=transactionPresentation(t),recurring=!!t.recurringOccurrence||t.scope==="forward",actions=recurring?`<div class="history-actions"><button class="history-edit" type="button" title="Modifier la récurrence" aria-label="Modifier la récurrence" data-edit-recurring="${t.sourceId||t.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="history-delete" title="Supprimer la récurrence" aria-label="Supprimer la récurrence" data-delete-recurring="${t.sourceId||t.id}">×</button></div>`:`<div class="history-actions"><button class="history-edit" type="button" title="Modifier l’opération" aria-label="Modifier l’opération" data-edit-transaction="${t.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="history-delete" title="Supprimer" aria-label="Supprimer l’opération" data-delete="${t.id}">×</button></div>`;return `<div class="history-row"><div class="history-icon ${p.saving?'saving':t.type}">${p.icon}</div><div><div class="history-title">${escapeHtml(transactionTitle(t))}</div><div class="history-date">${transactionContext(t,false)}</div></div><div class="history-amount row-value ${p.cls}">${p.prefix}${euro(Math.abs(p.amount))}</div>${actions}</div>`}).join(""):`<div class="empty">Aucune opération pour ce mois ou ces filtres.</div>`}


const customSelects=new Map();
function closeCustomSelects(except=null){
  customSelects.forEach((ui)=>{if(ui.root!==except){ui.root.classList.remove("open");ui.trigger.setAttribute("aria-expanded","false")}})
}
function buildCustomSelect(select){
  const root=document.querySelector(`.custom-select[data-select="${select.id}"]`);if(!root)return null;
  const trigger=root.querySelector(".custom-select-trigger"),valueEl=root.querySelector(".custom-select-value"),menu=root.querySelector(".custom-select-menu"),scroller=menu.querySelector(".custom-select-scroll");
  const check=`<span class="custom-select-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4L18 8"/></svg></span>`;
  function options(){return [...scroller.querySelectorAll(".custom-select-option")]}
  function close(returnFocus=false){root.classList.remove("open");trigger.setAttribute("aria-expanded","false");if(returnFocus)trigger.focus()}
  function focusOption(index){
    const list=options();if(!list.length)return;
    const next=Math.max(0,Math.min(index,list.length-1));
    list.forEach((o,i)=>o.classList.toggle("focused",i===next));
    list[next].focus();list[next].scrollIntoView({block:"nearest"})
  }
  function open(prefer="selected"){
    closeCustomSelects(root);root.classList.add("open");trigger.setAttribute("aria-expanded","true");
    const list=options();if(!list.length)return;
    let index=prefer==="last"?list.length-1:0;
    if(prefer==="selected"){const selectedIndex=list.findIndex(o=>o.dataset.value===select.value);index=selectedIndex>=0?selectedIndex:0}
    requestAnimationFrame(()=>focusOption(index))
  }
  function choose(option){
    if(!option)return;select.value=option.dataset.value;select.dispatchEvent(new Event("change",{bubbles:true}));close(true)
  }
  function rebuild(){
    const parts=[];
    [...select.children].forEach(node=>{
      if(node.tagName==="OPTGROUP"){
        parts.push(`<div class="custom-select-group">${escapeHtml(node.label)}</div>`);
        [...node.children].forEach(opt=>{if(opt.disabled&&opt.value==="")return;const create=opt.value==="__create__"?" create-option":"";parts.push(`<button type="button" class="custom-select-option${create}" role="option" data-value="${escapeHtml(opt.value)}">${check}<span style="flex:1">${escapeHtml(opt.textContent)}</span></button>`)});
      }else if(node.tagName==="OPTION"){
        if(node.disabled&&node.value==="")return;const create=node.value==="__create__"?" create-option":"";
        parts.push(`<button type="button" class="custom-select-option${create}" role="option" data-value="${escapeHtml(node.value)}">${check}<span style="flex:1">${escapeHtml(node.textContent)}</span></button>`)
      }
    });
    scroller.innerHTML=parts.join("");sync()
  }
  function sync(){
    const selected=select.options[select.selectedIndex];
    valueEl.textContent=selected?selected.textContent:"Choisir";
    options().forEach(o=>{const active=o.dataset.value===select.value;o.classList.toggle("selected",active);o.classList.remove("focused");o.setAttribute("aria-selected",active?"true":"false")})
  }
  trigger.addEventListener("click",e=>{e.stopPropagation();root.classList.contains("open")?close():open("selected")});
  menu.addEventListener("click",e=>{const option=e.target.closest(".custom-select-option");if(option)choose(option)});
  trigger.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){e.preventDefault();open("selected")}
    else if(e.key==="ArrowUp"){e.preventDefault();open("last")}
    else if(e.key==="Enter"||e.key===" "){e.preventDefault();root.classList.contains("open")?close():open("selected")}
    else if(e.key==="Escape"){e.preventDefault();close()}
  });
  menu.addEventListener("keydown",e=>{
    const list=options(),current=list.indexOf(document.activeElement);if(current<0)return;
    if(e.key==="ArrowDown"){e.preventDefault();focusOption((current+1)%list.length)}
    else if(e.key==="ArrowUp"){e.preventDefault();focusOption((current-1+list.length)%list.length)}
    else if(e.key==="Home"){e.preventDefault();focusOption(0)}
    else if(e.key==="End"){e.preventDefault();focusOption(list.length-1)}
    else if(e.key==="Enter"||e.key===" "){e.preventDefault();choose(list[current])}
    else if(e.key==="Escape"){e.preventDefault();close(true)}
    else if(e.key==="Tab"){close(false)}
  });
  select.addEventListener("change",sync);
  const api={root,trigger,menu,rebuild,sync,close,open};customSelects.set(select,api);rebuild();return api;
}
function rebuildCustomSelect(select){customSelects.get(select)?.rebuild()}
function syncCustomSelect(select){customSelects.get(select)?.sync()}
document.addEventListener("click",()=>closeCustomSelects());

const monthSelect=document.getElementById("monthSelect"),prevMonthBtn=document.getElementById("prevMonth"),nextMonthBtn=document.getElementById("nextMonth");ensureMonthAvailable(state.selectedMonth);MONTHS.forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;monthSelect.appendChild(o)});monthSelect.value=state.selectedMonth;buildCustomSelect(monthSelect);
function updateMonthNav(){const i=MONTHS.indexOf(state.selectedMonth);prevMonthBtn.disabled=i<=0;nextMonthBtn.disabled=false}
function moveMonth(step){let i=MONTHS.indexOf(state.selectedMonth),next=i+step;if(next<0)return;if(next>=MONTHS.length){const label=appendNextMonth(),o=document.createElement("option");o.value=label;o.textContent=label;monthSelect.appendChild(o);rebuildCustomSelect(monthSelect)}state.selectedMonth=MONTHS[next];monthSelect.value=state.selectedMonth;syncCustomSelect(monthSelect);saveState();updateMonthNav();render()}
monthSelect.addEventListener("change",e=>{state.selectedMonth=e.target.value;saveState();updateMonthNav();render()});
prevMonthBtn.addEventListener("click",()=>moveMonth(-1));nextMonthBtn.addEventListener("click",()=>moveMonth(1));
updateMonthNav();
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{if(window.SmartBudgetMotion?.changeView){window.SmartBudgetMotion.changeView(btn);return;}document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));btn.classList.add("active");document.getElementById(btn.dataset.tab).classList.add("active")}));

function renderBudgetAlerts(m){
 const panel=document.getElementById("budgetAlerts");
 const missing=[],overspent=[];
 for(const category of visibleExpenseCategories()){
  const actual=Math.round((m.expMap[category.id]||0)*100);
  const planned=Math.round((category.budget||0)*100);
  if(actual<=0)continue;
  if(planned===0)missing.push(category.name);
  else if(actual>planned)overspent.push(category.name+" (+"+euro((actual-planned)/100)+")");
 }
 const unknown=m.tx.filter(t=>t.type==="expense"&&!catById(t.category,t.type)).length;
 const messages=[];
 if(missing.length)messages.push("Dépenses sans budget · "+missing.join(", "));
 if(overspent.length)messages.push("Budgets dépassés · "+overspent.join(", "));
 if(unknown)messages.push(unknown+" dépense"+(unknown>1?"s":"")+" à catégoriser");
 panel.hidden=!messages.length;
 panel.replaceChildren(...messages.map(text=>{const p=document.createElement("p");p.textContent=text;return p}));
}
