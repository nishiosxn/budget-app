import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createAssistantGateway} from "../supabase/functions/smart-assistant/gateway.mjs";
import {createAtomicReview} from "../supabase/functions/smart-assistant/atomic-review.mjs";

const box=vm.createContext({});
vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
const core=box.SmartBudgetAssistantCore;
const version="2026-11-20T12:00:00Z";
const householdId="11111111-1111-4111-8111-111111111111",requestId="22222222-2222-4222-8222-222222222222";
const token="fake-authenticated-token";
const context={atomicReview:true,movementCommit:true,solo:false,actor:"A",today:"2026-11-27",firstMonth:"2026-10",lastMonth:"2028-11",
 categories:[{id:"food",name:"Restaurants",kind:"expense",owner:"common",createdFrom:"2026-10",hiddenMonths:[],version}]};
const draft={kind:"draft",operations:[
 {kind:"expense",categoryId:"food",owner:"A",date:"2026-11-27",amountCents:2000,label:"McDonald's",frequency:"once"},
 {kind:"plan",categoryId:"food",owner:"common",date:"2026-11-01",amountCents:1000,label:"Restaurants",frequency:"once",planMode:"increase"}
]};
const ids={householdId,requestId};
const prepare={...ids,action:"prepare_atomic",command:"Ajoute 20 € de McDo et augmente mon budget Restaurants de 10 €.",
 draft,expectedPlans:[{index:1,beforeCents:10000,budgetVersion:version}],categoryVersions:[version,version]};
function transport(reply){
 const calls=[];
 const atomicReview=createAtomicReview({validateReview:core.validateReview,validateMixedDraft:core.validateMixedDraft,
  validateCategoryDraft:core.validateCategoryDraft,recognize:core.quickCommand,normalizeCategory:core.normalizeCategory,
  write:async input=>{calls.push(input);return reply(input)}});
 const handle=createAssistantGateway({enabled:true,model:"@cf/google/gemma-4-26b-a4b-it",
  authorize:async(_token,house)=>house===householdId?{context,userId:"actor-test"}:null,
  atomicReview, reserve:()=>assert.fail("no quota"),infer:()=>assert.fail("no inference")});
 return {calls,post:body=>handle({token,body})};
}
test("review, commit and lookup use only authorized, validated operations",async()=>{
 const {post,calls}=transport(({action})=>action==="prepare"?{status:"prepared"}:{status:"complete",count:2,categoriesCreated:0});
 assert.equal((await post(prepare)).body.confirmation,"prepared");
 assert.deepEqual(calls[0].actions[1],{...draft.operations[1],beforeCents:10000,budgetVersion:version,categoryVersion:version});
 assert.equal((await post({...ids,action:"commit_atomic"})).body.commit.requestId,requestId);
 assert.equal((await post({...ids,action:"status_atomic"})).body.commit.count,2);
 assert.equal(calls[1].actions,null);
 assert.equal((await post({...ids,action:"commit_atomic",draft})).status,400);
 assert.equal((await post({...ids,action:"status_atomic",householdId:requestId})).status,403);
 assert.equal(calls.length,3);
});
test("reject category changes, a missing budget baseline and unrequested creation before calling the writer",async()=>{
 const {post,calls}=transport(()=>assert.fail("no writes"));
 assert.equal((await post({...prepare,categoryVersions:[version,"2026-11-21T12:00:00Z"]})).body.error,"confirm_category_changed");
 assert.equal((await post({...prepare,expectedPlans:[]})).status,400);
 const creation={kind:"categoryDraft",name:"Gundam",owner:"A",month:"2026-11",date:"2026-11-27",budgetCents:9000,expenseCents:4000};
 assert.equal((await post({...prepare,draft:creation,expectedPlans:[],categoryVersions:[]})).body.error,"confirm_creation_not_requested");
 assert.equal(calls.length,0);
});
test("reject an unverifiable receipt and distinguish a refused transaction from an uncertain result",async()=>{
 const {post}=transport(({action})=>action==="commit"?{status:"rejected"}:{status:"complete",count:0,categoriesCreated:0});
 assert.equal((await post({...ids,action:"commit_atomic"})).body.error,"confirm_stale");
 assert.equal((await post({...ids,action:"status_atomic"})).status,503);
});
