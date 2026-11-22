/* PR49 31uq — one magnetic follow-tooltip for all financial bars.
 * Inertia is requestAnimationFrame-based; the tooltip never edits finances.
 * Touch pointer capture follows the finger beyond the bar in both axes.
 * The chart's click-to-filter action stays available for a stationary tap.
 * No external code, storage, timers in the background or network calls.
 */
"use strict";

function sbFollowPlace(pointerX,pointerY,width,height,viewport,kind="mouse"){
 const edge=9,offset=kind==="touch"?26:18;
 const left=viewport.left||0,top=viewport.top||0;
 const right=left+viewport.width,bottom=top+viewport.height;
 const maxX=Math.max(left+edge,right-width-edge);
 const maxY=Math.max(top+edge,bottom-height-edge);
 const desiredX=pointerX-width/2+(kind==="mouse"?8:0);
 let desiredY=pointerY-height-offset;
 if(desiredY<top+edge)desiredY=pointerY+offset;
 return {
  x:Math.min(maxX,Math.max(left+edge,desiredX)),
  y:Math.min(maxY,Math.max(top+edge,desiredY))
 };
}
function sbFollowEase(from,to,deltaMs=16,reduced=false){
 if(reduced)return to;
 const dt=Math.max(1,Math.min(64,deltaMs||16));
 const amount=1-Math.exp(-dt/68);
 return from+(to-from)*amount;
}
document.addEventListener("DOMContentLoaded",()=>{
 const grid=document.getElementById("categoryGrid");
 const chart=document.getElementById("categoryDistribution");
 if(!grid||!chart||!document.body)return;
 const root=document.documentElement;
 const float=document.createElement("div");
 float.className="sb-follow-tip";
 float.setAttribute("role","tooltip");
 float.setAttribute("aria-hidden","true");
 document.body.appendChild(float);
 root.classList.add("sb-follow-enabled");

 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")||null;
 let active=null,pressed=null,frame=0,lastFrame=0,linger=0,suppressChartClick=false;
 let current={x:0,y:0},target={x:0,y:0};
 const chartApi=()=>window.SmartBudgetCategoryDistribution;
 const cancelLinger=()=>{if(linger){clearTimeout(linger);linger=0}};
 function viewport(){
  const vv=window.visualViewport;
  return vv?{left:vv.offsetLeft,top:vv.offsetTop,width:vv.width,height:vv.height}:
   {left:0,top:0,width:window.innerWidth,height:window.innerHeight};
 }
 function draw(ts){
  frame=0;
  const dt=lastFrame?ts-lastFrame:16;
  lastFrame=ts;
  const immediate=!!reduced?.matches;
  current.x=sbFollowEase(current.x,target.x,dt,immediate);
  current.y=sbFollowEase(current.y,target.y,dt,immediate);
  float.style.transform="translate3d("+current.x.toFixed(2)+"px,"+current.y.toFixed(2)+"px,0)";
  if(!immediate&&(Math.abs(current.x-target.x)>.35||Math.abs(current.y-target.y)>.35)){
   frame=requestAnimationFrame(draw);
  }
 }
 function schedule(){
  if(!frame)frame=requestAnimationFrame(draw);
 }
 function moveTo(x,y,kind,first=false){
  const rect=float.getBoundingClientRect();
  const desired=sbFollowPlace(x,y,rect.width,rect.height,viewport(),kind);
  target=desired;
  if(first||reduced?.matches){
   current={...desired};
   lastFrame=0;
   float.style.transform="translate3d("+current.x.toFixed(2)+"px,"+current.y.toFixed(2)+"px,0)";
   if(frame){cancelAnimationFrame(frame);frame=0}
  }else schedule();
 }
 function close(){
  cancelLinger();
  if(frame){cancelAnimationFrame(frame);frame=0}
  lastFrame=0;
  if(active?.kind==="distribution")chartApi()?.preview?.(null);
  active=null;
  float.classList.remove("is-visible");
  float.setAttribute("aria-hidden","true");
 }
 function sourceInfo(element){
  if(!element?.isConnected)return null;
  if(element.matches("[data-progress-track]")){
   const node=element.closest(".cat-progress-row")?.querySelector(".cat-progress-tooltip");
   return node?.innerHTML?{kind:"category",html:node.innerHTML}:null;
  }
  if(element.matches(".bd-segment[data-bd-key]")){
   chartApi()?.preview?.(element.dataset.bdKey);
   const node=chart.querySelector(".bd-tooltip");
   return node?.innerHTML?{kind:"distribution",html:node.innerHTML}:null;
  }
  return null;
 }
 function show(element,x,y,kind){
  if(!element?.isConnected)return;
  const same=active?.element===element;
  if(!same){
   const info=sourceInfo(element);
   if(!info)return;
   if(active?.kind==="distribution"&&info.kind!=="distribution")chartApi()?.preview?.(null);
   float.innerHTML=info.html;
   active={element,kind:info.kind};
  }
  cancelLinger();
  if(!float.classList.contains("is-visible")){
   float.classList.add("is-visible");
   float.setAttribute("aria-hidden","false");
   moveTo(x,y,kind,true);
  }else{
   moveTo(x,y,kind,!same);
  }
 }
 function hoverZone(element,x,y){
  if(!element?.isConnected)return false;
  const r=element.getBoundingClientRect();
  const padX=element.matches(".bd-segment")?12:18;
  return x>=r.left-padX&&x<=r.right+padX&&y>=r.top-40&&y<=r.bottom+40;
 }
 function nearestSegment(track,x){
  const segments=[...track.querySelectorAll(".bd-segment[data-bd-key]")];
  return segments.reduce((best,el)=>{
   const b=el.getBoundingClientRect(),distance=Math.abs(x-(b.left+b.right)/2);
   return distance<best.distance?{element:el,distance}:best;
  },{element:null,distance:Infinity}).element;
 }
 function barFromEvent(event){
  const targetElement=event.target;
  if(!targetElement?.closest)return null;
  const direct=targetElement.closest("[data-progress-track],.bd-segment[data-bd-key]");
  if(direct&&grid.contains(direct))return direct;
  const track=targetElement.closest(".bd-track");
  if(track&&chart.contains(track))return nearestSegment(track,event.clientX);
  return null;
 }
 function desktopMove(event){
  if(pressed)return;
  const element=barFromEvent(event);
  if(element){
   show(element,event.clientX,event.clientY,"mouse");return;
  }
  if(active&&hoverZone(active.element,event.clientX,event.clientY)){
   moveTo(event.clientX,event.clientY,"mouse");return;
  }
  if(active)close();
 }
 function touchStart(event){
  const element=barFromEvent(event);
  if(!element){if(active)close();return}
  cancelLinger();
  pressed={id:event.pointerId,element,startX:event.clientX,startY:event.clientY,moved:false};
  suppressChartClick=false;
  try{element.setPointerCapture?.(event.pointerId)}catch{}
  show(element,event.clientX,event.clientY,"touch");
 }
 function touchMove(event){
  if(!pressed||event.pointerId!==pressed.id)return;
  if(Math.hypot(event.clientX-pressed.startX,event.clientY-pressed.startY)>9){
   pressed.moved=true;
  }
  show(pressed.element,event.clientX,event.clientY,"touch");
 }
 function touchEnd(event){
  if(!pressed||event.pointerId!==pressed.id)return;
  const info=pressed;
  pressed=null;
  try{info.element.releasePointerCapture?.(event.pointerId)}catch{}
  if(info.moved&&info.element.matches(".bd-segment")){
   // A swipe is an inspection gesture, not a category-filter click.
   suppressChartClick=true;
   setTimeout(()=>{suppressChartClick=false},650);
  }
  cancelLinger();
  linger=setTimeout(close,info.moved?900:1800);
 }
 // Capture prevents only the synthetic click after a drag. A tap still filters.
 chart.addEventListener("click",event=>{
  if(!suppressChartClick)return;
  if(!event.target.closest?.(".bd-segment"))return;
  event.preventDefault();
  event.stopImmediatePropagation();
  suppressChartClick=false;
 },true);
 document.addEventListener("pointerdown",event=>{
  if(event.pointerType==="touch"||event.pointerType==="pen")touchStart(event);
  else if(active&&!barFromEvent(event))close();
 });
 document.addEventListener("pointermove",event=>{
  if(pressed&&event.pointerId===pressed.id){touchMove(event);return}
  if(event.pointerType==="mouse")desktopMove(event);
 });
 document.addEventListener("pointerover",event=>{
  if(event.pointerType==="mouse")desktopMove(event);
 });
 document.addEventListener("pointerup",touchEnd);
 document.addEventListener("pointercancel",event=>{
  if(pressed?.id===event.pointerId){pressed=null;close()}
 });
 document.addEventListener("focusin",event=>{
  if(pressed)return;
  const el=event.target;
  if(!el?.matches?.("[data-progress-track],.bd-segment[data-bd-key]"))return;
  const rect=el.getBoundingClientRect();
  show(el,rect.left+rect.width/2,rect.top+rect.height/2,"keyboard");
 });
 document.addEventListener("focusout",event=>{
  if(pressed||!active||active.element!==event.target)return;
  if(!event.relatedTarget?.matches?.("[data-progress-track],.bd-segment[data-bd-key]"))close();
 });
 document.addEventListener("keydown",event=>{
  if(event.key!=="Escape"||!active)return;
  event.preventDefault();
  close();
 });
 document.addEventListener("click",event=>{
  if(!active||pressed)return;
  if(event.target.closest?.("[data-bd-scope],[data-bd-level],[data-bd-action],[data-bd-key],#demoMonth,#prevMonth,#nextMonth")){
   close();
  }
 });
 const observer=new MutationObserver(()=>{
  if(active&&!active.element.isConnected)close();
 });
 observer.observe(chart,{childList:true});
 for(const slot of ["categoryIncomeSlot","categoryExpenseSlot","categorySavingSlot"]){
  const node=document.getElementById(slot);
  if(node)observer.observe(node,{childList:true});
 }
 window.addEventListener("scroll",()=>{if(!pressed&&active)close()},{passive:true});
 window.addEventListener("resize",()=>{if(active)close()},{passive:true});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)close()});
});
