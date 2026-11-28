import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync(new URL("../js/cloud-household.js",import.meta.url),"utf8");
function fixture(){
 const box=vm.createContext({document:{getElementById:()=>null},cloudSession:{user:{id:"actor"}},pendingInviteToken:null});
 const run=s=>vm.runInContext(s,box);
 run(source);
 run('activeHouseholdId="home";activeMembership={user_id:"actor"};cloudSyncReady=true;');
 return {box,run};
}
test("duplicate authenticated events do not rebootstrap an already loaded household",()=>{
 const {run}=fixture();
 assert.equal(run('shouldBootstrapAuthSession("actor")'),false);
 assert.equal(run('shouldBootstrapAuthSession("stale")'),false);
 assert.equal(run('shouldBootstrapAuthSession(null)'),false);
 run('cloudSyncReady=false');
 assert.equal(run('shouldBootstrapAuthSession("actor")'),true);
 run('cloudSyncReady=true;activeMembership={user_id:"other"}');
 assert.equal(run('shouldBootstrapAuthSession("actor")'),true);
 run('activeMembership={user_id:"actor"};pendingInviteToken="invite"');
 assert.equal(run('shouldBootstrapAuthSession("actor")'),true);
});
test("starting a bootstrap disables readiness immediately and concurrent requests share it",async()=>{
 const {box,run}=fixture();
 let complete;box.next=new Promise(resolve=>{complete=resolve;});
 run('cloudBootstrap=()=>next;');
 const p=run("requestCloudBootstrap()");
 assert.equal(run("cloudSyncReady"),false);
 assert.equal(run("requestCloudBootstrap()"),p);
 complete();await p;
 assert.equal(run("cloudBootstrapPromise"),null);
 assert.equal(run("cloudSyncReady"),false);
});
