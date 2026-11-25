import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { integrateNextApp } from "../bin/auto-integrate.mjs";

const root = resolve(".");
const project = mkdtempSync(join(root,".next-debugger-smoke-"));
const PORT = 43127;
const base = "http://localhost:"+PORT;
const endpoint = base+"/api/next-server-api-debugger/session";
const key = "ci-test-key-"+randomBytes(3).toString("hex");
const salt = randomBytes(16);
let child;
let output = "";
try {
  if (!existsSync(join(root,"node_modules","next","dist","bin","next")))
    throw new Error("Install Next.js dependencies first");
  mkdirSync(join(project,"app"),{recursive:true});
  mkdirSync(join(project,"node_modules"),{recursive:true});
  symlinkSync(root,join(project,"node_modules","next-server-api-debugger"),"dir");
  writeFileSync(join(project,"package.json"),JSON.stringify({
    name:"debugger-runtime-smoke",
    private:true,
    dependencies:{next:"^16.0.0",react:"^19.0.0","react-dom":"^19.0.0"}
  }));
  writeFileSync(join(project,"next.config.mjs"),"export default { cacheComponents: true };\n");
  writeFileSync(join(project,"app","layout.jsx"),
    'export default function Layout({children}){return <html><body>{children}</body></html>}\n');
  writeFileSync(join(project,"app","page.jsx"),
    'export default function Page(){return <main>Hello test</main>}\n');
  writeFileSync(join(project,".env.local"),
    "NEXT_SERVER_API_DEBUGGER_KEY_HASH="+salt.toString("hex")+":"+
    scryptSync(key,salt,64).toString("hex")+"\n");
  const integrated = integrateNextApp(project);
  assert.equal(integrated.supported,true);
  child = spawn(process.execPath,[join(root,"node_modules","next","dist","bin","next"),
    "dev","--hostname","localhost","--port",String(PORT)],{
    cwd:project,env:{...process.env,NODE_ENV:"development"},stdio:["ignore","pipe","pipe"]
  });
  child.stdout.on("data",chunk=>{output+=chunk.toString();});
  child.stderr.on("data",chunk=>{output+=chunk.toString();});
  let ready = false;
  let responseStatus = "not reached";
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)break;
    try{
      const r=await fetch(endpoint,{signal:AbortSignal.timeout(3000)});
      responseStatus=String(r.status)+": "+await r.text();
      if(r.status===200){ready=true;break;}
    }catch{}
    await delay(1000);
  }
  assert.ok(ready, "Next.js debug session route never became ready. Last response: "+
    responseStatus+"\nServer output:\n"+output.slice(-5000));
  const signed=await fetch(endpoint,{
    method:"POST",headers:{"origin":base,"Content-Type":"application/json"},
    body:JSON.stringify({key}),signal:AbortSignal.timeout(10000)
  });
  const result=await signed.json();
  assert.equal(signed.status,200,"Login response: "+JSON.stringify(result)+"\n"+output.slice(-5000));
  assert.equal(result.authenticated,true);
  const cookie=signed.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("__next_server_api_debug="),"Expected debugger session cookie");
  const status=await fetch(endpoint,{headers:{cookie},signal:AbortSignal.timeout(5000)});
  assert.equal(status.status,200);
  const checked=await status.json();
  assert.equal(checked.authenticated,true,"Session was not preserved");
  const events=await fetch(base+"/api/next-server-api-debugger/events",{
    headers:{cookie},signal:AbortSignal.timeout(5000)
  });
  assert.equal(events.status,200,"Events route failed: "+await events.text());
  const eventsData=await events.json();
  assert.ok(Array.isArray(eventsData.events));
  process.stdout.write("Next.js 16 live session/login/cookie/events smoke test passed.\n");
} finally {
  if(child && child.exitCode===null) {
    child.kill("SIGTERM");
    await delay(800);
    if(child.exitCode===null)child.kill("SIGKILL");
  }
  rmSync(project,{recursive:true,force:true,maxRetries:3,retryDelay:300});
}
