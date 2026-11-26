import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync,mkdtempSync,mkdirSync,rmSync,symlinkSync,writeFileSync } from "node:fs";
import { resolve,join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { integrateNextApp } from "../bin/auto-integrate.mjs";

const root=resolve(".");
const dir=mkdtempSync(join(root,".production-debugger-smoke-"));
const port=43128;
const origin="http://localhost:"+port;
const url=origin+"/api/next-server-api-debugger/session";
const key=randomBytes(32).toString("base64url");
let server;
let output="";
try{
  if(!existsSync(join(root,"node_modules","next","dist","bin","next")))
    throw new Error("Next.js missing");
  mkdirSync(join(dir,"app"),{recursive:true});
  mkdirSync(join(dir,"node_modules"),{recursive:true});
  symlinkSync(root,join(dir,"node_modules","next-server-api-debugger"),"dir");
  writeFileSync(join(dir,"package.json"),JSON.stringify({
    name:"debugger-prod-smoke",private:true,
    dependencies:{next:"^16.0.0",react:"^19.0.0","react-dom":"^19.0.0"}
  }));
  writeFileSync(join(dir,"next.config.mjs"),"export default { cacheComponents: true };\n");
  writeFileSync(join(dir,"app","layout.jsx"),
    'export default function Layout({children}){return <html><body>{children}</body></html>}\n');
  writeFileSync(join(dir,"app","page.jsx"),
    'export default function Page(){return <main>production smoke</main>}\n');
  writeFileSync(join(dir,".env.local"),[
    "NEXT_SERVER_API_DEBUGGER_PRODUCTION_ENABLED=true",
    "NEXT_SERVER_API_DEBUGGER_PRODUCTION_KEY="+key,
    "NEXT_SERVER_API_DEBUGGER_PRODUCTION_ORIGIN="+origin,""
  ].join("\n"));
  assert.equal(integrateNextApp(dir).supported,true);
  const next=join(root,"node_modules","next","dist","bin","next");
  const env={...process.env,NEXT_TELEMETRY_DISABLED:"1"};
  const build=spawnSync(process.execPath,[next,"build"],{
    cwd:dir,env,encoding:"utf8",timeout:120000
  });
  assert.equal(build.status,0,"Next.js production build failed:\n"+build.stdout+"\n"+build.stderr);
  server=spawn(process.execPath,[next,"start","--hostname","localhost","--port",String(port)],{
    cwd:dir,env,stdio:["ignore","pipe","pipe"]
  });
  server.stdout.on("data",c=>{output+=c.toString();});
  server.stderr.on("data",c=>{output+=c.toString();});
  let ready=false;
  const deadline=Date.now()+45000;
  while(Date.now()<deadline){
    if(server.exitCode!==null)break;
    try{
      const res=await fetch(url,{signal:AbortSignal.timeout(2500)});
      if(res.status===200){
        const body=await res.json();
        if(body.ready && body.mode==="production"){ready=true;break;}
      }
    }catch{}
    await delay(1000);
  }
  assert.ok(ready,"Production debug route never ready:\n"+output.slice(-4000));
  const signed=await fetch(url,{method:"POST",headers:{
    origin,"Content-Type":"application/json"
  },body:JSON.stringify({key}),signal:AbortSignal.timeout(10000)});
  const result=await signed.json();
  assert.equal(signed.status,200,"Production login failed: "+JSON.stringify(result));
  const cookie=signed.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("__next_server_api_debug="));
  const checked=await fetch(url,{headers:{cookie},signal:AbortSignal.timeout(10000)});
  assert.equal((await checked.json()).authenticated,true);
  const events=await fetch(origin+"/api/next-server-api-debugger/events",{
    headers:{cookie},signal:AbortSignal.timeout(10000)
  });
  assert.equal(events.status,200,"Production event route status "+events.status);
  assert.ok(Array.isArray((await events.json()).events));
  process.stdout.write("Next.js production build/start/login/session/events passed.\n");
}finally{
  if(server && server.exitCode===null){
    server.kill("SIGTERM");
    await delay(800);
    if(server.exitCode===null)server.kill("SIGKILL");
  }
  rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:300});
}
