import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { integrateNextApp } from "./auto-integrate.mjs";

const appDir=process.env.INIT_CWD || process.cwd();
const pkgFile=resolve(appDir,"package.json");
let own=false;
try { own=JSON.parse(readFileSync(pkgFile,"utf8")).name==="next-server-api-debugger"; }
catch {}
if(!existsSync(pkgFile) || own) {
  // Installing dependencies in the library's own repository.
} else {
  try {
    const setup=integrateNextApp(appDir);
    if(!setup.supported) {
      console.log("[API Debugger] "+setup.reason+" Run init in a Next.js 16 App Router project.");
    } else {
      for(const change of setup.changes) console.log("[API Debugger] "+change);
      console.log("[API Debugger] Next.js hooks configured. If needed, run: npx next-server-api-debugger init");
    }
  } catch(error) {
    console.warn("[API Debugger] Automatic integration skipped:",error.message);
    console.warn("[API Debugger] Resolve the conflict and run: npx next-server-api-debugger init");
  }
  // npm install normally has no TTY. When foreground-scripts enables one,
  // launch the key setup without forcing user code changes on failed installs.
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const cli=fileURLToPath(new URL("./cli.mjs",import.meta.url));
    const result=spawnSync(process.execPath,[cli,"init"],{
      cwd:appDir,env:{...process.env,NEXT_SERVER_API_DEBUGGER_PROJECT_DIR:appDir},
      stdio:"inherit"
    });
    if(result.status!==0) console.warn("[API Debugger] Run npx next-server-api-debugger init to finish key setup.");
  } else {
    console.log("[API Debugger] Set or review your private key: npx next-server-api-debugger init");
  }
}
