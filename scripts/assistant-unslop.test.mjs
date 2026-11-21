import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base='preview/assistant/live/',source=fs.readFileSync(base+'live-ui.js','utf8');
test('discard dialog keeps data unless the explicit discard choice closes it',async()=>{
 const events={};let opened=0;const dialog={returnValue:'',addEventListener:(type,cb)=>events[type]=cb,showModal:()=>opened++},message={};
 const box={document:{getElementById:id=>id==='pilotDiscardDialog'?dialog:message}};vm.runInNewContext(fs.readFileSync(base+'interaction.js','utf8'),box);
 const ask=box.SmartBudgetAssistantInteraction.confirmDiscard;
 const kept=ask('Unsaved edits');assert.equal(opened,1);assert.equal(message.textContent,'Unsaved edits');
 assert.equal(await ask('second request'),false,'one modal at a time');
 events.close();assert.equal(await kept,false);
 const discarded=ask('discard');dialog.returnValue='discard';events.close();assert.equal(await discarded,true);
 const escape=ask('escape');events.close();assert.equal(await escape,false,'Escape retains the default keep value');
});
test('a pending or uncertain confirmation has an explicit discard decision',async()=>{
 const begin=source.indexOf(' async function askDiscard()'),end=source.indexOf('\n window.addEventListener',begin);let calls=0,message='';
 const box={pendingReview:{},confirmationStarted:false,confirmDiscard:async text=>{calls++;message=text;return false}};
 vm.runInNewContext(source.slice(begin,end),box);
 assert.equal(await box.askDiscard(),false);assert.equal(calls,1);
 box.confirmationStarted=true;await box.askDiscard();assert.match(message,/Vérifie son résultat dans l’historique/);
 box.pendingReview=null;assert.equal(await box.askDiscard(),true);assert.equal(calls,2);
});
test('composer uses measured wrapping, caps scrolling and follows the font size',()=>{
 const begin=source.indexOf(' function resizeComposer()'),end=source.indexOf('\n const voice=',begin);
 const input={style:{},scrollHeight:64};let size='16px';const box={input,getComputedStyle:()=>({fontSize:size})};vm.runInNewContext(source.slice(begin,end),box);
 box.resizeComposer();assert.equal(input.style.height,'64px');assert.equal(input.style.overflowY,'hidden');
 input.scrollHeight=260;box.resizeComposer();assert.equal(input.style.height,'180px');assert.equal(input.style.overflowY,'auto');
 size='32px';box.resizeComposer();assert.equal(input.style.height,'260px');assert.equal(input.style.overflowY,'hidden');
});
test('system theme follows the OS, explicit preference is isolated and survives storage failure',()=>{
 const events={},media={matches:true,addEventListener:(type,cb)=>events.media=cb},select={value:'',addEventListener:(type,cb)=>events.select=cb},html={dataset:{}};
 const box={window:{matchMedia:()=>media},document:{getElementById:()=>select,documentElement:html},localStorage:{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}}};
 vm.runInNewContext(fs.readFileSync(base+'appearance.js','utf8'),box);assert.equal(html.dataset.assistantTheme,'dark');
 media.matches=false;events.media();assert.equal(html.dataset.assistantTheme,'light');
 select.value='dark';events.select();assert.equal(html.dataset.assistantTheme,'dark');
 media.matches=false;events.media();assert.equal(html.dataset.assistantTheme,'dark');
});
test('reduced motion closes the editor without creating an animation',async()=>{
 const begin=source.indexOf(' function closeReviewForm('),end=source.indexOf('\n function fillReviewOptions(',begin);let animations=0,closed=0;
 const box={result:{querySelectorAll:()=>[]},requestAnimationFrame:()=>{},window:{matchMedia:()=>({matches:true})},Promise};
 vm.runInNewContext(source.slice(begin,end),box);
 const panel={isConnected:true,closest:()=>null,animate:()=>animations++};
 await box.closeReviewForm(panel,()=>closed++);assert.equal(closed,1);assert.equal(animations,0);
});
test('assistant theme text and essential control borders retain AA contrast',()=>{
 const css=fs.readFileSync(base+'unslop.css','utf8');
 const luminance=hex=>{if(hex.length===4)hex="#"+[...hex.slice(1)].map(v=>v+v).join("");const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 for(const theme of ['light','dark']){
  const section=css.split(':root[data-assistant-theme="'+theme+'"] {')[1].split('}')[0];
  const colors=Object.fromEntries([...section.matchAll(/--sb-([a-z-]+):\s*(#[a-f0-9]{3,6})/gi)].map(m=>[m[1],m[2]]));
  for(const surface of ['bg','surface','secondary'])for(const role of ['ink','muted','dimmed','accent','positive','negative','warning'])assert.ok(ratio(colors[role],colors[surface])>=4.5,theme+' '+role+' on '+surface);
  assert.ok(ratio(colors['control-line'],colors.secondary)>=3,theme+' input border');
 }
 assert.ok(ratio('#ffffff','#5c29d6')>=4.5,'brand primary button');
});
