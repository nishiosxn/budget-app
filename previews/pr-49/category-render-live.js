/* PR49 demo: exact category renderer from published Smart Budget (2cf6d47b1cb5c075d3ecf99b10acd96a5a1bcb13)
 * and production-style 3-panel layout from PR49. No backend.
 */
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
function categoryRow(c,actual,type,m){
 const isSaving=type==="expense"&&!!c.saving,current=Number(actual)||0,planned=Number(c.budget)||0,hasPlanned=planned>.005,isEmpty=Math.abs(current)<.005,isMatched=hasPlanned&&Math.abs(current-planned)<.005;
 const actualLabel=type==="income"?"Modifier le montant réel reçu":isSaving?"Modifier le montant réellement épargné":"Modifier le montant réel dépensé";
 const stateClass=isMatched?"is-matched":isEmpty?"is-empty":"is-different";
 const quickAction=isEmpty&&hasPlanned
  ?`<button class="cat-quick-fill" type="button" data-fill-category="${escapeHtml(c.id)}" data-category-type="${type}" aria-label="Renseigner ${escapeHtml(c.name)} à ${euro(planned)}" title="Mettre le réel au prévu : ${euro(planned)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5"/></svg></button>`
  :"";
 const alignMenu=hasPlanned&&!isMatched
  ?`<button type="button" role="menuitem" data-fill-category="${escapeHtml(c.id)}" data-category-type="${type}">Mettre le réel à ${euro(planned)}</button>`
  :"";
 const details=categoryDetailsMarkup(c,type,m),open=!!details.open;
 const nameMarkup=details.count
  ?`<button class="cat-name-toggle" type="button" data-category-details-toggle="${escapeHtml(c.id)}" data-category-type="${type}" aria-expanded="${open?"true":"false"}" aria-label="${open?"Masquer":"Afficher"} les ${details.count} opération${details.count>1?"s":""} de ${escapeHtml(c.name)}"><span class="cat-name">${escapeHtml(c.name)}</span><svg class="cat-detail-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg></button>`
  :`<div class="cat-name">${escapeHtml(c.name)}</div>`;
 return `<div class="cat-item ${stateClass} ${open?"details-open":""}" data-category-row="${escapeHtml(c.id)}">
  <div class="cat-line">
   ${nameMarkup}
   <div class="cat-side">
    <button class="cat-amount cat-value-button ${stateClass}" type="button" data-edit-actual="${escapeHtml(c.id)}" data-category-type="${type}" aria-label="${actualLabel} pour ${escapeHtml(c.name)}" title="Modifier le réel">${euro(current)}</button>
    ${quickAction}
   </div>
  </div>
  <div class="cat-meta">
   <button class="cat-planned cat-planned-button" type="button" data-edit-planned="${escapeHtml(c.id)}" data-category-type="${type}" aria-label="Modifier le budget prévu de ${escapeHtml(c.name)}" title="Modifier le prévu">Prévu ${euro(planned)}</button>
   <span class="cat-meta-side"><span class="cat-owner">${escapeHtml(ownerLabel(c.owner))}</span><button class="category-menu-trigger" type="button" data-category-menu-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Plus d’actions pour ${escapeHtml(c.name)}" title="Plus d’actions">⋯</button></span>
  </div>
  ${details.html}
  <div class="category-menu" data-category-menu role="menu" hidden>
   <button type="button" role="menuitem" data-edit-actual="${escapeHtml(c.id)}" data-category-type="${type}">Modifier le réel</button>
   <button type="button" role="menuitem" data-edit-planned="${escapeHtml(c.id)}" data-category-type="${type}">Modifier le prévu et les détails</button>
   ${alignMenu}
   <button class="danger" type="button" role="menuitem" data-delete-category="${escapeHtml(c.id)}" data-category-type="${type}">Supprimer</button>
  </div>
 </div>`;
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
 return `<div class="cat-section-actions">
  <button class="cat-bulk fill" type="button" data-bulk-action="fill-empty" data-category-type="${type}" data-section="${escapeHtml(section||"")}" title="Renseigner seulement les montants encore à 0 € avec leur prévu" aria-label="Remplir les montants vides dans ${escapeHtml(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5"/></svg><span>Remplir les vides</span></button>
  <div class="cat-section-menu-wrap">
   <button class="cat-section-menu-trigger" type="button" data-section-menu-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Plus d’actions pour ${escapeHtml(label)}" title="Plus d’actions">⋯</button>
   <div class="cat-section-menu" data-section-menu role="menu" hidden>
    <button class="danger" type="button" role="menuitem" data-bulk-clear data-category-type="${type}" data-section="${escapeHtml(section||"")}" data-label="${escapeHtml(label)}">Tout vider…</button>
   </div>
  </div>
 </div>`;
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
 const incomeCard='<article class="cat-section cat-section-single income-card">'+
  '<div class="income-list">'+incomeCats.map(c=>categoryRow(c,m.incMap[c.id]||0,"income",m)).join("")+'</div>'+
  (showExtras?archivedBlock(incomeArchived,m.incMap,"income")+restorableBlock(restorableCategoriesFor("income",""),"income")+
   '<button class="add-category" type="button" data-add-category="Revenus" data-category-type="income">＋ Ajouter un champ</button>':"")+'</article>';
 const sections=["Obligatoires","Abonnements","Vie courante"];
 const expenseVisible=visibleExpenseCategories();
 if([...EXPENSE_CATEGORIES,...Object.values(LEGACY_CATEGORY_DEFS)].some(c=>!c.saving&&categorySectionOf(c)==="Autres"))sections.push("Autres");
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
  return '<article class="cat-section"><div class="cat-section-head"><div class="cat-section-title">'+escapeHtml(section)+
   '<div class="cat-section-total">'+euro(actual)+' réel · '+euro(planned)+' prévu</div></div>'+
   (showExtras?categoryBulkButtons("expense",section,section):"")+'</div>'+
   cats.map(c=>categoryRow(c,m.expMap[c.id]||0,"expense",m)).join("")+
   (showExtras?archivedBlock(archived,m.expMap,"expense")+restorableBlock(restorableCategoriesFor("expense",section),"expense")+
    '<button class="add-category" type="button" data-add-category="'+escapeHtml(section)+'" data-category-type="expense">＋ Ajouter un champ</button>':"")+'</article>';
 }).join("");
 const savingCats=visibleSavingCategories(),savingArchived=archivedCategoriesFor("expense","__savings__",m);
 const savingActual=m.saving,savingPlanned=sum(savingCats.map(c=>c.budget));
 const savingCard='<article class="cat-section cat-section-single saving-card"><div class="income-list">'+
  savingCats.map(c=>categoryRow(c,m.expMap[c.id]||0,"expense",m)).join("")+'</div>'+
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
  '<div class="cg-head-end">'+sectionFigures(savingActual,savingPlanned)+categoryBulkButtons("expense","__savings__","Épargne")+'</div></div>'+
  '<div class="category-cards income-cards">'+savingCard+'</div></section>';
 document.getElementById("categoryGrid").innerHTML=banner+
  ((!filter||filter.type==="income")?incomeGroup:"")+
  ((!filter||filter.type==="expense")?expenseGroup:"")+
  (!filter?savingGroup:"");
}
