import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { integrateNextApp, integrationStatus } from "../bin/auto-integrate.mjs";

function fixture(fn, { src=true, typescript=true, version="^16.4.6" }={}) {
  const dir=mkdtempSync(join(tmpdir(),"next-api-auto-"));
  const app=join(dir,src?"src/app":"app");
  const root=src?join(dir,"src"):dir;
  try {
    mkdirSync(app,{recursive:true});
    writeFileSync(join(dir,"package.json"),
      JSON.stringify({name:"training-app",dependencies:{next:version}}));
    if (typescript) writeFileSync(join(dir,"tsconfig.json"),"{}\n");
    fn({dir,app,root,ext:typescript?"ts":"js"});
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
test("auto installs all hooks without changing a layout; rerunning does nothing",()=>{
  fixture(({dir,app,root})=>{
    const layout=join(app,"layout.tsx");
    writeFileSync(layout,'export default function Layout(){return null;}\n');
    const first=integrateNextApp(dir);
    assert.equal(first.supported,true);
    assert.equal(first.changes.length,4);
    assert.equal(integrationStatus(dir).configured,true);
    assert.match(readFileSync(join(root,"instrumentation.ts"),"utf8"),/registerServerDebugger/);
    assert.match(readFileSync(join(root,"instrumentation-client.ts"),"utf8"),/next-server-api-debugger\/browser/);
    assert.match(readFileSync(join(app,"api","next-server-api-debugger","session","route.ts"),"utf8"),/debugSessionPOST/);
    assert.equal(readFileSync(layout,"utf8"),'export default function Layout(){return null;}\n');
    const second=integrateNextApp(dir);
    assert.equal(second.alreadyConfigured,true);
    assert.equal(second.changes.length,0);
  });
});
test("keeps prior instrumentation exports in a backup wrapper and appends browser side-effect import",()=>{
  fixture(({dir,app,root})=>{
    const server=join(root,"instrumentation.ts");
    const original='export function register() { console.log("existing"); }\nexport function onRequestError() {}\n';
    writeFileSync(server,original);
    const client=join(root,"instrumentation-client.ts");
    const existingClient='export function onRouterTransitionStart(url: string) { console.log(url); }\n';
    writeFileSync(client,existingClient);
    integrateNextApp(dir);
    assert.equal(readFileSync(join(root,"instrumentation.next-server-api-debugger-original.ts"),"utf8"),original);
    const wrapper=readFileSync(server,"utf8");
    assert.match(wrapper,/export \* from/);
    assert.match(wrapper,/existingRegister/);
    assert.match(wrapper,/registerServerDebugger/);
    assert.ok(readFileSync(client,"utf8").startsWith(existingClient));
    assert.match(readFileSync(client,"utf8"),/next-server-api-debugger\/browser/);
    assert.equal(integrateNextApp(dir).changes.length,0);
  });
});
test("never overwrites conflicting application route handlers",()=>{
  fixture(({dir,app,root})=>{
    const sessionDir=join(app,"api","next-server-api-debugger","session");
    mkdirSync(sessionDir,{recursive:true});
    const route=join(sessionDir,"route.ts");
    writeFileSync(route,'export function GET(){ return Response.json({ mine: true }); }\n');
    assert.throws(()=>integrateNextApp(dir),/conflicts/);
    assert.equal(readFileSync(route,"utf8"),'export function GET(){ return Response.json({ mine: true }); }\n');
    assert.equal(existsSync(join(root,"instrumentation.ts")),false);
  });
});
test("supports JavaScript-only Next.js App Router",()=>{
  fixture(({dir,app,root})=>{
    assert.equal(integrateNextApp(dir).supported,true);
    assert.ok(existsSync(join(root,"instrumentation.js")));
    assert.ok(existsSync(join(root,"instrumentation-client.js")));
    assert.ok(existsSync(join(app,"api","next-server-api-debugger","events","route.js")));
  },{typescript:false,src:false});
});
test("skips projects outside supported Next.js 16 App Router",()=>{
  fixture(({dir,root})=>{
    const result=integrateNextApp(dir);
    assert.equal(result.supported,false);
    assert.match(result.reason,/Next.js 16/);
    assert.equal(existsSync(join(root,"instrumentation.ts")),false);
  },{version:"^15.5.0"});
});

test("keeps a JavaScript instrumentation file valid inside a TypeScript app",()=>{
  fixture(({dir,root})=>{
    writeFileSync(join(root,"instrumentation.js"),
      'export async function register() { console.info("original"); }\n');
    integrateNextApp(dir);
    const output=readFileSync(join(root,"instrumentation.js"),"utf8");
    assert.match(output,/originalInstrumentation\.register/);
    assert.doesNotMatch(output,/\bas\s*\{\s*register/);
  });
});
test("rejects the opposite JS/TS API route extension",()=>{
  fixture(({dir,app,root})=>{
    const path=join(app,"api","next-server-api-debugger","session");
    mkdirSync(path,{recursive:true});
    writeFileSync(join(path,"route.js"),"export function GET() { return new Response('other'); }\n");
    assert.throws(()=>integrateNextApp(dir),/Conflicting debugger route extension/);
    assert.equal(existsSync(join(root,"instrumentation.ts")),false);
  });
});
test("does not split instrumentation between root and src",()=>{
  fixture(({dir,root})=>{
    writeFileSync(join(root,"instrumentation-client.ts"),'export const x = 1;\n');
    writeFileSync(join(dir,"instrumentation.ts"),'export function register() {}\n');
    assert.throws(()=>integrateNextApp(dir),/split across root and src/);
  });
});
