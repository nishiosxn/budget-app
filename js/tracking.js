// V2.3 — suivi annuel, comparaisons et graphique
let trackingYear=Number(monthKey(state.selectedMonth).slice(0,4));
function labelsForYear(year){return Array.from({length:12},(_,i)=>labelFromYM(year,i+1))}
function currentMonthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function monthStatus(m){
 const now=currentMonthKey();
 if(m.key>now)return"future";
 if(m.key===now)return"current";
 return"past"
}
function hasActualActivity(m){return monthStatus(m)!=="future"&&m.tx.length>0}
function annualMetrics(year){
 const months=labelsForYear(year).map(label=>metricsForMonth(label));
 const active=months.filter(hasActualActivity);
 const actualTotal=prop=>sum(active.map(m=>Number(m[prop])||0));
 const plannedTotal=prop=>sum(months.map(m=>Number(m[prop])||0));
 return {
  year,months,active,
  income:actualTotal("income"),expense:actualTotal("expense"),saving:actualTotal("saving"),balance:actualTotal("balance"),
  plannedIncome:plannedTotal("plannedIncome"),plannedExpense:plannedTotal("plannedExpense"),plannedSaving:plannedTotal("plannedSaving"),plannedBalance:plannedTotal("plannedBalance"),
  incomeB:actualTotal("incomeB"),incomeA:actualTotal("incomeA"),expenseB:actualTotal("expenseB"),expenseA:actualTotal("expenseA"),
  savingB:actualTotal("savingBShare"),savingA:actualTotal("savingAShare"),restB:actualTotal("restB"),restA:actualTotal("restA")
 }
}
function formatSignedEuro(v){return `${v>0.005?"+":""}${euro(v)}`}
function trendClass(v,positiveIsGood=true){if(Math.abs(v)<.005)return"neutral";const good=positiveIsGood?v>0:v<0;return good?"positive":"negative"}
function monthShort(label){return label.split(" ")[0].slice(0,4).replace("é","e").replace("û","u")}
function renderTrackingChart(months){
 const host=document.getElementById("trackingChart");if(!host)return;
 const actualMonths=months.filter(hasActualActivity),values=[...months.map(m=>m.plannedBalance),...actualMonths.map(m=>m.balance)],max=Math.max(1,...values.map(v=>Math.abs(Number(v)||0)));
 const W=900,H=270,pad={l:54,r:18,t:18,b:42},innerW=W-pad.l-pad.r,innerH=H-pad.t-pad.b,zeroY=pad.t+innerH/2,scale=(innerH/2-12)/max;
 const x=i=>pad.l+(innerW*(i/(months.length-1||1))),y=v=>zeroY-(Number(v)||0)*scale;
 const planned=months.map((m,i)=>`${x(i)},${y(m.plannedBalance)}`).join(" ");
 const realPoints=months.map((m,i)=>hasActualActivity(m)?{m,i}:null).filter(Boolean),real=realPoints.map(({m,i})=>`${x(i)},${y(m.balance)}`).join(" ");
 const grid=[-1,-.5,0,.5,1].map(f=>{const yy=zeroY-f*(innerH/2-12),val=f*max;return `<line class="${f===0?"chart-zero-line":"chart-grid-line"}" x1="${pad.l}" x2="${W-pad.r}" y1="${yy}" y2="${yy}"/><text class="chart-axis-label" x="${pad.l-8}" y="${yy+3}" text-anchor="end">${Math.round(val)} €</text>`}).join("");
 const labels=months.map((m,i)=>`<text class="chart-month-label" x="${x(i)}" y="${H-12}" text-anchor="middle">${monthShort(m.label)}</text>`).join("");
 const realPts=realPoints.map(({m,i})=>`<circle class="chart-real-point" cx="${x(i)}" cy="${y(m.balance)}" r="4"><title>${m.label} · Réel ${euro(m.balance)}</title></circle>`).join("");
 const plannedPts=months.map((m,i)=>`<circle class="chart-planned-point" cx="${x(i)}" cy="${y(m.plannedBalance)}" r="3"><title>${m.label} · Prévu ${euro(m.plannedBalance)}</title></circle>`).join("");
 host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du reste mensuel réel et prévu"><g>${grid}</g><polyline class="chart-planned-line" points="${planned}"/>${realPoints.length>1?`<polyline class="chart-real-line" points="${real}"/>`:""}${plannedPts}${realPts}${labels}</svg>`;
}
function renderTracking(){
 const yearEl=document.getElementById("trackingYear");if(!yearEl)return;
 const a=annualMetrics(trackingYear),activeCount=a.active.length;
 yearEl.textContent=String(trackingYear);
 document.getElementById("yearIncome").textContent=euro(a.income);
 document.getElementById("yearExpense").textContent=euro(a.expense);
 document.getElementById("yearSaving").textContent=euro(a.saving);
 document.getElementById("yearBalance").textContent=euro(a.balance);
 document.getElementById("yearIncomeDelta").textContent=`Prévu année ${euro(a.plannedIncome)}`;
 document.getElementById("yearExpenseDelta").textContent=`Prévu année ${euro(a.plannedExpense)}`;
 document.getElementById("yearSavingDelta").textContent=`Prévu année ${euro(a.plannedSaving)}`;
 document.getElementById("yearBalanceAverage").textContent=activeCount?`Moyenne ${euro(a.balance/activeCount)} / mois renseigné`:"Aucun mois renseigné";
 document.getElementById("yearRestB").textContent=euro(a.restB);
 document.getElementById("yearRestA").textContent=euro(a.restA);
 document.getElementById("yearPersonBDetail").textContent=`${euro(a.incomeB)} de revenus · ${euro(a.expenseB)} dépensés · ${euro(a.savingB)} épargnés`;
 document.getElementById("yearPersonADetail").textContent=`${euro(a.incomeA)} de revenus · ${euro(a.expenseA)} dépensés · ${euro(a.savingA)} épargnés`;
 const selectedKey=monthKey(state.selectedMonth);
 let actualCumulative=0,forecastCumulative=0;
 document.getElementById("trackingMonths").innerHTML=a.months.map((m,i)=>{
   const status=monthStatus(m),future=status==="future",hasActual=hasActualActivity(m);
   if(hasActual)actualCumulative+=m.balance;
   forecastCumulative+=future?m.plannedBalance:(hasActual?m.balance:0);
   const prevActual=[...a.months.slice(0,i)].reverse().find(hasActualActivity);
   const delta=hasActual&&prevActual?m.balance-prevActual.balance:null,trend=delta==null?"neutral":trendClass(delta,true);
   const shownIncome=future?m.plannedIncome:m.income,shownExpense=future?m.plannedExpense:m.expense,shownSaving=future?m.plannedSaving:m.saving,shownBalance=future?m.plannedBalance:m.balance,shownCumulative=future?forecastCumulative:actualCumulative;
   const badge=future?'<span class="month-status future">À venir · prévu</span>':status==="current"?'<span class="month-status current">En cours</span>':hasActual?'<span class="month-status done">Réalisé</span>':'<span class="month-status empty">Non renseigné</span>';
   const trendText=future?"Prévision":delta==null?"—":Math.abs(delta)<.005?"0 €":formatSignedEuro(delta);
   return `<div class="tracking-month-row ${future?"future":""} ${!hasActual&&!future?"empty":""} ${m.key===selectedKey?"current-selected":""}">
     <span class="month-name"><span>${m.label}</span>${badge}</span>
     <span class="money ${future?"planned-value":""}">${euro(shownIncome)}</span>
     <span class="money ${future?"planned-value":""}">${euro(shownExpense)}</span>
     <span class="money ${future?"planned-value":""}">${euro(shownSaving)}</span>
     <span class="money ${future?"planned-value":""}">${euro(shownBalance)}</span>
     <span class="money ${future?"planned-value":""}">${euro(shownCumulative)}</span>
     <span class="trend ${future?"forecast":trend}">${trendText}</span>
     <div class="month-main" style="display:none"><span>${future?"Reste prévu":"Reste du mois"}</span><strong>${euro(shownBalance)}</strong></div>
     <div class="month-sub"><span>Revenus ${euro(shownIncome)}</span><span>Dépenses ${euro(shownExpense)}</span><span>Épargne ${euro(shownSaving)}</span><span>Cumul ${euro(shownCumulative)}</span></div>
   </div>`
 }).join("");
 renderTrackingChart(a.months);
}
document.getElementById("prevYear")?.addEventListener("click",()=>{trackingYear--;renderTracking()});
document.getElementById("nextYear")?.addEventListener("click",()=>{trackingYear++;renderTracking()});
