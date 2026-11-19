/* Shared browser dictation. No app-side audio storage, no automatic submit. */
(function(root){
function bind({input,button,status,clock,authorize=()=>true,onTextChange=()=>{}}){
 const Speech=root.SpeechRecognition||root.webkitSpeechRecognition;
 if(!Speech){button.disabled=true;button.title="Utilise la dictée du clavier.";return {stop(){}}}
 let wanted=false,current=null,retry=null,ticker=null,started=0,base="",committed="",partial="",retries=0;
 const join=(...a)=>a.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
 function display(){input.value=join(base,committed,partial).slice(0,input.maxLength>0?input.maxLength:1600);onTextChange(input.value)}
 function assistantVoiceTick(){if(!clock)return;const s=Math.floor((Date.now()-started)/1000);clock.textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
 function paint(active){button.setAttribute("aria-pressed",String(active));button.setAttribute("aria-label",active?"Arrêter la dictée":"Dicter");button.title=active?"Arrêter la dictée":"Dicter";if(clock)clock.hidden=!active}
 function stop({discard=false}={}){if(!wanted&&!current)return;wanted=false;clearTimeout(retry);clearInterval(ticker);retry=ticker=null;if(discard){base=committed=partial="";}else{committed=join(committed,partial);partial="";display()}const r=current;current=null;try{r?.abort()}catch{}paint(false)}
 function start(){if(!wanted||current)return;const r=new Speech();current=r;r.lang="fr-FR";r.continuous=true;r.interimResults=true;
  let parts=[];
  r.onresult=e=>{if(!wanted||current!==r)return;retries=0;parts=Array.from(e.results).map(x=>({text:x[0].transcript,final:x.isFinal}));partial=join(...parts.map(x=>x.text));display();if(input.value.length>=input.maxLength&&input.maxLength>0){stop();status.textContent="Limite de texte atteinte."}};
  r.onerror=e=>{if(current!==r)return;if(["no-speech","aborted"].includes(e.error))return;stop();status.textContent="Dictée interrompue. Vérifie les permissions ou utilise le clavier."};
  r.onend=()=>{if(current!==r)return;current=null;committed=join(committed,partial);partial="";display();if(!wanted)return;if(++retries>5){stop();status.textContent="Le navigateur interrompt la dictée. Relance le microphone.";return}retry=setTimeout(start,450)};
  try{r.start()}catch{current=null;stop();status.textContent="Impossible de démarrer la dictée."}
 }
 button.addEventListener("click",()=>{if(wanted){stop();status.textContent="Dictée terminée. Tu peux corriger le texte.";return}if(!authorize())return;base=input.value.trim();committed=partial="";retries=0;started=Date.now();wanted=true;paint(true);assistantVoiceTick();ticker=setInterval(assistantVoiceTick,1000);status.textContent="Écoute en cours…";start()});
 input.addEventListener("input",()=>{if(wanted){const edited=input.value;stop();input.value=edited;status.textContent="Dictée arrêtée pour modifier le texte."}});
 root.document?.addEventListener("visibilitychange",()=>{if(root.document.hidden&&wanted)stop()});
 return {stop};
}
root.SmartBudgetAssistantVoice=Object.freeze({bind});
})(globalThis);