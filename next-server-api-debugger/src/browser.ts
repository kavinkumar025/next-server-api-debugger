import type { ApiDebugEvent } from "./server";

const KEY = "apiDebugLogging";
const BASE = "/api/next-server-api-debugger";
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
  if (typeof window === "undefined") return; // Server decides whether debugging is enabled.
  const browser = window as BrowserGlobal;
  if (browser.__nextServerApiDebuggerAutoStarted) return;
  browser.__nextServerApiDebuggerAutoStarted = true;

  let authorized = false;
  let pending = false;
  let polling = false;
  let cursor = 0;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (value:string) => { try { localStorage.setItem(KEY,value); } catch {} };

  async function logout() {
    authorized = false;
    try { await fetch(BASE+"/session",{...REQUEST,method:"DELETE"}); } catch {}
  }
  async function login(key:string) {
    pending = true;
    try {
      if (authorized) await logout();
      const response = await fetch(BASE+"/session",{
        ...REQUEST,method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({key})
      });
      const result: { authenticated?:boolean; error?:string } =
        await response.json().catch(()=>({}));
      // A user can turn logging off while the request is in flight.
      // Never re-enable it after they have done so.
      if (read() !== "connecting") {
        if (response.ok) await logout();
        return;
      }
      if (!response.ok || result.authenticated !== true) {
        write("error:"+response.status);
        console.error("[API Debugger] Key verification failed ("+response.status+"): "+
          (result.error || "Debug session not accepted")+
          ". Check your key and run npx next-server-api-debugger doctor.");
        return;
      }
      cursor = 0;
      authorized = true;
      write("enabled");
      console.info("[API Debugger] Connected. Server requests and responses will appear below.");
    } catch {
      if (read() === "connecting") write("error:network");
      console.error("[API Debugger] Unable to verify key. Check your dev server and debugger routes.");
    } finally {
      pending = false;
    }
  }
  async function checkSession() {
    pending = true;
    try {
      const response = await fetch(BASE+"/session",REQUEST);
      const value = response.ok ? await response.json(): {authenticated:false};
      if (read() !== "enabled") return;
      if (value.authenticated) authorized = true;
      else {
        write("error:session-expired");
        console.info("[API Debugger] No active session. Enter your configured key in apiDebugLogging.");
      }
    } catch {
      if (read() === "enabled") {
        write("error:network");
        console.warn("[API Debugger] Debug session unavailable. Check your local Next.js setup.");
      }
    } finally { pending = false; }
  }
  function sync() {
    if (pending) return;
    const value = read();
    if (value === null) { write("disabled"); return; }
    if (value === "enabled") {
      if (!authorized) void checkSession();
      return;
    }
    if (value === "disabled" || value === "") {
      if (authorized) void logout();
      return;
    }
    // Leave failed authentication visible in the same Local Storage key.
    // To retry, replace the error state with the configured developer key.
    if (value.startsWith("error:")) return;
    if (value === "connecting") {
      // A reload may interrupt a previous login attempt.
      write("disabled");
      console.warn("[API Debugger] Interrupted login. Enter your key again.");
      return;
    }
    if (value.length > 128) {
      write("disabled");
      console.error("[API Debugger] Key length must be 1–128 characters.");
      return;
    }
    // Clear the plaintext key immediately. Show an explicit in-progress state
    // rather than making DevTools appear to reject the storage edit.
    write("connecting");
    console.info("[API Debugger] Verifying key…");
    void login(value);
  }
  async function poll() {
    if (polling || !authorized || read()!=="enabled") return;
    polling=true;
    try {
      const response=await fetch(BASE+"/events?since="+cursor,REQUEST);
      if(response.status===401) {
        authorized=false;
        write("error:session-expired");
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
