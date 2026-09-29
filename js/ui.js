// V2.3 — rendu général, historique, menus et navigation
function render(){
 const m=metrics();
 document.getElementById("balanceValue").innerHTML=`${euro(m.balance).replace("€","")}<small>€</small>`;
 document.querySelector("#plannedRest .meta-value").textContent=euro(m.plannedBalance);
 const delta=m.balance-m.plannedBalance,deltaEl=document.getElementById("balanceDelta");
 deltaEl.classList.remove("positive","negative","neutral");
 deltaEl.classList.add(delta>0.005?"positive":delta<-0.005?"negative":"neutral");
 document.querySelector("#balanceDelta .meta-value").textContent=`${delta>0.005?"+":""}${euro(delta)}`;
 document.getElementById("incomeTotal").textContent=euro(m.income);document.getElementById("incomePlanned").textContent=`Prévu ${euro(m.plannedIncome)}`;
 document.getElementById("expenseTotal").textContent=euro(m.expense);document.getElementById("expensePlanned").textContent=`Budget ${euro(m.plannedExpense)}`;
 document.getElementById("saveB").textContent=euro(m.savingsB);document.getElementById("saveA").textContent=euro(m.savingsA);document.getElementById("saveBMonth").textContent=euro(m.savingsBMonth);document.getElementById("saveAMonth").textContent=euro(m.savingsAMonth);
 document.getElementById("restB").textContent=euro(m.restB);document.getElementById("restA").textContent=euro(m.restA);
 document.getElementById("personBDetail").textContent=`${euro(m.incomeB)} de revenus · ${euro(m.expenseB)} dépensés · ${euro(m.savingBShare)} épargnés`;
 document.getElementById("personADetail").textContent=`${euro(m.incomeA)} de revenus · ${euro(m.expenseA)} dépensés · ${euro(m.savingAShare)} épargnés`;
 renderSections(m);renderTop(m);renderRecent(m);renderCategories(m);renderHistory(m);renderTracking();
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
function categoryRow(c,actual,type){const isSaving=type==="expense"&&!!c.saving,actualLabel=type==="income"?"Modifier le montant réel reçu":isSaving?"Modifier le montant réellement épargné":"Modifier le montant réel dépensé";return `<div class="cat-item"><div class="cat-line"><div class="cat-name">${escapeHtml(c.name)}</div><div class="cat-side"><div class="cat-amount">${euro(actual)}</div><button class="edit-budget" type="button" data-edit-actual="${escapeHtml(c.id)}" data-category-type="${type}" aria-label="${actualLabel} pour ${escapeHtml(c.name)}" title="Modifier le réel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></div></div><div class="cat-meta"><span class="cat-planned">Prévu ${euro(c.budget)}<button class="edit-planned" type="button" data-edit-planned="${escapeHtml(c.id)}" data-category-type="${type}" aria-label="Modifier le budget prévu de ${escapeHtml(c.name)}" title="Modifier le prévu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="delete-category" type="button" data-delete-category="${escapeHtml(c.id)}" data-category-type="${type}" aria-label="Supprimer ${escapeHtml(c.name)}" title="Supprimer ce champ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button></span><span>${ownerLabel(c.owner)}</span></div></div>`}
function archivedCategoryRow(c,actual,type){return `<div class="cat-item archived"><div class="cat-line"><div class="cat-name">${escapeHtml(c.name)} <span class="archive-badge">Archivée</span></div><div class="cat-amount">${euro(actual)}</div></div><div class="cat-meta"><span>Mouvements conservés pour expliquer le total</span><span>${ownerLabel(transactionOwner({category:c.id,type,date:`${monthKey(state.selectedMonth)}-01`}))}</span></div></div>`}
function archivedCategoriesFor(type,section,m){const base=type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES,legacy=Object.values(LEGACY_CATEGORY_DEFS).filter(c=>c.type===type),list=[...base,...legacy],totals=type==="income"?m.incMap:m.expMap;return list.filter(c=>{if(type==="expense"){if(section==="__savings__"&&!c.saving)return false;if(section!=="__savings__"&&(c.saving||c.section!==section))return false}const hidden=c.legacy||!isCategoryVisible(c.id,state.selectedMonth,type);return hidden&&Math.abs(totals[c.id]||0)>.005}).map(c=>c.legacy?c:categoryView(c,type))}
function archivedBlock(cats,totals,type){return cats.length?`<div class="archived-wrap"><div class="archived-label">Archivées ce mois</div>${cats.map(c=>archivedCategoryRow(c,totals[c.id]||0,type)).join("")}</div>`:""}
function categoryBulkButtons(type,section,label){return `<div class="cat-section-actions"><button class="cat-bulk fill" type="button" data-bulk-action="fill" data-category-type="${type}" data-section="${escapeHtml(section||"")}" title="Mettre tous les montants réels au niveau du prévu" aria-label="Tout remplir dans ${escapeHtml(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 6.5"/></svg><span>Tout remplir</span></button><button class="cat-bulk clear" type="button" data-bulk-action="clear" data-category-type="${type}" data-section="${escapeHtml(section||"")}" title="Remettre tous les montants réels à zéro" aria-label="Tout vider dans ${escapeHtml(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M18 7l-1 12H7L6 7"/></svg><span>Tout vider</span></button></div>`}
function renderCategories(m){
 const incomeCats=visibleIncomeCategories(),incomeActual=m.income,incomePlanned=sum(incomeCats.map(c=>c.budget));
 const incomeArchived=archivedCategoriesFor("income","",m),incomeCard=`<article class="card cat-section income-card"><div class="cat-section-head"><div class="cat-section-title">Revenus<div class="cat-section-total">${euro(incomeActual)} / ${euro(incomePlanned)}</div></div>${categoryBulkButtons("income","","Revenus")}</div><div class="income-list">${incomeCats.map(c=>categoryRow(c,m.incMap[c.id]||0,"income")).join("")}</div>${archivedBlock(incomeArchived,m.incMap,"income")}<button class="add-category" type="button" data-add-category="Revenus" data-category-type="income">＋ Ajouter un champ</button></article>`;
 const sections=["Obligatoires","Abonnements","Vie courante"];
 const expenseCards=sections.map(section=>{const cats=visibleExpenseCategories().filter(c=>c.section===section),archived=archivedCategoriesFor("expense",section,m),actual=sum(EXPENSE_CATEGORIES.filter(c=>!c.saving&&c.section===section).map(c=>m.expMap[c.id]||0))+sum(Object.values(LEGACY_CATEGORY_DEFS).filter(c=>c.type==="expense"&&c.section===section).map(c=>m.expMap[c.id]||0)),planned=sum(cats.map(c=>c.budget));return `<article class="card cat-section"><div class="cat-section-head"><div class="cat-section-title">${section}<div class="cat-section-total">${euro(actual)} / ${euro(planned)}</div></div>${categoryBulkButtons("expense",section,section)}</div>${cats.map(c=>categoryRow(c,m.expMap[c.id]||0,"expense")).join("")}${archivedBlock(archived,m.expMap,"expense")}<button class="add-category" type="button" data-add-category="${section}" data-category-type="expense">＋ Ajouter un champ</button></article>`}).join("");
 const savingCats=visibleSavingCategories(),savingArchived=archivedCategoriesFor("expense","__savings__",m),savingActual=m.saving,savingPlanned=sum(savingCats.map(c=>c.budget));
 const savingCard=`<article class="card cat-section saving-card"><div class="cat-section-head"><div class="cat-section-title">Épargne<div class="cat-section-total">${euro(savingActual)} / ${euro(savingPlanned)}</div></div>${categoryBulkButtons("expense","__savings__","Épargne")}</div><div class="income-list">${savingCats.map(c=>categoryRow(c,m.expMap[c.id]||0,"expense")).join("")}</div>${archivedBlock(savingArchived,m.expMap,"expense")}<button class="add-category saving-add" type="button" data-add-saving="1">＋ Ajouter une épargne</button></article>`;
 document.getElementById("categoryGrid").innerHTML=`<section class="category-group"><div class="category-group-head"><h2>Revenus</h2><span>Entrées d’argent · réel / prévu</span></div><div class="category-cards income-cards">${incomeCard}</div></section><section class="category-group"><div class="category-group-head"><h2>Dépenses</h2><span>Argent réellement consommé · hors épargne</span></div><div class="category-cards">${expenseCards}</div></section><section class="category-group saving-group"><div class="category-group-head"><h2>Épargne</h2><span>Argent mis de côté · déduit du disponible</span></div><div class="category-cards income-cards">${savingCard}</div></section>`;
}
function personName(owner){return owner==="B"?(state.household?.personB||"Personne 1"):owner==="A"?(state.household?.personA||"Personne 2"):"À deux"}
function ownerLabel(o){return o==="common"?"À deux":personName(o)}
function syncHouseholdUi(){
 const household=normalizeHousehold(state.household);state.household=household;
 document.querySelectorAll("[data-person-label]").forEach(el=>{const owner=el.dataset.personLabel;el.textContent=personName(owner)});
 document.querySelectorAll("[data-person-avatar]").forEach(el=>{const name=personName(el.dataset.personAvatar);el.textContent=(name.trim()[0]||"?").toUpperCase()});
 const title=document.getElementById("householdTitle");if(title)title.textContent=household.name||"Budget foyer";
}
function renderHistory(m){const entries=historyEntries(m);document.getElementById("historyList").innerHTML=entries.length?entries.map(entry=>{if(entry.group){const p=groupPresentation(entry),date=new Date((entry.date||transactionDateForSelectedMonth())+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});return `<div class="history-group" data-history-group="${entry.id}"><div class="history-row"><div class="history-icon ${p.type}">${p.icon}</div><div><div class="history-title">${escapeHtml(entry.label)}</div><div class="history-date">${entry.tx.length} opérations · ${date} <button class="history-toggle" type="button" data-toggle-group="${entry.id}">Voir le détail</button></div></div><div class="history-amount row-value ${p.cls}">${p.prefix}${euro(Math.abs(p.amount))}</div><div class="history-actions"><button class="history-delete" title="Supprimer ce groupe" data-delete-group="${entry.id}" aria-label="Supprimer ce groupe">×</button></div></div><div class="history-group-details">${entry.tx.map(t=>{const tp=transactionPresentation(t);return `<div class="history-detail-row"><span>${escapeHtml(transactionTitle(t))}</span><strong>${tp.prefix}${euro(Math.abs(tp.amount))}</strong></div>`}).join("")}</div></div>`}const t=entry.tx,p=transactionPresentation(t),recurring=!!t.recurringOccurrence||t.scope==="forward",actions=recurring?`<div class="history-actions"><button class="history-edit" type="button" title="Modifier la récurrence" aria-label="Modifier la récurrence" data-edit-recurring="${t.sourceId||t.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="history-delete" title="Supprimer la récurrence" aria-label="Supprimer la récurrence" data-delete-recurring="${t.sourceId||t.id}">×</button></div>`:`<div class="history-actions"><button class="history-edit" type="button" title="Modifier l’opération" aria-label="Modifier l’opération" data-edit-transaction="${t.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="history-delete" title="Supprimer" aria-label="Supprimer l’opération" data-delete="${t.id}">×</button></div>`;return `<div class="history-row"><div class="history-icon ${p.saving?'saving':t.type}">${p.icon}</div><div><div class="history-title">${escapeHtml(transactionTitle(t))}</div><div class="history-date">${transactionContext(t,false)}</div></div><div class="history-amount row-value ${p.cls}">${p.prefix}${euro(Math.abs(p.amount))}</div>${actions}</div>`}).join(""):`<div class="empty">Aucune opération sur ce mois.</div>`}


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
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));btn.classList.add("active");document.getElementById(btn.dataset.tab).classList.add("active")}));
