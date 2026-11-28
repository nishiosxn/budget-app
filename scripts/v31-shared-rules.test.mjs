import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const box={};vm.runInNewContext(fs.readFileSync("assistant/shared-rules.js","utf8"),box);
test("two devices reconcile stale edits and cannot apply responses after a household switch",async()=>{
 let identity={householdId:"alpha"},revision=0,rules={};
 async function transport(path,options){
  if(options.method==="GET")return {ok:true,body:[{rules,revision}]};
  const p=JSON.parse(options.body),conflict=p.p_revision!==revision;
  if(!conflict){rules={...rules,[p.p_term]:p.p_target};revision++}
  return {ok:true,body:{revision,rules,status:conflict?"conflict":"ok"}};
 }
 const first=box.createSmartBudgetSharedRules(()=>identity,transport),second=box.createSmartBudgetSharedRules(()=>identity,transport);
 await first.load();await second.load();await first.edit("set","lidl","rule:groceries");
 const stale=await second.edit("set","cinema","rule:leisure");assert.equal(stale.conflict,true);assert.equal(stale.rules.lidl,"rule:groceries");
 assert.equal((await second.edit("set","cinema","rule:leisure")).rules.cinema,"rule:leisure");
 const pending=first.load();identity={householdId:"beta"};assert.equal(await pending,null);await assert.rejects(first.edit("clear"));
});
