import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import vm from "node:vm";
function setup(){
 const instances=[],timers=[];class Recognition{constructor(){instances.push(this)}start(){}abort(){this.onend?.()}}
 const el=()=>({value:"",maxLength:1600,handlers:{},attrs:{},addEventListener(n,f){this.handlers[n]=f},setAttribute(n,v){this.attrs[n]=v}});
 const input=el(),button=el(),status=el(),clock=el();
 const box={SpeechRecognition:Recognition,setTimeout(fn){timers.push(fn);return fn},clearTimeout(){},setInterval(){return 1},clearInterval(){}};
 vm.createContext(box);vm.runInContext(fs.readFileSync("js/assistant-voice.js","utf8"),box);
 const voice=box.SmartBudgetAssistantVoice.bind({input,button,status,clock});
 return {instances,timers,input,button,status,voice};
}
const result=(text,isFinal=false)=>Object.assign([{transcript:text}],{isFinal});
test("idle voice stop leaves typed command unchanged",()=>{const x=setup();x.input.value="20 euros";x.voice.stop();assert.equal(x.input.value,"20 euros")});
test("interim transcript is replaced, restarts retain text, manual stop prevents restart",()=>{
 const x=setup();x.input.value="Bonjour";x.button.handlers.click();const first=x.instances[0];assert.equal(first.continuous,true);assert.equal(first.interimResults,true);
 first.onresult({results:[result("vingt")]});assert.equal(x.input.value,"Bonjour vingt");
 first.onresult({results:[result("vingt euros",true)]});assert.equal(x.input.value,"Bonjour vingt euros");first.onend();x.timers.shift()();
 const next=x.instances[1];next.onresult({results:[result("chez Lidl")]});assert.equal(x.input.value,"Bonjour vingt euros chez Lidl");x.voice.stop();assert.equal(x.input.value,"Bonjour vingt euros chez Lidl");assert.equal(x.timers.length,0);
});
test("permission failure stops recording and prevents automatic retry",()=>{const x=setup();x.button.handlers.click();x.instances[0].onerror({error:"not-allowed"});assert.equal(x.button.attrs["aria-pressed"],"false");assert.equal(x.timers.length,0)});

test("voice exposes optional text-change callback for live multiline autoresize",()=>{
 const source=fs.readFileSync("js/assistant-voice.js","utf8");
 assert.match(source,/onTextChange=\(\)=>\{\}/);
 assert.match(source,/onTextChange\(input\.value\)/);
});
