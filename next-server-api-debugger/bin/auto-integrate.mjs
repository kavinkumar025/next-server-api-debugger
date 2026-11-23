import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const MARKER = "next-server-api-debugger:auto-generated";
const BROWSER_IMPORT = 'import "next-server-api-debugger/browser";';
const ROUTE_SESSION = [
  "// " + MARKER,
  'import { debugSessionGET, debugSessionPOST, debugSessionDELETE } from "next-server-api-debugger/server";',
  'export const runtime = "nodejs";',
  'export const dynamic = "force-dynamic";',
  'export { debugSessionGET as GET, debugSessionPOST as POST, debugSessionDELETE as DELETE };',
  ""
].join("\n");
const ROUTE_EVENTS = [
  "// " + MARKER,
  'import { debugEventsGET } from "next-server-api-debugger/server";',
  'export const runtime = "nodejs";',
  'export const dynamic = "force-dynamic";',
  'export { debugEventsGET as GET };',
  ""
].join("\n");
const BOOTSTRAP = [
  '  if (process.env.NEXT_RUNTIME === "nodejs") {',
  '    const { registerServerDebugger } = await import("next-server-api-debugger/server");',
  '    registerServerDebugger({ captureBodies: true, maxBodyBytes: 8000 });',
  '  }'
].join("\n");

const read = path => readFileSync(path, "utf8");
const hasMarker = path => existsSync(path) && read(path).includes(MARKER);
function existing(root, basename) {
  const paths = ["ts", "js"].map(ext => join(root, basename + "." + ext)).filter(existsSync);
  if (paths.length > 1) throw new Error("Both JS and TS " + basename + " files exist in " + root);
  return paths[0];
}
function detect(dir) {
  dir = resolve(dir);
  const pkgFile = join(dir,"package.json");
  if (!existsSync(pkgFile)) throw new Error("Run the command in your Next.js app (package.json not found).");
  const pkg = JSON.parse(read(pkgFile));
  if (pkg.name === "next-server-api-debugger") return { supported:false, reason:"Library source repository." };
  const version = pkg.dependencies?.next || pkg.devDependencies?.next || "";
  if (!version) return { supported:false, reason:"Not a Next.js project." };
  if (!/(^|[^0-9])16(?:[.\s]|$)/.test(version))
    return { supported:false, reason:"Automatic setup supports Next.js 16 App Router only." };
  const app = existsSync(join(dir,"app")) ? join(dir,"app") :
    existsSync(join(dir,"src","app")) ? join(dir,"src","app") : null;
  if (!app) return { supported:false, reason:"No app/ or src/app/ directory found." };
  const preferred = dirname(app);
  const other = preferred === dir ? join(dir,"src") : dir;
  for (const filename of ["instrumentation","instrumentation-client"]) {
    if (existing(preferred,filename) && existing(other,filename)) {
      throw new Error("Conflicting " + filename + " files at root and src/. Please reconcile them.");
    }
  }
  const root = existing(other,"instrumentation") || existing(other,"instrumentation-client") ? other : preferred;
  const server = existing(root,"instrumentation");
  const browser = existing(root,"instrumentation-client");
  const ext = existsSync(join(dir,"tsconfig.json")) || server?.endsWith(".ts") || browser?.endsWith(".ts") ? "ts" : "js";
  return { supported:true, dir, app, root, server, browser, ext };
}
export function integrationStatus(dir) {
  const info = detect(dir);
  if (!info.supported) return { supported:false, configured:false, reason:info.reason };
  const paths = [
    info.server || join(info.root,"instrumentation."+info.ext),
    info.browser || join(info.root,"instrumentation-client."+info.ext),
    join(info.app,"api","next-server-api-debugger","session","route."+info.ext),
    join(info.app,"api","next-server-api-debugger","events","route."+info.ext)
  ];
  return { supported:true, configured:hasMarker(paths[0]) &&
    existsSync(paths[1]) && read(paths[1]).includes(BROWSER_IMPORT) &&
    hasMarker(paths[2]) && hasMarker(paths[3]) };
}
export function integrateNextApp(dir, {dryRun=false}={}) {
  const info=detect(dir);
  if (!info.supported) return {supported:false,reason:info.reason,changes:[]};
  const {app,root,ext}=info;
  const server=info.server || join(root,"instrumentation."+ext);
  const client=info.browser || join(root,"instrumentation-client."+ext);
  const session=join(app,"api","next-server-api-debugger","session","route."+ext);
  const events=join(app,"api","next-server-api-debugger","events","route."+ext);
  const changes=[];
  const ensureRoute=(path,source)=>{
    if (existsSync(path) && !hasMarker(path))
      throw new Error("Debugger route conflicts with an existing file: "+relative(info.dir,path));
    if (!existsSync(path)) changes.push({type:"write",path,source});
  };
  ensureRoute(session,ROUTE_SESSION);
  ensureRoute(events,ROUTE_EVENTS);
  if (!existsSync(server)) {
    changes.push({type:"write",path:server,
      source:"// "+MARKER+"\nexport async function register() {\n"+BOOTSTRAP+"\n}\n"});
  } else if (!hasMarker(server)) {
    const old=join(root,"instrumentation.next-server-api-debugger-original."+server.split(".").pop());
    if (existsSync(old)) throw new Error("Existing instrumentation backup blocks auto-setup: "+relative(info.dir,old));
    const importPath="./"+basename(old).replace(/\.(js|ts)$/,"");
    const oldRegister=ext==="ts"
      ? "(originalInstrumentation as { register?: () => unknown }).register"
      : "originalInstrumentation.register";
    const source=[
      "// "+MARKER,
      'import * as originalInstrumentation from "'+importPath+'";',
      'export * from "'+importPath+'";',
      'export async function register() {',
      BOOTSTRAP,
      '  const existingRegister = '+oldRegister+';',
      '  if (typeof existingRegister === "function") await existingRegister();',
      '}',''
    ].join("\n");
    changes.push({type:"rename",path:server,to:old});
    changes.push({type:"write",path:server,source});
  }
  if (!existsSync(client)) {
    changes.push({type:"write",path:client,source:"// "+MARKER+"\n"+BROWSER_IMPORT+"\n"});
  } else if (!read(client).includes(BROWSER_IMPORT)) {
    const src=read(client);
    changes.push({type:"write",path:client,
      source:src+(src.endsWith("\n")?"":"\n")+"// "+MARKER+"\n"+BROWSER_IMPORT+"\n"});
  }
  if (!dryRun) {
    for (const op of changes) {
      if (op.type==="rename") renameSync(op.path,op.to);
      else { mkdirSync(dirname(op.path),{recursive:true}); writeFileSync(op.path,op.source); }
    }
  }
  return {supported:true,reason:null,alreadyConfigured:changes.length===0,
    changes:changes.map(c=>(c.type==="rename"?"Backed up ":"Configured ")+relative(info.dir,c.to||c.path))};
}
