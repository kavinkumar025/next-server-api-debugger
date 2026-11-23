"use client";

import { useEffect, type ReactNode } from "react";
import type { ApiDebugEvent } from "./server";

const BASE = "/api/next-server-api-debugger";
const HTTP: RequestInit = { cache: "no-store", credentials: "same-origin" };

function printEvent(event: ApiDebugEvent): void {
  const failed = event.status === 0 || event.status >= 400;
  const status = event.status === 0 ? "NETWORK ERROR" : "HTTP " + event.status;
  const style = failed ? "color:#dc2626;font-weight:bold" : "color:#16a34a;font-weight:bold";
  console.groupCollapsed(
    "%c[Server API] " + event.method + " " + event.url + " → " + status +
    " (" + event.durationMs + " ms)", style
  );
  console.log("Request", {
    method: event.method, url: event.url,
    body: event.requestBody ?? "Empty or not captured"
  });
  console.log("Response", {
    status: event.status, body: event.responseBody ?? "Empty or not captured"
  });
  console.log("Time", new Date(event.time).toLocaleString());
  if (event.error) console.error("Request error:", event.error);
  console.groupEnd();
}

/**
 * The chosen key is briefly present in localStorage until this provider reads
 * and removes it. Browser storage is NOT secret. Use only with a local dev app.
 * After validation, localStorage contains only "enabled", never the key.
 */
export function ApiDebugProvider({
  children, storageKey = "apiDebugLogging", pollIntervalMs = 750
}: { children: ReactNode; storageKey?: string; pollIntervalMs?: number }) {
  useEffect(() => {
    let disposed = false;
    let authorized = false;
    let pending = false;
    let polling = false;
    let cursor = 0;

    const setSetting = (value: string) => {
      try { localStorage.setItem(storageKey, value); } catch {}
    };
    const readSetting = () => {
      try { return localStorage.getItem(storageKey); } catch { return null; }
    };

    async function signOut(): Promise<void> {
      authorized = false;
      try {
        await fetch(BASE + "/session", { ...HTTP, method: "DELETE" });
      } catch {
        // Disabling console output remains immediate even if the server is offline.
      }
    }

    async function checkExistingSession(): Promise<void> {
      pending = true;
      try {
        const response = await fetch(BASE + "/session", HTTP);
        const data = response.ok ? await response.json() : { authenticated: false };
        if (disposed || readSetting() !== "enabled") return;
        if (data.authenticated) {
          authorized = true;
          console.info("[API Debugger] Connected. Replaying available server API calls.");
        } else {
          setSetting("disabled");
          console.info("[API Debugger] Session expired. Set " + storageKey + " to your debug key again.");
        }
      } catch {
        if (!disposed) {
          setSetting("disabled");
          console.warn("[API Debugger] Debug endpoints unavailable. Check your Next.js setup.");
        }
      } finally { pending = false; }
    }

    async function signIn(key: string): Promise<void> {
      pending = true;
      if (authorized) await signOut();
      try {
        const response = await fetch(BASE + "/session", {
          ...HTTP, method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key })
        });
        const data = await response.json();
        if (disposed) return;
        if (!response.ok) {
          console.error("[API Debugger] " + (data.error || "Key not accepted") +
            ". Set " + storageKey + " to your key to retry.");
          return;
        }
        cursor = 0;
        authorized = true;
        setSetting("enabled");
        console.info("[API Debugger] Key verified. Server API requests and responses will appear here.");
      } catch {
        if (!disposed) console.error("[API Debugger] Cannot connect. Check debugger routes and restart dev server.");
      } finally { pending = false; }
    }

    function sync(): void {
      if (disposed || pending) return;
      const value = readSetting();
      if (value === null) {
        setSetting("disabled");
        return;
      }
      if (value === "enabled") {
        if (!authorized) void checkExistingSession();
        return;
      }
      if (value === "" || value === "disabled") {
        if (authorized) void signOut();
        return;
      }
      // Read-and-clear first, before making network requests. A browser-stored
      // secret remains observable to scripts during this short interval.
      setSetting("disabled");
      if (value.length > 24) {
        console.error("[API Debugger] Your debugging key must contain 1–24 characters.");
        return;
      }
      void signIn(value);
    }

    async function poll(): Promise<void> {
      if (!authorized || polling || disposed || readSetting() !== "enabled") return;
      polling = true;
      try {
        const res = await fetch(BASE + "/events?since=" + cursor, HTTP);
        if (res.status === 401) {
          authorized = false;
          setSetting("disabled");
          console.warn("[API Debugger] Session expired. Enter your debug key again.");
          return;
        }
        if (!res.ok) return;
        const data: { events?: ApiDebugEvent[] } = await res.json();
        for (const event of data.events || []) {
          if (disposed || readSetting() !== "enabled") break;
          printEvent(event);
          cursor = Math.max(cursor, event.id);
        }
      } catch {
        // Temporary network issues should not stop future polling.
      } finally { polling = false; }
    }

    sync();
    const syncTimer = window.setInterval(sync, 400);
    const pollTimer = window.setInterval(() => void poll(), Math.max(500, pollIntervalMs));
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      disposed = true;
      window.clearInterval(syncTimer);
      window.clearInterval(pollTimer);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey, pollIntervalMs]);

  return <>{children}</>;
}
