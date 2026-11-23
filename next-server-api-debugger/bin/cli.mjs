#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

async function ask(question) {
  const rl = createInterface({ input:stdin, output:stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}
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
  if (process.argv[2] !== "init") {
    console.log("Usage: next-server-api-debugger init [--reset]");
    process.exitCode=1;
    return;
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    console.log("No interactive terminal. Run npx next-server-api-debugger init in your Next.js app.");
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
  if(exists && !process.argv.includes("--reset")) {
    console.log("Key is configured. Run npx next-server-api-debugger init --reset to rotate it.");
    return;
  }
  console.log("\nNext Server API Debugger — private key setup\n");
  const choice=(await ask("Choose key: [1] Custom (default) / [2] Generate: ")).trim();
  let key;
  if(choice==="2") {
    key=randomBytes(32).toString("base64url");
    console.log("Generated key (displayed once, save it privately): "+key);
  } else {
    key=await hidden("Enter a private key (hidden; 24+ characters): ");
  }
  if(key.length<24 || key.length>1024 || /[\r\n]/.test(key))
    throw new Error("Key must be 24–1024 characters with no newlines.");
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
  console.log("✔ Debug secrets excluded from Git");
}
main().catch(err=> { console.error("Setup failed:",err.message); process.exitCode=1; });
