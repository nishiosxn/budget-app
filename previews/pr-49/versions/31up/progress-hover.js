/* PR49 — optional touch/keyboard reveal of category progress details.
 * Hover is CSS-only; this small delegated controller handles iOS touch and Escape.
 * It makes no changes to finance state and performs no network/storage actions.
 */
"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const grid=document.getElementById("categoryGrid");
 if(!grid)return;
 const openRow=()=>grid.querySelector('.cat-progress-row[data-tooltip-open="true"]');
 const closeTip=()=>{
  const open=openRow();
  if(open)open.removeAttribute("data-tooltip-open");
 };
 const toggleTip=track=>{
  const row=track?.closest(".cat-progress-row");
  if(!row)return;
  const wasOpen=row.dataset.tooltipOpen==="true";
  closeTip();
  row.removeAttribute("data-tooltip-dismissed");
  if(!wasOpen)row.dataset.tooltipOpen="true";
 };
 grid.addEventListener("pointerdown",event=>{
  // Mouse users already get the hover state. Touch needs an explicit tap.
  if(event.pointerType!=="touch"&&event.pointerType!=="pen")return;
  const target=event.target.closest?.("[data-progress-track]");
  if(target&&grid.contains(target))toggleTip(target);
  else closeTip();
 });
 grid.addEventListener("focusin",event=>{
  const track=event.target.closest?.("[data-progress-track]");
  if(track)track.closest(".cat-progress-row")?.removeAttribute("data-tooltip-dismissed");
 });
 grid.addEventListener("focusout",event=>{
  const track=event.target.closest?.("[data-progress-track]");
  if(track){
   const row=track.closest(".cat-progress-row");
   row?.removeAttribute("data-tooltip-open");
   row?.removeAttribute("data-tooltip-dismissed");
  }
 });
 grid.addEventListener("keydown",event=>{
  const track=event.target.closest?.("[data-progress-track]");
  if(event.key==="Escape"){
   const opened=openRow();
   if(opened||track){
    event.preventDefault();
    closeTip();
    track?.closest(".cat-progress-row")?.setAttribute("data-tooltip-dismissed","true");
   }
   return;
  }
  if(track&&(event.key==="Enter"||event.key===" ")){
   event.preventDefault();
   toggleTip(track);
  }
 });
 document.addEventListener("pointerdown",event=>{
  const onTrack=event.target.closest?.("[data-progress-track]");
  if(!onTrack||!grid.contains(onTrack))closeTip();
 });
 window.addEventListener("scroll",closeTip,{passive:true});
});
