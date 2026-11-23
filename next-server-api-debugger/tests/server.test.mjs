import assert from "node:assert/strict";
import { before,test } from "node:test";
import { randomBytes,scryptSync } from "node:crypto";
import { debugSessionGET,debugSessionPOST,debugSessionDELETE,debugEventsGET } from "../dist/server.js";

const key="correct-very-long-private-key-for-local-testing";
const url="http://localhost:3000/api/__server-api-debug/session";
before(()=>{
  process.env.NODE_ENV="development";
  const salt=randomBytes(16);
  process.env.NEXT_SERVER_API_DEBUGGER_KEY_HASH=
    salt.toString("hex")+":"+scryptSync(key,salt,64).toString("hex");
});
function login(value,origin="http://localhost:3000") {
  return new Request(url,{method:"POST",headers:{origin,"Content-Type":"application/json"},
    body:JSON.stringify({key:value})});
}
test("rejects cross-origin login", async()=>{
  assert.equal((await debugSessionPOST(login(key,"http://malicious.example"))).status,403);
});
test("rejects wrong key",async()=>{
  const result=await debugSessionPOST(login("wrong key"));
  assert.equal(result.status,401);
  assert.equal(result.headers.get("set-cookie"),null);
});
test("session login, authenticate, poll, logout",async()=>{
  const signed=await debugSessionPOST(login(key));
  assert.equal(signed.status,200);
  const cookie=signed.headers.get("set-cookie");
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/SameSite=Strict/);
  assert.ok(!cookie.includes(key));
  const hdr={cookie:cookie.split(";")[0]};
  const checked=await debugSessionGET(new Request(url,{headers:hdr}));
  assert.equal((await checked.json()).authenticated,true);
  const events=await debugEventsGET(new Request("http://localhost:3000/api/__server-api-debug/events",{headers:hdr}));
  assert.deepEqual((await events.json()).events,[]);
  const deleted=await debugSessionDELETE(new Request(url,{method:"DELETE",headers:{...hdr,origin:"http://localhost:3000"}}));
  assert.equal(deleted.status,200);
  const after=await debugEventsGET(new Request("http://localhost:3000/api/__server-api-debug/events",{headers:hdr}));
  assert.equal(after.status,401);
});
test("production disables login and events",async()=>{
  process.env.NODE_ENV="production";
  try {
    assert.equal((await debugSessionPOST(login(key))).status,404);
    assert.equal((await debugEventsGET(new Request("http://localhost:3000/api/__server-api-debug/events"))).status,404);
  } finally { process.env.NODE_ENV="development"; }
});
