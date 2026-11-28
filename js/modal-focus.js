// Keep interaction inside the topmost application dialog, including stacked editors.
(()=>{
 const layers=".modal-backdrop,#cloudGate,#onboardingBackdrop,#setupBuilderBackdrop";
 const actions='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]';
 const closeAction=".close,#categorySettingsClose,#closeOnboardingBtn";
 const opened=[];
 const blocked=new Set();
 let active=null,trigger=null;

 function available(element){
  return element instanceof HTMLElement&&element.isConnected&&element.getClientRects().length>0&&
   getComputedStyle(element).visibility==="visible"&&!element.closest("[inert],[hidden],[aria-hidden=true]");
 }
 function panelOf(layer){return layer?.querySelector('[role="dialog"]')??null}
 function focusWithin(panel){
  if(panel.contains(document.activeElement)&&available(document.activeElement))return;
  panel.tabIndex=-1;
  panel.focus({preventScroll:true});
 }
 document.addEventListener("click",event=>{
  trigger=event.target.closest?.(actions)||null;
 },true);

 function updateLayers(){
  const previous=active;
  const candidates=[...document.querySelectorAll(layers)].filter(layer=>layer.getAttribute("aria-hidden")==="false");
  for(const layer of candidates){
   if(!opened.some(item=>item.layer===layer)){
    const opener=trigger||document.activeElement;
    opened.push({layer,opener,fallback:opener?.closest("#mobileQuickAdd")?document.getElementById("mobileAddButton"):null});
   }
  }
  trigger=null;
  for(let i=opened.length-1;i>=0;i--)if(!candidates.includes(opened[i].layer))opened.splice(i,1);
  active=opened.at(-1)||null;
  if(active===previous)return;
  for(const item of blocked)item.inert=false;
  blocked.clear();
  if(active){
   for(const sibling of document.body.children){
    if(sibling===active.layer||sibling.contains(active.layer)||sibling.inert||sibling.matches("script,link,style"))continue;
    sibling.inert=true;
    blocked.add(sibling);
   }
  }
  const panel=panelOf(active?.layer);
  if(previous&&!opened.includes(previous)){
   const target=[previous.opener,previous.fallback].find(item=>available(item)&&(!panel||panel.contains(item)));
   target?.focus({preventScroll:true});
  }
  if(panel)focusWithin(panel);
 }
 const observer=new MutationObserver(records=>{
  if(records.some(record=>record.type==="attributes"?record.target.matches(layers):
   [...record.addedNodes,...record.removedNodes].some(node=>node instanceof HTMLElement&&node.matches(layers))))updateLayers();
 });
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-hidden"]});
 updateLayers();

 document.addEventListener("keydown",event=>{
  const panel=panelOf(active?.layer);
  if(!panel||event.defaultPrevented)return;
  if(event.key==="Escape"){
   const close=panel.querySelector(closeAction);
   if(close&&available(close)){event.preventDefault();close.click()}
   return;
  }
  if(event.key!=="Tab")return;
  const items=[...panel.querySelectorAll(actions)].filter(item=>item.tabIndex>=0&&available(item));
  const focused=document.activeElement;
  const next=event.shiftKey?items.at(-1):items[0];
  const boundary=event.shiftKey?items[0]:items.at(-1);
  if(focused===boundary||!items.includes(focused)){
   event.preventDefault();
   (next||panel).focus({preventScroll:true});
  }
 });
})();
