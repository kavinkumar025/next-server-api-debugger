"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ApiDebugEvent } from "./server";

const BASE = "/api/__server-api-debug";
const FETCH_OPTIONS: RequestInit = { cache:"no-store", credentials:"same-origin" };
const CURSOR = "next-server-api-debugger:cursor";
function printEvent(event: ApiDebugEvent): void {
  const failed = event.status === 0 || event.status >= 400;
  const label = event.status === 0 ? "NETWORK ERROR" : "HTTP " + event.status;
  const color = failed ? "color:#dc2626;font-weight:bold" : "color:#16a34a;font-weight:bold";
  console.groupCollapsed("%c[Server API] " + event.method + " " + event.url + " → " +
    label + " (" + event.durationMs + " ms)", color);
  console.log("Request", {
    method: event.method, url: event.url, body: event.requestBody ?? "Not captured / empty"
  });
  console.log("Response", {
    status: event.status, body: event.responseBody ?? "Not captured / empty"
  });
  console.log("Time", new Date(event.time).toLocaleString());
  if (event.error) console.error("Error", event.error);
  console.groupEnd();
}
export function ApiDebugProvider({
  children, storageKey="apiDebugLoggin", pollIntervalMs=1500
}: { children: ReactNode; storageKey?: string; pollIntervalMs?: number }) {
  const [enabled,setEnabled] = useState(false);
  const [authenticated,setAuthenticated] = useState(false);
  const [secret,setSecret] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const prev = useRef(false);
  const cursor = useRef(0);
  useEffect(() => {
    try { cursor.current = Number(sessionStorage.getItem(CURSOR) || "0") || 0; } catch {}
    const sync = () => {
      let value = false;
      try { value = localStorage.getItem(storageKey) === "enabled"; } catch {}
      if (prev.current && !value) {
        void fetch(BASE + "/session", { ...FETCH_OPTIONS,method:"DELETE" }).catch(()=>{});
        setAuthenticated(false);
      }
      prev.current = value;
      setEnabled(value);
    };
    sync();
    const id = window.setInterval(sync,1000);
    window.addEventListener("storage",sync);
    return () => { window.clearInterval(id); window.removeEventListener("storage",sync); };
  },[storageKey]);
  useEffect(() => {
    if (!enabled) return;
    let alive=true;
    void fetch(BASE + "/session",FETCH_OPTIONS)
      .then(async res => res.ok ? res.json() : { authenticated:false })
      .then(data => { if(alive) setAuthenticated(Boolean(data.authenticated)); })
      .catch(()=> { if(alive) setError("Debugger routes unavailable. Check the Next.js integration."); });
    return () => { alive=false; };
  },[enabled]);
  useEffect(() => {
    if (!enabled || !authenticated) return;
    let alive=true, running=false;
    const poll=async()=> {
      if (!alive || running) return;
      running=true;
      try {
        const res=await fetch(BASE + "/events?since=" + cursor.current,FETCH_OPTIONS);
        if (res.status===401) { if(alive) setAuthenticated(false); return; }
        if (!res.ok) return;
        const data:{events?:ApiDebugEvent[]} = await res.json();
        for(const event of data.events || []) {
          if(!alive) break;
          printEvent(event);
          cursor.current=Math.max(cursor.current,event.id);
          try { sessionStorage.setItem(CURSOR,String(cursor.current)); } catch {}
        }
      } catch {} finally {running=false;}
    };
    void poll();
    const timer=window.setInterval(()=>void poll(),Math.max(pollIntervalMs,500));
    return ()=> {alive=false;window.clearInterval(timer);};
  },[enabled,authenticated,pollIntervalMs]);
  async function login(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!secret || busy) return;
    setBusy(true);setError("");
    try {
      const res=await fetch(BASE + "/session",{
        ...FETCH_OPTIONS,method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({key:secret})
      });
      const data=await res.json();
      if(!res.ok) {setError(data.error || "Authentication failed");return;}
      setSecret("");
      try { sessionStorage.removeItem(CURSOR); } catch {}
      window.location.reload();
    } catch {setError("Could not reach debugger login endpoint");}
    finally {setBusy(false);}
  }
  return <>
    {children}
    {enabled && !authenticated && <div style={{
      position:"fixed",right:16,bottom:16,width:320,maxWidth:"calc(100vw - 32px)",
      zIndex:2147483647,background:"#0f172a",color:"#f8fafc",
      border:"1px solid #334155",borderRadius:12,padding:18,
      boxShadow:"0 12px 30px rgba(0,0,0,.35)",fontFamily:"system-ui,sans-serif",fontSize:13
    }}>
      <strong style={{display:"block",marginBottom:8}}>Server API Debugger</strong>
      <p style={{color:"#cbd5e1"}}>Enter the private key chosen at install. It is never saved in localStorage.</p>
      <form onSubmit={login}>
        <input type="password" autoComplete="off" aria-label="Private debugging key"
          placeholder="Private debugging key" minLength={24} required
          value={secret} onChange={e=>setSecret(e.target.value)}
          style={{display:"block",boxSizing:"border-box",width:"100%",padding:9,
            borderRadius:6,color:"white",background:"#1e293b",
            border:"1px solid #475569",marginBottom:10}}/>
        {error && <div role="alert" style={{color:"#fca5a5",marginBottom:8}}>{error}</div>}
        <button disabled={busy} type="submit" style={{
          background:"#16a34a",color:"white",border:0,padding:"9px 14px",
          borderRadius:6,cursor:"pointer",fontWeight:600
        }}>{busy ? "Verifying..." : "Enable console logs"}</button>
      </form>
      <p style={{color:"#94a3b8"}}>Disable: localStorage.removeItem("{storageKey}")</p>
    </div>}
  </>;
}
