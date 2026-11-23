import type { ApiDebugEvent } from "./server";

const KEY = "apiDebugLogging";
const BASE = "/api/__server-api-debug";
const REQUEST: RequestInit = { cache: "no-store", credentials: "same-origin" };
type BrowserGlobal = Window & { __nextServerApiDebuggerAutoStarted?: boolean };

function show(event: ApiDebugEvent): void {
  const error = event.status === 0 || event.status >= 400;
  const code = event.status ? "HTTP " + event.status : "NETWORK ERROR";
  console.groupCollapsed(
    "%c[Server API] " + event.method + " " + event.url + " → " +
    code + " (" + event.durationMs + "ms)",
    error ? "color:#dc2626;font-weight:600" : "color:#16a34a;font-weight:600"
  );
  console.log("Request", {
    method: event.method, url: event.url,
    body: event.requestBody ?? "Empty or not captured"
  });
  console.log("Response", {
    status: event.status, body: event.responseBody ?? "Empty or not captured"
  });
  if (event.error) console.error("Error", event.error);
  console.log("Time", event.time);
  console.groupEnd();
}

/**
 * Runs automatically when imported from Next.js instrumentation-client.ts.
 * Does not need a root React provider or a component wrapper.
 */
export function startBrowserDebugger(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return;
  const browser = window as BrowserGlobal;
  if (browser.__nextServerApiDebuggerAutoStarted) return;
  browser.__nextServerApiDebuggerAutoStarted = true;

  let authorized = false;
  let pending = false;
  let polling = false;
  let cursor = 0;
  let lastSetting = "";
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (value:string) => { try { localStorage.setItem(KEY,value); } catch {} };

  async function logout() {
    authorized = false;
    try { await fetch(BASE+"/session",{...REQUEST,method:"DELETE"}); } catch {}
  }
  async function login(key:string) {
    pending = true;
    try {
      const response = await fetch(BASE+"/session",{
        ...REQUEST,method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({key})
      });
      const result = await response.json();
      if (!response.ok) {
        console.error("[API Debugger] "+(result.error || "Invalid debugging key"));
        return;
      }
      cursor=0;
      authorized=true;
      write("enabled");
      console.info("[API Debugger] Connected. Server requests and responses will appear below.");
    } catch {
      console.error("[API Debugger] Unable to connect to debug endpoints. Run the package init command.");
    } finally {
      pending=false;
    }
  }
  async function checkSession() {
    pending=true;
    try {
      const result=await fetch(BASE+"/session",REQUEST);
      const value=result.ok ? await result.json(): {authenticated:false};
      if(read() !== "enabled") return;
      if(value.authenticated) authorized=true;
      else {
        write("disabled");
        console.info("[API Debugger] Session expired; enter your key in "+KEY+" again.");
      }
    } catch {
      write("disabled");
      console.warn("[API Debugger] Debug session unavailable. Check your local Next.js setup.");
    } finally {pending=false;}
  }
  function sync() {
    if (pending) return;
    const value=read();
    if (value===null) { write("disabled"); lastSetting="disabled"; return; }
    if (value==="enabled") {
      if (!authorized) { void checkSession(); }
      lastSetting=value;
      return;
    }
    if(value==="disabled" || value==="") {
      if (authorized) void logout();
      lastSetting=value;
      return;
    }
    // A matching debug key is transiently in localStorage, not a secure vault.
    // Remove before sending it in a same-origin, dev-only request.
    if(value.length>24) {
      write("disabled");
      console.error("[API Debugger] Key length must be 1–24 characters.");
      return;
    }
    write("disabled");
    lastSetting="disabled";
    if (authorized) void logout().then(()=>void login(value));
    else void login(value);
  }
  async function poll() {
    if (polling || !authorized || read()!=="enabled") return;
    polling=true;
    try {
      const response=await fetch(BASE+"/events?since="+cursor,REQUEST);
      if(response.status===401) {
        authorized=false;
        write("disabled");
        console.warn("[API Debugger] Session expired. Enter your key again.");
        return;
      }
      if(!response.ok) return;
      const data: {events?:ApiDebugEvent[]} = await response.json();
      for(const event of data.events || []) {
        if(read()!=="enabled") break;
        show(event);
        cursor=Math.max(cursor,event.id);
      }
    } catch { /* Transient network issue; next poll retries. */ }
    finally {polling=false;}
  }
  sync();
  window.setInterval(sync,400);
  window.setInterval(()=>void poll(),750);
  window.addEventListener("storage",sync);
}
startBrowserDebugger();
