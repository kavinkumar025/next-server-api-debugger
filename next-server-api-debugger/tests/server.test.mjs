import assert from "node:assert/strict";
import { before,test } from "node:test";
import { randomBytes,scryptSync } from "node:crypto";
import { debugSessionGET,debugSessionPOST,debugSessionDELETE,debugEventsGET } from "../dist/server.js";

const key="kavin";
const url="http://localhost:3000/api/next-server-api-debugger/session";
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
  const events=await debugEventsGET(new Request("http://localhost:3000/api/next-server-api-debugger/events",{headers:hdr}));
  assert.deepEqual((await events.json()).events,[]);
  const deleted=await debugSessionDELETE(new Request(url,{method:"DELETE",headers:{...hdr,origin:"http://localhost:3000"}}));
  assert.equal(deleted.status,200);
  const after=await debugEventsGET(new Request("http://localhost:3000/api/next-server-api-debugger/events",{headers:hdr}));
  assert.equal(after.status,401);
});
test("production disables login and events",async()=>{
  process.env.NODE_ENV="production";
  try {
    assert.equal((await debugSessionPOST(login(key))).status,404);
    assert.equal((await debugEventsGET(new Request("http://localhost:3000/api/next-server-api-debugger/events"))).status,404);
  } finally { process.env.NODE_ENV="development"; }
});

test("buffers pre-auth server fetch, including method and sanitized JSON response", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ orderId: 100, password: "do-not-show" }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
  try {
    const { debugFetch } = await import("../dist/server.js");
    const response = await debugFetch("https://example.test/api/orders?token=hidden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "abc", password: "private" })
    });
    assert.equal(response.status, 201);
    const signed = await debugSessionPOST(login(key));
    assert.equal(signed.status, 200);
    const cookie = signed.headers.get("set-cookie").split(";")[0];
    const events = await debugEventsGET(new Request(
      "http://localhost:3000/api/next-server-api-debugger/events?since=0", { headers: { cookie } }
    ));
    const data = await events.json();
    const entry = data.events.find(x => x.url.includes("example.test/api/orders"));
    assert.ok(entry, "server request captured before browser sign-in");
    assert.equal(entry.method, "POST");
    assert.equal(entry.status, 201);
    assert.equal(entry.requestBody.password, "[REDACTED]");
    assert.equal(entry.responseBody.password, "[REDACTED]");
    assert.match(entry.url, /token=%5BREDACTED%5D/);
  } finally { globalThis.fetch = original; }
});

test("restricts debugger endpoints to loopback during development", async () => {
  const request = new Request("http://example.com/api/next-server-api-debugger/session", {
    method: "POST",
    headers: { origin: "http://example.com", "Content-Type": "application/json" },
    body: JSON.stringify({ key })
  });
  assert.equal((await debugSessionPOST(request)).status, 404);
});

test("local Host header handles loopback alias used by Next.js internal routing", async () => {
  const req = new Request("http://127.0.0.1:3000/api/next-server-api-debugger/session", {
    method: "POST", headers: {
      origin: "http://localhost:3000", host: "localhost:3000", "Content-Type": "application/json"
    }, body: JSON.stringify({key})
  });
  assert.equal((await debugSessionPOST(req)).status,200);
});
test("loopback Host fallback rejects a mismatched port", async () => {
  const req = new Request("http://127.0.0.1:3000/api/next-server-api-debugger/session", {
    method: "POST", headers: {
      origin: "http://localhost:3001", host: "localhost:3000", "Content-Type": "application/json"
    }, body: JSON.stringify({key})
  });
  assert.equal((await debugSessionPOST(req)).status,403);
});
