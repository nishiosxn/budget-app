import test from "node:test";
import assert from "node:assert/strict";
import {connected} from "./harness.mjs";

test("three real Auth users have independent Chromium sessions on the disposable stack",async t=>{
 const env=await connected(t);
 const sessions=await Promise.all(env.users.map(user=>env.session(user)));
 assert.equal(new Set(sessions.map(session=>session.user.id)).size,3);
 assert.equal(new Set(sessions.map(session=>session.context)).size,3);
 const anotherDevice=await env.session(env.users[0]);
 await sessions[0].logout();
 assert.equal((await anotherDevice.call("/auth/v1/user")).data.id,env.users[0].id);
 assert.equal((await sessions[1].call("/auth/v1/user")).data.id,env.users[1].id);
 await sessions[0].login();
});
