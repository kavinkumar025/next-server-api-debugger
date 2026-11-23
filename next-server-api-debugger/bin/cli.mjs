#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { integrateNextApp, integrationStatus } from "./auto-integrate.mjs";


function hidden(question) {
  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode)
    throw new Error("A real interactive terminal is required.");
  return new Promise((done,fail) => {
    let value="";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    function cleanup(err) {
      stdin.removeListener("data",onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      err ? fail(err) : done(value);
    }
    function onData(text) {
      for(const ch of text) {
        if(ch==="\r" || ch==="\n") return cleanup();
        if(ch==="\u0003") return cleanup(new Error("Setup cancelled"));
        if(ch==="\u007f" || ch==="\b") value=value.slice(0,-1);
        else if(ch>=" ") value+=ch;
      }
    }
    stdin.on("data",onData);
  });
}
async function main() {
  const action = process.argv[2] || "init";
  if (!["init", "status"].includes(action)) {
    console.log("Usage: next-server-api-debugger init [--reset] | status");
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
  const exists=/^NEXT_SERVER_API_DEBUGGER_KEY_HASH\s*=/m.test(env);
  if (action === "status") {
    const wiring = integrationStatus(dir);
    console.log(wiring.supported
      ? (wiring.configured ? "Next.js debugger auto-integration: ready." : "Next.js debugger auto-integration: incomplete.")
      : "Next.js debugger auto-integration: " + wiring.reason);
    console.log(exists
      ? "Debug key configured in this application's .env.local."
      : "No debug key found in this application's .env.local.");
    if (exists) {
      console.log("The original key cannot be displayed: only its salted hash is stored.");
      console.log("Ask your organization for the shared key or run: npx next-server-api-debugger init --reset");
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
    console.log("For safety, the original key cannot be shown because only a salted hash was stored.");
    console.log("Ask your team administrator or password manager for the original key.");
    const rl = createInterface({ input: stdin, output: stdout });
    let choice;
    try { choice = (await rl.question("Replace the current debugging key now? [y/N]: ")).trim().toLowerCase(); }
    finally { rl.close(); }
    if (choice !== "y" && choice !== "yes") {
      console.log("Existing key preserved. No changes made.");
      return;
    }
  }
  console.log("\nNext Server API Debugger — private key setup\n");
  // One simple prompt — no numeric menu or 24-character minimum.
  const key=await hidden("Choose your debug key (1-24 characters, hidden): ");
  if(key.length<1 || key.length>24 || /[\r\n]/.test(key))
    throw new Error("Key must contain 1–24 characters, with no newlines.");
  const salt=randomBytes(16);
  const hash=scryptSync(key,salt,64);
  const row="NEXT_SERVER_API_DEBUGGER_KEY_HASH="+salt.toString("hex")+":"+hash.toString("hex");
  env=exists ? env.replace(/^NEXT_SERVER_API_DEBUGGER_KEY_HASH\s*=.*$/m,row) :
    env+(env && !env.endsWith("\n") ? "\n":"")+row+"\n";
  writeFileSync(envPath,env,{mode:0o600});
  try{chmodSync(envPath,0o600);}catch{}
  const ignorePath=resolve(dir,".gitignore");
  const ignore=existsSync(ignorePath) ? readFileSync(ignorePath,"utf8") : "";
  if(!ignore.split(/\r?\n/).some(x=>x.trim()===".env.local" || x.trim()===".env*"))
    appendFileSync(ignorePath,(ignore && !ignore.endsWith("\n") ? "\n":"")+".env.local\n");
  console.log("✔ Salted key hash saved in .env.local (original key not saved)");
  if (exists) console.log("✔ Previous key replaced. Restart your Next.js dev server to apply the change.");
  console.log("✔ Debug secrets excluded from Git");
}
main().catch(err=> { console.error("Setup failed:",err.message); process.exitCode=1; });
