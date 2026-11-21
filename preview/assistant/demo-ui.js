(()=>{"use strict";
 const demo=globalThis.SmartBudgetDemo,core=globalThis.SmartBudgetAssistantCore,planner=globalThis.SmartBudgetAssistantPlanner,ctx=demo.context();
 const $=id=>document.getElementById(id),result=$("sbAssistantResult"),status=$("sbAssistantStatus"),input=$("sbAssistantInput"),confirm=$("confirm"),cancel=$("cancel");
 const euro=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n),cat=id=>ctx.categories.find(c=>c.id===id)?.name||id,owner=o=>o==="common"?"À deux":ctx.members[o];
 const initial=()=>({transactions:[{id:"demo-1",type:"income",category:"salary",owner:"B",amount:1200,label:"Salaire fictif",date:ctx.today},{id:"demo-2",type:"expense",category:"food",owner:"common",amount:80,label:"Courses fictives",date:ctx.today}],incomePlanChanges:{},expensePlanChanges:{}});
 let snapshot=initial(),pending=null,batchId=null;
 const line=(parent,value)=>{const e=document.createElement("div");e.className="sb-assistant-result-row";e.textContent=value;parent.append(e)};
 function occurrences(){return snapshot.transactions.map(t=>({kind:t.type,categoryId:t.category,owner:t.owner,amountCents:Math.round(t.amount*100),date:t.date}));}
 function render(){const active=snapshot.transactions.filter(t=>t.date<=ctx.today&&t.date.slice(0,7)===ctx.selectedMonth);const sums=active.reduce((a,t)=>(a[t.type]+=Math.round(t.amount*100),a),{income:0,expense:0});$("balance").textContent=euro((sums.income-sums.expense)/100);$("totals").textContent="Revenus "+euro(sums.income/100)+" · dépenses "+euro(sums.expense/100);
 $("ledger").replaceChildren();for(const t of [...snapshot.transactions].reverse()){const r=document.createElement("div");r.className="ledger-row";const a=document.createElement("span"),b=document.createElement("strong");a.textContent=t.label+" · "+owner(t.owner)+(t.scope==="forward"?" · mensuel":"");b.textContent=(t.type==="expense"?"−":"+")+euro(t.amount);r.append(a,b);$("ledger").append(r)}
 $("plans").replaceChildren();for(const [id,p] of Object.entries(snapshot.expensePlanChanges))for(const [month,x] of Object.entries(p.forward||{}))line($("plans"),cat(id)+" · budget à partir de "+month+" : "+euro(x.budget));
 }
 function clear(){pending=null;batchId=null;confirm.hidden=true;cancel.hidden=true;result.replaceChildren()}
 function submit(e){e.preventDefault();voice.stop();const command=input.value.trim();if(!command)return;const checked=core.validateResult(demo.infer(command,ctx,pending),ctx);clear();input.value="";if(!checked.ok){status.textContent=checked.error;return}
 const v=checked.value;if(v.kind==="draft"){pending=v;batchId=crypto.randomUUID();confirm.hidden=false;cancel.hidden=false;status.textContent="Brouillon · aucune opération enregistrée.";for(const o of v.operations)line(result,o.label+" · "+cat(o.categoryId)+" · "+owner(o.owner)+" · "+euro(o.amountCents/100)+" · "+o.date+" · "+(o.frequency==="monthly"?"Mensuel":"Unique"));if(v.operations.every(o=>o.kind!=="plan"))line(result,"Total : "+euro(v.operations.reduce((a,o)=>a+o.amountCents,0)/100));}
 else if(v.kind==="query"){status.textContent="Calcul local sur les données fictives.";line(result,"Reste disponible : "+$("balance").textContent)}
 else{status.textContent="Précision nécessaire";line(result,v.message)}
 }
 $("sbAssistantForm").addEventListener("submit",submit);input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();$("sbAssistantForm").requestSubmit()}});
 document.querySelectorAll("[data-assistant-suggestion]").forEach(b=>b.addEventListener("click",()=>{voice.stop({discard:true});input.value=b.dataset.assistantSuggestion;input.focus()}));
 confirm.addEventListener("click",()=>{if(!pending)return;const r=planner.prepareBatch({result:pending,context:ctx,snapshot,existingOccurrences:occurrences(),approval:true,batchId});if(!r.ok){status.textContent=r.error;return}snapshot=r.patch;clear();render();status.textContent="Brouillon enregistré dans le foyer fictif uniquement."});
 cancel.addEventListener("click",()=>{voice.stop({discard:true});clear();input.value="";status.textContent="Nouvelle demande."});
 $("reset").addEventListener("click",()=>{voice.stop({discard:true});snapshot=initial();clear();input.value="";render();status.textContent="Foyer fictif réinitialisé."});
 const voice=globalThis.SmartBudgetAssistantVoice.bind({input,button:$("mic"),status,clock:document.querySelector(".sb-voice-clock"),authorize:()=>window.confirm("La dictée peut envoyer ton audio au service du navigateur. N’utilise que des données fictives. Continuer ?")});
 render();
})();