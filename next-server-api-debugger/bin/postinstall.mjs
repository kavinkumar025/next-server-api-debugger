import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir=process.env.INIT_CWD || process.cwd();
const pkgFile=resolve(appDir,"package.json");
let own=false;
try { own=JSON.parse(readFileSync(pkgFile,"utf8")).name==="next-server-api-debugger"; }
catch {}
if(!existsSync(pkgFile) || own) {
  // Installing library development dependencies; do not create an app key.
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.log("[API Debugger] Set up your key with: npx next-server-api-debugger init");
} else {
  const cli=fileURLToPath(new URL("./cli.mjs",import.meta.url));
  const result=spawnSync(process.execPath,[cli,"init"],{
    cwd:appDir,env:{...process.env,NEXT_SERVER_API_DEBUGGER_PROJECT_DIR:appDir},
    stdio:"inherit"
  });
  if(result.status!==0) console.warn("[API Debugger] Run npx next-server-api-debugger init to finish setup.");
}
