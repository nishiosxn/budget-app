/* Smart Budget — répartition des budgets prévus (lecture seule).
 * Aucune écriture de données : les filtres restent locaux à l'interface.
 */
(function exposeCategoryDistribution(root){
 "use strict";
 const ui={scope:"expense",level:"family",sort:"amount",selected:null,hovered:null,showChanges:false,items:[],month:""};
 const sectionOrder=["Obligatoires","Abonnements","Vie courante","Autres"];
 const familyColors={"Obligatoires":"#7665D9","Abonnements":"#4E9DB1","Vie courante":"#BA8669","Autres":"#8893A0"};
 const incomeColors=["#7665D9","#4E9DB1","#BA8669","#A48DD8","#689B80","#C38C9B","#87929F"];
 const categoryColors=["#7665D9","#9C8BE2","#4E9DB1","#74B6C5","#BA8669","#D2A785","#8F9AA5"];
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const cents=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.round(n*100)):0};
 const money=value=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value/100);
 const pct=(n,total)=>total>0?n/total*100:0;
 const percent=(n,total)=>{const p=pct(n,total);return p>0&&p<1?"< 1 %":new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(p)+" %"};
 const monthName=key=>new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(key+"-01T12:00:00Z"));
 const hash=s=>[...String(s)].reduce((v,c)=>(v*31+c.codePointAt(0))>>>0,7);
 const normalize=(items,type)=>{const seen=new Set();return (items||[]).filter(c=>{
  if(!c||typeof c.id!=="string"||!c.id||seen.has(c.id)||type==="expense"&&c.saving)return false;
  seen.add(c.id);return true;
 }).map((c,index)=>({id:c.id,name:String(c.name||"Catégorie"),type,section:type==="income"?"Revenus":sectionOrder.includes(c.section)?c.section:"Autres",
  amount:cents(c.budget),order:index}))};
 function groupItems(entries){
  const grouped=new Map();
  for(const c of entries){
   const g=grouped.get(c.section)||{key:"family:"+c.section,name:c.section,color:familyColors[c.section]||familyColors.Autres,
    amount:0,ids:[],order:sectionOrder.indexOf(c.section),type:"expense"};
   g.amount+=c.amount;g.ids.push(c.id);grouped.set(c.section,g);
  }
  return [...grouped.values()].filter(g=>g.amount>0);
 }
 function categoryItems(entries,type){
  return entries.filter(c=>c.amount>0).map(c=>({key:type+":"+c.id,name:c.name,amount:c.amount,
   color:type==="income"?incomeColors[hash(c.id)%incomeColors.length]:categoryColors[hash(c.id)%categoryColors.length],
   ids:[c.id],order:c.order,type}));
 }
 function arrange(items,sort){
  return [...items].sort(sort==="order"?(a,b)=>a.order-b.order:(a,b)=>b.amount-a.amount||a.order-b.order);
 }
 function limitSegments(items,type){
  if(items.length<=7)return items;
  const visible=items.slice(0,6),rest=items.slice(6);
  const sum=rest.reduce((n,c)=>n+c.amount,0);
  return [...visible,{key:"other:"+type,name:"Autres catégories",amount:sum,ids:rest.flatMap(c=>c.ids),
   color:"#89929E",order:999,type}];
 }
 function changesFor(current,previous){
  if(!previous)return [];
  const old=new Map(previous.map(c=>[c.id,c]));
  const now=new Map(current.map(c=>[c.id,c]));
  const changed=[];
  for(const id of new Set([...old.keys(),...now.keys()])){
   const before=old.get(id)?.amount||0,after=now.get(id)?.amount||0;
   if(before!==after)changed.push({id,name:now.get(id)?.name||old.get(id)?.name||"Catégorie",before,after,delta:after-before});
  }
  return changed.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.name.localeCompare(b.name,"fr"));
 }
 function buildModel({expenses=[],incomes=[],previousExpenses=null,previousIncomes=null,scope="expense",level="family",sort="amount"}={}){
  const expense=normalize(expenses,"expense"),income=normalize(incomes,"income");
  const base=scope==="income"?income:expense;
  const prev=scope==="income"?(previousIncomes?normalize(previousIncomes,"income"):null):(previousExpenses?normalize(previousExpenses,"expense"):null);
  const total=base.reduce((n,c)=>n+c.amount,0);
  const byCategory=categoryItems(base,scope);
  const all=scope==="income"?byCategory:level==="family"?groupItems(expense):byCategory;
  const items=limitSegments(arrange(all,sort),scope);
  const changes=changesFor(base,prev);
  const previousTotal=prev?.reduce((n,c)=>n+c.amount,0)??null;
  return {items,total,count:base.filter(c=>c.amount>0).length,changes,previousTotal,
   delta:previousTotal===null?null:total-previousTotal,scope,level,sort};
 }
 function modelFromApp(){
  if(typeof visibleExpenseCategories!=="function"||typeof visibleIncomeCategories!=="function"||
   typeof previousMonthKey!=="function"||typeof monthKey!=="function"||typeof state==="undefined")return null;
  const month=monthKey(state.selectedMonth),previous=previousMonthKey(month);
  const baseline=typeof state.createdMonth==="string"?state.createdMonth:"";
  return {month,model:buildModel({expenses:visibleExpenseCategories(),incomes:visibleIncomeCategories(),
   previousExpenses:previous>=baseline?visibleExpenseCategories(previous):null,
   previousIncomes:previous>=baseline?visibleIncomeCategories(previous):null,
   scope:ui.scope,level:ui.level,sort:ui.sort})};
 }
 function selection(){return ui.items.find(item=>item.key===ui.selected)||null}
 function filter(){
  const selected=selection();
  return selected?{type:ui.scope,ids:[...selected.ids],label:selected.name}:null;
 }
 function itemMarkup(item,total){
  const title=item.name+" · "+money(item.amount)+" · "+percent(item.amount,total);
  const selected=ui.selected===item.key?" is-active":"";
  return '<button type="button" class="bd-segment'+selected+'" data-bd-key="'+esc(item.key)+'"'+
   ' aria-label="'+esc(title)+'" aria-pressed="'+String(ui.selected===item.key)+'"'+
   ' style="--bd-segment-color:'+item.color+';flex-grow:'+item.amount+'"></button>';
 }
 function legendMarkup(item,total){
  const selected=ui.selected===item.key?" is-active":"";
  return '<button type="button" class="bd-legend-row'+selected+'" data-bd-key="'+esc(item.key)+'"'+
   ' aria-label="Afficher '+esc(item.name)+' dans les catégories" aria-pressed="'+String(ui.selected===item.key)+'">'+
   '<span class="bd-color" style="background:'+item.color+'"></span><span class="bd-legend-name">'+esc(item.name)+'</span>'+
   '<strong class="bd-legend-amount">'+esc(money(item.amount))+'</strong><span class="bd-legend-percent">'+esc(percent(item.amount,total))+'</span>'+
   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>';
 }
 function summaryMarkup(item,model){
  if(!item)return "";
  const single=item.ids.length===1,kind=ui.scope==="income"?"revenu":"dépense";
  return '<div class="bd-selection" role="status"><div class="bd-selection-heading"><strong>'+esc(item.name)+'</strong>'+
   '<button type="button" class="bd-clear" data-bd-action="clear" aria-label="Retirer le filtre">Effacer le filtre ×</button></div>'+
   '<p>'+esc(money(item.amount))+' · '+esc(percent(item.amount,model.total))+' du total'+
   (single?"":" · "+item.ids.length+" catégories")+'</p>'+
   (single?'<div class="bd-selection-actions"><button type="button" class="bd-action bd-action-secondary" data-bd-action="edit">Modifier le budget</button></div>':"")+
   '<span class="sr-only">Filtre appliqué à la liste des catégories de '+kind+'.</span></div>';
 }
 function changesMarkup(model,month){
  if(!model.changes.length)return "";
  const sign=model.delta>0?"+":model.delta<0?"−":"";
  const delta=Math.abs(model.delta);
  const deltaLabel=model.delta===0?"Total inchangé":sign+money(delta);
  const visible=ui.showChanges;
  return '<div class="bd-changes"><button type="button" class="bd-changes-trigger" data-bd-action="changes" aria-expanded="'+visible+'">'+
   '<span><strong>'+model.changes.length+' enveloppe'+(model.changes.length>1?"s":"")+' modifiée'+(model.changes.length>1?"s":"")+'</strong>'+
   '<small>Par rapport à '+esc(monthName(previousMonthKey(month)))+'</small></span><span class="bd-changes-delta">'+esc(deltaLabel)+
   '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'+
   (visible?'<div class="bd-changes-list">'+model.changes.map(c=>'<div class="bd-change">'+
    '<span>'+esc(c.name)+'</span><span>'+esc(money(c.before))+' → <strong>'+esc(money(c.after))+'</strong></span>'+
    '</div>').join("")+'</div>':"")+'</div>';
 }
 function renderBudgetCard(){
  if(typeof document==="undefined")return;
  const host=document.getElementById("categoryDistribution");if(!host)return;
  const resolved=modelFromApp();if(!resolved)return;
  const {month,model}=resolved;
  ui.items=model.items;ui.month=month;
  if(ui.selected&&!selection())ui.selected=null;
  const income=ui.scope==="income",active=selection();
  host.innerHTML='<div class="bd-heading"><h2>Répartition des budgets</h2></div>'+
   '<div class="bd-toolbar" role="group" aria-label="Afficher les budgets de dépenses ou de revenus">'+
   '<button type="button" data-bd-scope="expense" aria-pressed="'+(!income)+'" class="'+(!income?"is-active":"")+'">Dépenses</button>'+
   '<button type="button" data-bd-scope="income" aria-pressed="'+income+'" class="'+(income?"is-active":"")+'">Revenus</button></div>'+
   '<div class="bd-total"><div><strong>'+esc(money(model.total))+'</strong><span>Budget prévu</span></div></div>'+
   (model.total>0?'<div class="bd-track-wrap"><div class="bd-track" role="group" aria-label="Répartition interactive des budgets">'+
    model.items.map(item=>itemMarkup(item,model.total)).join("")+'</div><div class="bd-tooltip" role="tooltip" hidden></div></div>':
    '<div class="bd-empty"><strong>Aucun budget prévu.</strong>'+
    '<button type="button" class="bd-action" data-bd-action="view">Voir les catégories</button></div>')+
   '<div class="bd-subtoolbar">'+
   (!income?'<div class="bd-level" role="group" aria-label="Niveau de détail">'+
   '<button type="button" data-bd-level="family" aria-pressed="'+(ui.level==="family")+'" class="'+(ui.level==="family"?"is-active":"")+'">Par famille</button>'+
   '<button type="button" data-bd-level="category" aria-pressed="'+(ui.level==="category")+'" class="'+(ui.level==="category"?"is-active":"")+'">Par catégorie</button></div>':'<div class="bd-level bd-level-placeholder" aria-hidden="true"><span>Par famille</span><span>Par catégorie</span></div>')+
   '<div class="bd-sort"><span>Trier</span><div class="bd-sort-picker">'+
   '<button type="button" class="bd-sort-trigger" data-bd-sort-trigger aria-haspopup="listbox" aria-expanded="false">'+
   '<span>'+(ui.sort==="amount"?"Par montant":"Ordre des catégories")+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'+
   '<div class="bd-sort-menu" data-bd-sort-menu role="listbox" aria-label="Trier les budgets" hidden>'+
   '<button type="button" role="option" data-bd-sort-option="amount" aria-selected="'+(ui.sort==="amount")+'">Par montant</button>'+
   '<button type="button" role="option" data-bd-sort-option="order" aria-selected="'+(ui.sort==="order")+'">Ordre des catégories</button>'+
   '</div></div></div></div>'+
   (model.total>0?'<div class="bd-legend" aria-label="Détail des budgets">'+model.items.map(item=>legendMarkup(item,model.total)).join("")+'</div>':"")+
   summaryMarkup(active,model)+changesMarkup(model,month);
 }
 function updateGrid(){if(typeof renderCategories==="function"&&typeof metrics==="function")renderCategories(metrics())}
 function chooseBudgetSegment(key){
  if(!ui.items.some(item=>item.key===key))return;
  ui.selected=ui.selected===key?null:key;ui.hovered=null;renderBudgetCard();updateGrid();
 }
 function tooltipFor(key){
  if(typeof document==="undefined")return;
  const host=document.getElementById("categoryDistribution");
  if(!host)return;
  host.querySelectorAll("[data-bd-key]").forEach(node=>{
   node.classList.toggle("is-previewed",node.dataset.bdKey===key);
   node.classList.toggle("is-dimmed",!!key&&node.dataset.bdKey!==key);
  });
  const tip=host.querySelector(".bd-tooltip"),track=host.querySelector(".bd-track");
  if(!tip||!track)return;
  const item=ui.items.find(v=>v.key===key);
  if(!item){tip.hidden=true;return}
  const total=ui.items.reduce((n,v)=>n+v.amount,0);
  tip.innerHTML='<strong>'+esc(item.name)+'</strong><span>'+esc(money(item.amount))+'</span><small>'+
   esc(percent(item.amount,total))+' · '+item.ids.length+' catégorie'+(item.ids.length>1?"s":"")+'</small>';
  const seg=[...track.querySelectorAll("[data-bd-key]")].find(el=>el.dataset.bdKey===key);
  const wrap=host.querySelector(".bd-track-wrap");
  if(seg&&wrap){
   const rect=seg.getBoundingClientRect(),container=wrap.getBoundingClientRect();
   tip.style.left=Math.max(80,Math.min(container.width-80,rect.left-container.left+rect.width/2))+"px";
  }
  tip.hidden=false;
 }
 function scrollToCategories(){
  const target=document.getElementById("categoryGrid");
  if(!target)return;
  const selected=selection(),id=selected?.ids.length===1?selected.ids[0]:null;
  const row=id?[...target.querySelectorAll("[data-category-row]")].find(el=>el.dataset.categoryRow===id):null;
  const el=row||target.querySelector(".category-group")||target;
  el.setAttribute("tabindex","-1");el.focus({preventScroll:true});
  el.scrollIntoView({behavior:root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth",block:"start"});
 }
 function closeSort(host,focus=false){
  const menu=host.querySelector("[data-bd-sort-menu]"),trigger=host.querySelector("[data-bd-sort-trigger]");
  if(!menu||!trigger)return;
  menu.hidden=true;trigger.setAttribute("aria-expanded","false");
  if(focus)trigger.focus();
 }
 function openSort(host){
  const menu=host.querySelector("[data-bd-sort-menu]"),trigger=host.querySelector("[data-bd-sort-trigger]");
  if(!menu||!trigger)return;
  menu.hidden=false;trigger.setAttribute("aria-expanded","true");
  (menu.querySelector('[aria-selected="true"]')||menu.querySelector("button"))?.focus();
 }
 function attach(){
  if(typeof document==="undefined")return;
  const host=document.getElementById("categoryDistribution");
  if(!host||host.dataset.bound==="1")return;
  host.dataset.bound="1";
  host.addEventListener("click",event=>{
   const b=event.target.closest("button");if(!b||!host.contains(b))return;
   if(b.dataset.bdSortTrigger!==undefined){
    const menu=host.querySelector("[data-bd-sort-menu]");
    if(menu?.hidden)openSort(host);else closeSort(host,true);
    return;
   }
   if(b.dataset.bdSortOption!==undefined){
    ui.sort=b.dataset.bdSortOption==="order"?"order":"amount";
    renderBudgetCard();updateGrid();
    host.querySelector("[data-bd-sort-trigger]")?.focus();
    return;
   }
   if(b.dataset.bdScope){ui.scope=b.dataset.bdScope;ui.selected=null;ui.showChanges=false;renderBudgetCard();updateGrid();return}
   if(b.dataset.bdLevel){ui.level=b.dataset.bdLevel;ui.selected=null;renderBudgetCard();updateGrid();return}
   if(b.dataset.bdKey){chooseBudgetSegment(b.dataset.bdKey);return}
   const action=b.dataset.bdAction;
   if(action==="clear"){ui.selected=null;renderBudgetCard();updateGrid()}
   else if(action==="changes"){ui.showChanges=!ui.showChanges;renderBudgetCard()}
   else if(action==="view"){scrollToCategories()}
   else if(action==="edit"){
    const selected=selection(),id=selected?.ids.length===1?selected.ids[0]:null;
    if(id&&typeof openCategoryEditor==="function")openCategoryEditor(id,null,"planned",ui.scope);
   }
  });
  document.addEventListener?.("pointerdown",event=>{
   if(!host.contains(event.target)||!event.target.closest(".bd-sort-picker"))closeSort(host);
  });
  host.addEventListener("pointerover",event=>{
   if(event.pointerType==="touch")return;
   const node=event.target.closest("[data-bd-key]");
   if(node&&host.contains(node)&&ui.hovered!==node.dataset.bdKey){ui.hovered=node.dataset.bdKey;tooltipFor(ui.hovered)}
  });
  host.addEventListener("pointerout",event=>{
   if(event.pointerType==="touch")return;
   const from=event.target.closest("[data-bd-key]");
   const to=event.relatedTarget?.closest?.("[data-bd-key]");
   if(from&&!to){ui.hovered=null;tooltipFor(null)}
  });
  host.addEventListener("focusin",event=>{
   const key=event.target.closest("[data-bd-key]")?.dataset.bdKey;
   if(key){ui.hovered=key;tooltipFor(key)}
  });
  host.addEventListener("focusout",event=>{
   if(event.relatedTarget?.closest?.("[data-bd-key]"))return;
   ui.hovered=null;tooltipFor(null);
  });
  host.addEventListener("keydown",event=>{
   const menu=host.querySelector("[data-bd-sort-menu]");
   const inSort=event.target.closest(".bd-sort-picker");
   if(inSort&&event.key==="Escape"&&menu&&!menu.hidden){event.preventDefault();closeSort(host,true);return}
   if(inSort&&(event.key==="ArrowDown"||event.key==="ArrowUp")){
    event.preventDefault();
    if(menu?.hidden){openSort(host);return}
    const options=[...menu.querySelectorAll("button")],index=options.indexOf(document.activeElement);
    if(!options.length)return;
    const next=index<0?(event.key==="ArrowDown"?0:options.length-1):
     (index+(event.key==="ArrowDown"?1:options.length-1))%options.length;
    options[next]?.focus();
    return;
   }
   if(event.key==="Escape"&&ui.hovered){ui.hovered=null;tooltipFor(null)}
  });
 }
 root.SmartBudgetCategoryDistribution=Object.freeze({buildModel,render(){attach();renderBudgetCard()},filter,clear(){
  ui.selected=null;renderBudgetCard();updateGrid();
 }});
 attach();
})(globalThis);
