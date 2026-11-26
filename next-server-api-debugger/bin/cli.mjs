#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseKeyConfig, saveKeyConfig } from "./key-config.mjs";
import { integrateNextApp, integrationStatus } from "./auto-integrate.mjs";


async function main() {
  const action = process.argv[2] || "init";
  if (!["init", "status", "doctor"].includes(action)) {
    console.log("Usage: next-server-api-debugger init [--reset] | status | doctor");
    process.exitCode = 1;
    return;
  }
  const dir=process.env.NEXT_SERVER_API_DEBUGGER_PROJECT_DIR || process.cwd();
  const pkgPath=resolve(dir,"package.json");
  if(!existsSync(pkgPath)) throw new Error("Run setup from the Next.js application root.");
  const pkg=JSON.parse(readFileSync(pkgPath,"utf8"));
  if(pkg.name==="next-server-api-debugger") {
    console.log("This is the library source. Run setup in the consuming Next.js application.");
    return;
  }
  const envPath=resolve(dir,".env.local");
  let env=existsSync(envPath) ? readFileSync(envPath,"utf8") : "";
  const config=parseKeyConfig(env);
  const exists=config.key !== null || config.legacy;
  if (action === "status" || action === "doctor") {
    const wiring = integrationStatus(dir);
    console.log(wiring.supported
      ? (wiring.configured ? "Next.js debugger auto-integration: ready." : "Next.js debugger auto-integration: incomplete.")
      : "Next.js debugger auto-integration: " + wiring.reason);
    console.log("Application folder: "+dir);
    console.log(exists ? "Local debugger key configured." : "No debugger key in this application's .env.local.");
    if (config.key !== null) {
      if(action==="status") console.log("Your debugging key: "+config.key);
      if(!config.valid) console.log("The key is invalid; run init --reset.");
    } else if (config.legacy) {
      console.log("Legacy hashed key found. Its original value cannot be shown; run init --reset to create a readable key.");
    }
    if (action === "doctor") {
      const source=process.env.NEXT_SERVER_API_DEBUGGER_DOCTOR_URL || "http://localhost:3000";
      const parsed=new URL(source);
      if (!["localhost","127.0.0.1","[::1]","::1"].includes(parsed.hostname) ||
          !["http:","https:"].includes(parsed.protocol))
        throw new Error("Doctor only checks a loopback HTTP(S) server.");
      const target=new URL("/api/next-server-api-debugger/session",parsed);
      try {
        const res=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(3000)});
        const body=await res.json().catch(()=>({}));
        if(res.ok && body.ready===true)
          console.log("Runtime: debugger endpoint READY on "+target.origin+".");
        else if(res.ok)
          console.log("Runtime: endpoint returned HTTP 200, but no ready flag. Update the installed debugger package.");
        else
          console.log("Runtime: endpoint HTTP "+res.status+" ("+(body.error || "unavailable")+
            "). Restart npm run dev after changing .env.local; never use npm start for development debugging.");
      } catch {
        console.log("Runtime: cannot reach "+target.origin+". Start the app with npm run dev, then rerun doctor.");
      }
      if(config.legacy && !config.key && !/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(
          (env.match(/^NEXT_SERVER_API_DEBUGGER_KEY_HASH\s*=\s*(.*)$/m)||[])[1]||""))
        console.log("Runtime: malformed legacy key hash. Run init --reset.");
    }
    return;
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    console.log("Interactive terminal needed. Run npx next-server-api-debugger init in your Next.js app.");
    return;
  }
  // Configure supported Next.js apps after interactive terminal validation.
  const wiring=integrateNextApp(dir);
  if (!wiring.supported) {
    throw new Error(wiring.reason + " Automatic setup did not change your app.");
  }
  for (const change of wiring.changes) console.log("[API Debugger] " + change);
  if (wiring.alreadyConfigured) console.log("[API Debugger] Next.js already integrated.");
  if (exists && !process.argv.includes("--reset")) {
    console.log("A debugging key is already configured.");
    if(config.key !== null) console.log("Your existing key: "+config.key);
    else console.log("This key was previously hashed and cannot be displayed.");
    const rl = createInterface({ input: stdin, output: stdout });
    let choice;
    try { choice = (await rl.question("Replace the current debugging key now? [y/N]: ")).trim().toLowerCase(); }
    finally { rl.close(); }
    if (choice !== "y" && choice !== "yes") {
      console.log("Existing key preserved. No changes made.");
      return;
    }
  }
  console.log("\nNext Server API Debugger — readable localhost key setup\n");
  const keyPrompt=createInterface({input:stdin,output:stdout});
  let key;
  try { key=(await keyPrompt.question("Choose your key (1–24 letters, digits, dots, underscores, or hyphens): ")).trim(); }
  finally { keyPrompt.close(); }
  env=saveKeyConfig(env,key);
  writeFileSync(envPath,env,{mode:0o600});
  try{chmodSync(envPath,0o600);}catch{}
  const ignorePath=resolve(dir,".gitignore");
  const ignore=existsSync(ignorePath) ? readFileSync(ignorePath,"utf8") : "";
  if(!ignore.split(/\r?\n/).some(x=>x.trim()===".env.local" || x.trim()===".env*"))
    appendFileSync(ignorePath,(ignore && !ignore.endsWith("\n") ? "\n":"")+".env.local\n");
  console.log("✔ Your key: "+key);
  console.log("✔ Plain-text key stored in .env.local. Local development only — never commit or share this file.");
  if (exists) console.log("✔ Previous key replaced. Restart your Next.js dev server to apply the change.");
  console.log("✔ Debug secrets excluded from Git");
}
main().catch(err=> { console.error("Setup failed:",err.message); process.exitCode=1; });
