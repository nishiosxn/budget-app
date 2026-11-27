import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("preview/assistant/live/confirmation.js","utf8");
const id="11111111-1111-4111-8111-111111111111",householdId="foyer-fictif";
const review={command:"demande fictive",draft:{kind:"draft"},categoryVersions:[],expectedPlans:[]};
const expected={count:2,categoriesCreated:0};
function fixture(){
 const map=new Map(),calls=[];
 const storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,
  setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const remote={phase:"missing",commits:0,fail:null};
 const reply=confirmation=>({ok:true,status:200,body:confirmation==="complete"?
  {confirmation,commit:{kind:"batch",requestId:id,...expected}}:{confirmation,requestId:id}});
 const transport=async body=>{
  calls.push(body.action);
  assert.equal(body.householdId,householdId);
  if(body.action==="status_atomic")return reply(remote.phase);
  if(body.action==="prepare_atomic"){
   assert.equal(body.command,review.command);
   remote.phase="prepared";
  }
  if(body.action==="commit_atomic"){
   assert.deepEqual(Object.keys(body).sort(),["action","householdId","requestId"]);
   if(remote.phase==="prepared"){remote.commits++;remote.phase="complete"}
  }
  if(remote.fail===body.action){remote.fail=null;throw Error("Réponse perdue")}
  return reply(remote.phase);
 };
 function client(userId="actor",house=householdId,send=transport){
  const ctx=vm.createContext({});
  vm.runInContext(source,ctx);
  return ctx.createSmartBudgetAssistantConfirmation({identity:{householdId:house,userId},storage,send});
 }
 return {map,calls,remote,client,storage};
}
test("a double confirmation uses the same request and keeps only an opaque browser marker",async()=>{
 const f=fixture(),client=f.client();
 const one=client.submit(id,review,expected),two=client.submit(id,review,expected);
 assert.equal(one,two);
 assert.deepEqual([...f.map.values()],["1"]);
 assert.ok(!JSON.stringify([...f.map]).includes(review.command));
 assert.equal((await two).outcome,"complete");
 assert.equal(f.remote.commits,1);
 assert.deepEqual(f.calls,["prepare_atomic","commit_atomic"]);
 assert.equal(f.map.size,0);
});
test("reload after prepare loss only checks status, explicit retry resumes the same ticket",async()=>{
 const f=fixture(),client=f.client();f.remote.fail="prepare_atomic";
 await assert.rejects(client.submit(id,review,expected));
 const next=f.client();
 assert.equal(next.pending()[0],id);
 assert.equal(f.client("other-user").pending().length,0);
 assert.equal(f.client("actor","other-home").pending().length,0);
 assert.equal((await next.recover(id)).outcome,"prepared");
 assert.equal(f.remote.commits,0);
 assert.equal((await next.recover(id,true)).outcome,"complete");
 assert.equal(f.remote.commits,1);
 assert.equal(f.map.size,0);
});
test("reload after a lost commit response finds a verified receipt without a second write",async()=>{
 const f=fixture();f.remote.fail="commit_atomic";
 await assert.rejects(f.client().submit(id,review,expected));
 const result=await f.client().recover(id,true);
 assert.equal(result.outcome,"complete");
 assert.deepEqual(f.calls,["prepare_atomic","commit_atomic","status_atomic"]);
 assert.equal(f.remote.commits,1);
});
test("malformed receipts stay uncertain, and stale proposals clear the pending marker",async()=>{
 const f=fixture();
 const client=f.client(undefined,undefined,async()=>({ok:true,body:{confirmation:"complete",commit:{kind:"batch",requestId:"wrong"}}}));
 await assert.rejects(client.submit(id,review,expected));
 assert.equal(client.pending()[0],id);
 const next=f.client(undefined,undefined,async()=>({ok:false,status:409,body:{error:"confirm_stale"}}));
 assert.equal((await next.recover(id)).outcome,"rejected");
 assert.equal(f.map.size,0);
});
test("the browser must retain the opaque marker before sending any confirmation",async()=>{
 const f=fixture();f.storage.setItem=()=>{throw Error("storage unavailable")};
 await assert.rejects(f.client().submit(id,review,expected));
 assert.deepEqual(f.calls,[]);
});
