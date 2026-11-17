/* Smart Budget V3.0: all presentation, no cloud writes. */
(()=>{
"use strict";
const noMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ids=["balanceValue","balanceRestB","balanceRestA","incomeTotal","expenseTotal","saveB","saveA","accountBalanceB","accountBalanceA","yearIncome","yearExpense","yearSaving","yearBalance","yearRestB","yearRestA"];
const format=new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});
const values=new WeakMap(),frames=new WeakMap();
let boot=null,loading=false,ready=false,percent=0,tabTimer=0;
let goal=0,frameId=0,lastFrame=0,finishing=false,finishFrom=0,finishAt=0,hideTimer=0;
const steps={start:[23,"Préparation"],session:[49,"Session vérifiée"],household:[79,"Foyer identifié"],data:[96,"Données chargées"],ready:[100,"Budget prêt"]};
function makeBoot(){
 if(boot)return boot;
 boot=document.getElementById("sbBootScreen")||document.createElement("div");
 boot.id="sbBootScreen";boot.classList.add("sb-boot");boot.setAttribute("role","status");boot.setAttribute("aria-live","polite");
 boot.innerHTML='<div class="sb-skeletons" aria-hidden="true"><i class="sb-wide"></i><div class="sb-sk-grid"><i class="sb-feature"></i><div class="sb-sk-four"><i></i><i></i><i></i><i></i></div></div><div class="sb-sk-three"><i></i><i></i><i></i></div><div class="sb-sk-two"><i></i><i></i></div></div><div class="sb-boot-card"><div class="sb-boot-mark"><svg class="sb-logo-svg" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="16" fill="#285F49"/><defs><mask id="sb-logo-reveal-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><path class="sb-logo-reveal" pathLength="100" d="M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z" fill="none" stroke="white" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><path d="M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z" fill="#F4F5F1" mask="url(#sb-logo-reveal-mask)"/><path class="sb-logo-glint" pathLength="100" d="M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z" fill="none" stroke="#B6D8C4" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="9 91" mask="url(#sb-logo-reveal-mask)"/></svg></div><strong>Smart Budget</strong><span class="sb-loading-label">Préparation</span><small class="sb-loading-percent">0 %</small></div>';
 if(!boot.isConnected)document.body.append(boot);
 return boot;
}
function paintProgress(){
 const el=makeBoot();
 el.querySelector(".sb-logo-reveal").style.strokeDashoffset=String(Math.max(0,100-percent));
 el.querySelector(".sb-loading-percent").textContent=Math.floor(percent)+" %";
}
function tick(now){
 if(!loading)return;
 const delta=lastFrame?Math.min(70,Math.max(0,now-lastFrame)):16;
 lastFrame=now;
 if(finishing){
  const t=Math.min(1,(now-finishAt)/500);
  percent=finishFrom+(100-finishFrom)*(1-Math.pow(1-t,3));
 }else{
  // Valeur visuelle estimée, jamais 100 % tant que Supabase n'a pas terminé.
  // Avancée par petites étapes à chaque frame; le reflet continue de bouger en cas d'attente.
  percent+=(goal-percent)*(1-Math.exp(-delta/1850));
  percent=Math.min(percent,96);
 }
 paintProgress();
 if(finishing&&now-finishAt>=500){
  percent=100;paintProgress();makeBoot().classList.add("sb-done");
  frameId=0;clearTimeout(hideTimer);hideTimer=setTimeout(cancel,180);
  return;
 }
 frameId=requestAnimationFrame(tick);
}
function stage(s){
 if(!loading||!steps[s])return;
 const d=steps[s],el=makeBoot();
 goal=Math.max(goal,d[0]);
 el.querySelector(".sb-loading-label").textContent=d[1];
 if(s==="household"||s==="data")el.classList.add("sb-show-skeletons");
 if(noMotion()&&!finishing){percent=goal;paintProgress()}
}
function begin(){
 clearTimeout(hideTimer);
 if(frameId)cancelAnimationFrame(frameId);
 loading=true;ready=false;percent=0;goal=0;finishing=false;lastFrame=0;
 const el=makeBoot();el.classList.remove("sb-show-skeletons","sb-done");el.classList.add("sb-open");
 paintProgress();stage("start");
 if(!noMotion())frameId=requestAnimationFrame(tick);
}
function beginIfNeeded(){if(!loading){begin();stage("session")}}
function isLoading(){return loading}
function cancel(){
 loading=false;finishing=false;
 if(frameId)cancelAnimationFrame(frameId);
 frameId=0;clearTimeout(hideTimer);
 boot?.classList.remove("sb-open");
}
function num(s){const v=String(s||"").replace(/[\s\u00a0\u202f€]/g,"").replace(",",".");return /^[+-]?\d+(\.\d+)?$/.test(v)?Number(v):null}
function animateOne(el){
 const target=num(el.textContent);if(target===null)return;
 const old=values.get(el);if(old!==undefined&&Math.abs(old-target)<.005)return;
 values.set(el,target);if(frames.has(el))cancelAnimationFrame(frames.get(el));
 if(noMotion()||Math.abs(target)<.005)return;
 const initial=old===undefined?0:old,delta=target-initial,final=el.id==="balanceValue"?el.innerHTML:el.textContent,start=performance.now();
 const step=now=>{
  if(!el.isConnected)return;
  const p=Math.min(1,(now-start)/(old===undefined?700:420)),n=format.format(initial+delta*(1-Math.pow(1-p,3)));
  if(el.id==="balanceValue")el.firstChild.textContent=n+" ";else el.textContent=n+"\u00a0€";
  if(p<1)frames.set(el,requestAnimationFrame(step));
  else{if(el.id==="balanceValue")el.innerHTML=final;else el.textContent=final;frames.delete(el)}
 };
 frames.set(el,requestAnimationFrame(step));
}
function counters(root){if(!ready)return;for(const id of ids){const el=document.getElementById(id);if(el&&root.contains(el)&&el.getClientRects().length)animateOne(el)}}
function finish(){
 if(!loading)return;
 stage("ready");ready=true;
 requestAnimationFrame(()=>counters(document.querySelector(".view.active")||document));
 if(noMotion()){percent=100;paintProgress();makeBoot().classList.add("sb-done");cancel();return}
 finishing=true;finishFrom=percent;finishAt=performance.now();
 // Uniquement l'animation de finition du logo, pas un faux délai réseau.
 hideTimer=setTimeout(cancel,1150); // Sécurité si l'onglet est suspendu pendant l'animation.
}
function afterRender(){if(ready)requestAnimationFrame(()=>counters(document.querySelector(".view.active")||document))}
function animateChart(host){
 const svg=host?.querySelector("svg");if(!svg||!host.closest(".view.active")||noMotion()||svg.dataset.sbDrawn)return;
 svg.dataset.sbDrawn="1";
 svg.querySelectorAll(".chart-real-line").forEach(line=>{const n=line.getTotalLength();if(!n)return;line.style.strokeDasharray=String(n);line.style.strokeDashoffset=String(n);requestAnimationFrame(()=>{line.style.transition="stroke-dashoffset 800ms cubic-bezier(.16,1,.3,1)";line.style.strokeDashoffset="0";})});
 svg.querySelectorAll(".chart-planned-line,.chart-real-point,.chart-planned-point").forEach(el=>el.animate([{opacity:0},{opacity:1}],{duration:520,easing:"ease-out"}));
}
function chartHover(host,months){
 const svg=host.querySelector("svg");if(!svg)return;
 const tip=document.createElement("div");tip.className="sb-chart-tip";tip.setAttribute("role","status");host.append(tip);
 const guide=document.createElementNS("http://www.w3.org/2000/svg","line");guide.setAttribute("y1","18");guide.setAttribute("y2","228");guide.classList.add("sb-chart-guide");svg.append(guide);
 const d=new Date(),current=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),x=i=>54+828*i/Math.max(1,months.length-1);
 function show(i){
  i=Math.max(0,Math.min(months.length-1,i));const m=months[i],px=x(i);
  tip.replaceChildren();const title=document.createElement("strong");title.textContent=m.label;tip.append(title);
  const planned=document.createElement("span");planned.textContent="Prévu : "+euro(m.plannedBalance);tip.append(planned);
  if(m.key<=current&&m.tx?.length){const actual=document.createElement("span");actual.textContent="Réel : "+euro(m.balance);tip.append(actual)}
  const r=svg.getBoundingClientRect(),h=host.getBoundingClientRect();
  tip.style.left=Math.max(68,Math.min(host.clientWidth-68,r.left-h.left+px/900*r.width))+"px";
  guide.setAttribute("x1",px);guide.setAttribute("x2",px);tip.classList.add("is-visible");guide.classList.add("is-visible");
 }
 function hide(){tip.classList.remove("is-visible");guide.classList.remove("is-visible")}
 const at=e=>{const r=svg.getBoundingClientRect();show(Math.round((((e.clientX-r.left)/r.width*900)-54)/828*(months.length-1)))};
 svg.addEventListener("pointermove",e=>{if(e.pointerType!=="touch"||e.buttons)at(e)});svg.addEventListener("pointerdown",at);svg.addEventListener("pointerleave",hide);
 svg.querySelectorAll(".chart-real-point,.chart-planned-point").forEach(dot=>{dot.setAttribute("tabindex","0");dot.addEventListener("focus",()=>show(Number(dot.dataset.monthIndex)));dot.addEventListener("blur",hide)});
 animateChart(host);
}
function changeView(btn){
 const next=document.getElementById(btn?.dataset.tab||""),current=document.querySelector(".view.active");if(!next||next===current)return;
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));
 clearTimeout(tabTimer);document.querySelectorAll(".view").forEach(x=>x.classList.remove("sb-enter","sb-exit"));
 const swap=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x===next));
  next.classList.add("sb-enter");setTimeout(()=>next.classList.remove("sb-enter"),noMotion()?0:380);
  requestAnimationFrame(()=>{counters(next);if(next.id==="tracking")animateChart(document.getElementById("trackingChart"))});
 };
 if(current&&!noMotion()){current.classList.add("sb-exit");tabTimer=setTimeout(swap,130)}else swap();
}
window.SmartBudgetMotion={begin,beginIfNeeded,isLoading,stage,finish,cancel,afterRender,changeView,chartHover,animateChart};
})();