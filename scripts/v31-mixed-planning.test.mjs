import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createAssistantGateway} from "../supabase/functions/smart-assistant/gateway.mjs";

const box=vm.createContext({});
vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const context={today:"2026-11-27",firstMonth:"2026-09",lastMonth:"2028-12",selectedMonth:"2026-11",
 solo:false,actor:"B",members:{A:"Camille",B:"Alex"},categories:[
  ["restaurant","Restaurants","expense"],["food-store","Courses","expense"],
  ["home","Maison / entretien","expense"],["fuel","Carburant","expense"],
  ["bus","Transport","expense"],["sub","Abonnements","expense"],
  ["extra","Revenus supplémentaires","income"],["saving","Épargne","saving"]
 ].map(([id,name,kind])=>({id,name,kind,owner:kind==="expense"?"common":"B",createdFrom:"2026-09",hiddenMonths:[]}))
};
const pairs=[
 ["Ajoute 20 € de McDo et augmente mon budget Restaurants de 10 €.",
  [["expense","restaurant","B",2000,"2026-11-27","once"],["plan","restaurant","common",1000,"2026-11-01","once"]]],
 ["J’ai reçu 75 € de mon père, mets-en 25 de côté.",
  [["income","extra","B",7500,"2026-11-27","once"],["saving","saving","B",2500,"2026-11-27","once"]]],
 ["J’ai dépensé 28 € chez Lidl et 12 € chez Action.",
  [["expense","food-store","B",2800,"2026-11-27","once"],["expense","home","B",1200,"2026-11-27","once"]]],
 ["Mets mon budget carburant à zéro.",[["plan","fuel","common",0,"2026-11-01","once"]]],
 ["Augmente de 20 € mon budget courses du mois dernier.",[["plan","food-store","common",2000,"2026-10-01","once"]]],
 ["Ma partenaire a payé 45 € de courses et moi 17 € de bus.",
  [["expense","food-store","A",4500,"2026-11-27","once"],["expense","bus","B",1700,"2026-11-27","once"]]],
 ["Ajoute un abonnement de 12 € par mois.",[["expense","sub","B",1200,"2026-11-27","monthly"]]],
 ["Ajoute un revenu de 12 € par mois.",[["income","extra","B",1200,"2026-11-27","monthly"]]]
];
test("the requested mixed commands produce complete, deterministic proposals with no model call",async()=>{
 const noAI=()=>assert.fail("the provider must not be invoked");
 const handle=createAssistantGateway({enabled:true,model:"@cf/google/gemma-4-26b-a4b-it",
  authorize:async()=>({context}),quickExpense:core.quickCommand,validate:core.validateResult,validateReview:core.validateReview,
  reserve:noAI,infer:noAI});
 async function request(command){
  const r=await handle({token:"valid-fake-token-for-testing",body:{householdId:"11111111-1111-4111-8111-111111111111",context:{},command}});
  assert.equal(r.status,200,command);
  assert.equal(r.body.metering.tokens.total,0);
  return r.body.result;
 }
 for(const [command,expected] of pairs){
  const result=await request(command);
  assert.equal(JSON.stringify(result.operations?.map(o=>[o.kind,o.categoryId,o.owner,o.amountCents,o.date,o.frequency])),JSON.stringify(expected),command);
 }
 const creation=await request("Crée une catégorie Gundam avec un budget de 90 € et ajoute une dépense de 40 €.");
 assert.equal(JSON.stringify(creation),JSON.stringify({kind:"categoryDraft",name:"Gundam",owner:"B",month:"2026-11",date:"2026-11-27",budgetCents:9000,expenseCents:4000}));
});
test("missing clauses and unattributed partners cannot produce partial financial drafts",()=>{
 assert.equal(core.quickCommand("Ajoute 20 € de McDo et supprime le budget Restaurants.",context),null);
 const solo={...context,solo:true};
 assert.equal(core.quickCommand(pairs[5][0],solo)?.value.kind,"answer");
 assert.equal(core.quickCommand("J'ai reçu 10 € de mon père, mets-en 25 de côté.",context),null);
});
