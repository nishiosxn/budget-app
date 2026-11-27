import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {connected} from "./harness.mjs";
import {completeSetup,invite,rows,verified} from "./financial-fixture.mjs";

test("real local Edge executes eight deterministic requests and isolates confirmations and rules",async t=>{
 const env=await connected(t);
 const [owner,partner,outsider]=await Promise.all(env.users.map(u=>env.session(u)));
 const {h}=await completeSetup(owner,"couple");
 const {h:other}=await completeSetup(outsider,"solo");
 await invite(owner,partner,h);
 await env.startAssistant(h,[owner.user.id,partner.user.id]);
 await partner.watchTransactions(h);
 const analyze=async(session,command)=>{
  const analysis=await verified(session.assistant({householdId:h,context:{},command,localOnly:true}),"Smart Engine");
  assert.equal(analysis.metering.tokens.total,0);
  assert.ok(["categoryDraft","draft","mixedDraft"].includes(analysis.result.kind));
  return analysis;
 };
 async function prepare(session,command){
  const response=await analyze(session,command);
  const draft=response.result,ops=draft.operations||[];
  const requestId=randomUUID();
  const base={householdId:h,requestId};
  const ready=await verified(session.assistant({...base,action:"prepare_atomic",command,draft,
   categoryVersions:ops.map(op=>response.context.categories.find(c=>c.id===op.categoryId)?.version??null),
   expectedPlans:(response.planPreviews||[]).map(p=>({index:p.index,beforeCents:p.beforeCents,budgetVersion:p.budgetVersion}))
  }),"prepare");
  assert.deepEqual(ready,{confirmation:"prepared",requestId});
  return {base,response,commit:who=>(who||session).assistant({...base,action:"commit_atomic"}),lookup:who=>(who||session).assistant({...base,action:"status_atomic"})};
 }

 const create=await prepare(owner,"Crée une catégorie Gundam avec un budget de 90 € et ajoute une dépense de 40 €.");
 assert.equal((await rows(partner,"categories",h,"&name=eq.Gundam")).length,0);
 const device=await env.session(env.users[0]);
 const receipts=await Promise.all([verified(create.commit()),verified(create.commit(device))]);
 assert.deepEqual(receipts[0],receipts[1]);
 await partner.page.waitForFunction(()=>globalThis.fixtureChanges?.some(row=>row?.label==="Gundam"));
 assert.equal((await rows(partner,"transactions",h,"&label=eq.Gundam")).length,1);
 const gundam=(await rows(partner,"categories",h,"&name=eq.Gundam"))[0];
 assert.equal(Number((await rows(partner,"budgets",h,"&category_id=eq."+gundam.id))[0].planned_amount),90);
 assert.equal((await create.lookup(partner)).status,403);
 assert.equal((await create.lookup(outsider)).status,403);
 assert.equal((await create.commit(outsider)).status,403);

 const mix=await prepare(owner,"Ajoute 20 € de McDo et augmente mon budget Restaurants de 10 €.");
 assert.equal(mix.response.planPreviews[0].afterCents,11000);
 owner.dropNextAssistantResponse();
 await assert.rejects(mix.commit());
 const recovered=await env.session(env.users[0]);
 const receipt=await verified(mix.lookup(recovered),"retrieve receipt");
 assert.equal(receipt.commit.count,2);
 assert.deepEqual(await verified(mix.commit(recovered)),receipt);
 assert.equal((await rows(partner,"transactions",h,"&amount=eq.20")).length,1);
 assert.equal((await rows(partner,"budgets",h,"&planned_amount=eq.110")).length,1);

 const commands=[
  "J’ai reçu 75 € de mon père, mets-en 25 de côté.",
  "J’ai dépensé 28 € chez Lidl et 12 € chez Action.",
  "Mets mon budget carburant à zéro.",
  "Augmente de 20 € mon budget courses du mois dernier.",
  "Ma partenaire a payé 45 € de courses et moi 17 € de bus.",
  "Ajoute un abonnement de 12 € par mois."
 ];
 for(const command of commands){
  const review=await prepare(recovered,command);
  assert.equal((await verified(review.commit(),"commit "+command)).confirmation,"complete");
 }
 const transactions=await rows(partner,"transactions",h);
 const checked=amount=>transactions.find(t=>Number(t.amount)===amount);
 for(const amount of [40,20,75,25,28,12,45,17])assert.ok(checked(amount),String(amount));
 assert.equal(transactions.length,8);
 assert.equal(checked(45).owner_slot,"A");assert.equal(checked(17).owner_slot,"B");
 assert.equal(checked(75).metadata.type,"income");assert.equal(checked(25).metadata.type,"expense");
 assert.match(checked(75).label,/père/);
 const recurrences=await rows(partner,"recurrences",h);
 assert.equal(recurrences.length,1);assert.equal(Number(recurrences[0].amount),12);
 const budgets=await rows(partner,"budgets",h),month=mix.response.context.today.slice(0,7);
 assert.ok(budgets.some(b=>Number(b.planned_amount)===0&&b.month===month+"-01"));
 const prior=new Date(month+"-01T12:00:00Z");prior.setUTCMonth(prior.getUTCMonth()-1);
 assert.ok(budgets.some(b=>Number(b.planned_amount)===260&&b.month===prior.toISOString().slice(0,10)));

 const [first,second]=await Promise.all([
  prepare(recovered,"Augmente mon budget Restaurants de 5 €."),
  prepare(partner,"Augmente mon budget Restaurants de 7 €.")
 ]);
 const competing=await Promise.all([first.commit(),second.commit()]);
 assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);

 const editRules=(session,householdId,revision,target)=>session.rpc("edit_smart_assistant_rule",{
  p_household_id:householdId,p_revision:revision,p_operation:"set",p_term:"magasin-fixture",p_target:target
 });
 assert.equal((await verified(editRules(owner,h,0,"rule:groceries"))).revision,1);
 assert.equal((await rows(partner,"smart_assistant_household_rules",h))[0].rules["magasin-fixture"],"rule:groceries");
 assert.equal((await verified(editRules(partner,h,0,"rule:food"))).status,"conflict");
 assert.equal((await verified(editRules(partner,h,1,"rule:food"))).revision,2);
 assert.equal((await rows(device,"smart_assistant_household_rules",h))[0].rules["magasin-fixture"],"rule:food");
 assert.equal((await editRules(outsider,h,2,"rule:food")).ok,false);
 assert.equal((await editRules(owner,h,2,"id:cross-household")).ok,false);

 for(const table of ["categories","budgets","transactions","recurrences","account_opening_balances","smart_assistant_household_rules"]){
  assert.deepEqual(await rows(outsider,table,h),[],table);
  assert.deepEqual(await rows(partner,table,other),[],table);
 }
 const forbiddenWrite=await outsider.call("/rest/v1/transactions",{method:"POST",body:{
  household_id:h,category_id:gundam.id,transaction_date:mix.response.context.today,amount:1
 }});
 assert.equal(forbiddenWrite.ok,false);
 const blocked=await outsider.rpc("smart_assistant_atomic_review",{
  p_household:h,p_actor:owner.user.id,p_roster:[owner.user.id,partner.user.id],p_request:create.base.requestId,p_action:"status",p_actions:null
 });
 assert.equal(blocked.ok,false);
 assert.equal((await partner.rpc("smart_assistant_atomic_review",{
  p_household:h,p_actor:partner.user.id,p_roster:[owner.user.id,partner.user.id],p_request:create.base.requestId,p_action:"status",p_actions:null
 })).ok,false);
 for(const table of ["smart_assistant_pilot_batch_receipts","smart_assistant_reviews","budget_builder_setup"]){
  const read=await outsider.call("/rest/v1/"+table+"?household_id=eq."+h);
  assert.ok(!read.ok||read.data.length===0);
 }
});
