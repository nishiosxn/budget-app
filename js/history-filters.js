// V2.9 — filtres d'historique en mémoire uniquement ; aucune écriture cloud.
const historyFilterState={query:"",type:"all",owner:"all",category:"all",sort:"newest"};

function historySearchable(value){
 return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").trim();
}
function historyOperationType(tx){
 if(tx.type==="income")return "income";
 return catById(tx.category,tx.type)?.saving?"saving":"expense";
}
function historyTransactionMatches(tx){
 if(historyFilterState.type!=="all"&&historyOperationType(tx)!==historyFilterState.type)return false;
 if(historyFilterState.owner!=="all"&&transactionOwner(tx)!==historyFilterState.owner)return false;
 if(historyFilterState.category!=="all"&&tx.category!==historyFilterState.category)return false;
 if(historyFilterState.query){
  const cat=catById(tx.category,tx.type);
  const searchable=historySearchable([
   transactionTitle(tx),tx.label,tx.adjustmentLabel,cat?.name,
   ownerLabel(transactionOwner(tx))
  ].join(" "));
  if(!searchable.includes(historySearchable(historyFilterState.query)))return false;
 }
 return true;
}
function historyUpdateCategoryOptions(tx){
 const select=document.getElementById("historyCategoryFilter");
 if(!select)return;
 const options=new Map();
 for(const t of tx||[]){
  if(!t.category)continue;
  options.set(t.category,catById(t.category,t.type)?.name||"Catégorie");
 }
 const entries=[...options].sort((a,b)=>a[1].localeCompare(b[1],"fr"));
 const markup='<option value="all">Toutes les catégories</option>'+entries.map(
  ([id,name])=>'<option value="'+escapeHtml(id)+'">'+escapeHtml(name)+'</option>'
 ).join("");
 if(select.innerHTML!==markup)select.innerHTML=markup;
 if(historyFilterState.category!=="all"&&!options.has(historyFilterState.category))historyFilterState.category="all";
 select.value=historyFilterState.category;
}
function filterHistoryEntries(entries,metricsForHistory){
 historyUpdateCategoryOptions(metricsForHistory.tx);
 const filtered=[];
 for(const entry of entries){
  if(!entry.group){
   if(historyTransactionMatches(entry.tx))filtered.push(entry);
   continue;
  }
  const matched=entry.tx.filter(historyTransactionMatches);
  if(matched.length)filtered.push({...entry,tx:matched});
 }
 const magnitude=entry=>Math.abs(entry.group
  ?entry.tx.reduce((n,t)=>n+(Number(t.amount)||0),0)
  :Number(entry.tx.amount)||0);
 const date=entry=>String(entry.date||"");
 const sort=historyFilterState.sort;
 if(sort==="oldest")filtered.sort((a,b)=>date(a).localeCompare(date(b))||String(a.id||"").localeCompare(String(b.id||"")));
 else if(sort==="amount-desc")filtered.sort((a,b)=>magnitude(b)-magnitude(a)||date(b).localeCompare(date(a)));
 else if(sort==="amount-asc")filtered.sort((a,b)=>magnitude(a)-magnitude(b)||date(b).localeCompare(date(a)));
 const matchedCount=filtered.reduce((n,entry)=>n+(entry.group?entry.tx.length:1),0);
 const total=entries.reduce((n,entry)=>n+(entry.group?entry.tx.length:1),0);
 const count=document.getElementById("historyResultsCount");
 if(count)count.textContent=matchedCount+" sur "+total+" opération"+(total>1?"s":"");
 const personB=document.querySelector('#historyOwnerFilter option[value="B"]');
 const personA=document.querySelector('#historyOwnerFilter option[value="A"]');
 if(personB)personB.textContent=personName("B");
 if(personA)personA.textContent=personName("A");
 const clear=document.getElementById("historyResetFilters");
 if(clear)clear.hidden=historyFilterState.query===""&&historyFilterState.type==="all"
  &&historyFilterState.owner==="all"&&historyFilterState.category==="all"
  &&historyFilterState.sort==="newest";
 return filtered;
}
function historyApplyFilterChange(){
 if(typeof renderHistory==="function"&&typeof metrics==="function")renderHistory(metrics());
}
document.getElementById("historySearch")?.addEventListener("input",event=>{
 historyFilterState.query=event.target.value;
 historyApplyFilterChange();
});
for(const [id,key] of [
 ["historyTypeFilter","type"],["historyOwnerFilter","owner"],
 ["historyCategoryFilter","category"],["historySortFilter","sort"]
]){
 document.getElementById(id)?.addEventListener("change",event=>{
  historyFilterState[key]=event.target.value;
  historyApplyFilterChange();
 });
}
document.getElementById("historyResetFilters")?.addEventListener("click",()=>{
 Object.assign(historyFilterState,{query:"",type:"all",owner:"all",category:"all",sort:"newest"});
 document.getElementById("historySearch").value="";
 for(const [id,value] of [
  ["historyTypeFilter","all"],["historyOwnerFilter","all"],
  ["historyCategoryFilter","all"],["historySortFilter","newest"]
 ])document.getElementById(id).value=value;
 historyApplyFilterChange();
});
