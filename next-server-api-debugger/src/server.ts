/**
 * Next.js Node.js App Router developer-only request logger.
 * In-memory state is NOT for distributed production environments.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const COOKIE = "__next_server_api_debug";
const DEBUG_ROUTE = "/api/next-server-api-debugger/";
const TTL = 30 * 60 * 1000;
const MAX_LOGS = 5000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const STORE_KEY = Symbol.for("next-server-api-debugger.store.v1");
const FETCH_KEY = Symbol.for("next-server-api-debugger.fetch.v1");
const SENSITIVE = /authorization|token|secret|password|passcode|cookie|api.?key|session|email|phone|mobile|address|card|otp|cvv|dob|ssn|credential/i;

export type ApiDebugEvent = {
  id: number;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  time: string;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
};
export type ServerDebuggerOptions = {
  /** Capture small JSON previews only; false by default. */
  captureBodies?: boolean;
  /** Maximum JSON body preview, capped to 64 KiB. */
  maxBodyBytes?: number;
};
type Session = { expires: number };
type Attempt = { count: number; until: number };
type Store = {
  sessions: Map<string, Session>;
  attempts: Map<string, Attempt>;
  nextId: number;
  logs: ApiDebugEvent[];
  options: ServerDebuggerOptions;
};
type FetchWithMarker = typeof fetch & Record<symbol, boolean | undefined>;
const globalStore = globalThis as typeof globalThis & Record<symbol, Store | undefined>;
function store(): Store {
  return globalStore[STORE_KEY] ??= {
    sessions: new Map(), attempts: new Map(), nextId: 0, logs: [],
    options: { captureBodies: true, maxBodyBytes: 8000 }
  };
}
function plainKey(): string | null {
  const value = process.env.NEXT_SERVER_API_DEBUGGER_KEY ?? "";
  return /^[A-Za-z0-9._-]{1,24}$/.test(value) ? value : null;
}
function validLegacyHash(): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(process.env.NEXT_SERVER_API_DEBUGGER_KEY_HASH ?? "");
}
function enabled(): boolean {
  return process.env.NODE_ENV === "development" && (plainKey() !== null || validLegacyHash());
}
function matchesKey(key: string): boolean {
  if (key.length < 1 || key.length > 24) return false;
  const plain = plainKey();
  if (plain !== null) {
    const actual = Buffer.from(key, "utf8");
    const expected = Buffer.from(plain, "utf8");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  if (!validLegacyHash()) return false;
  const [salt,digest] = (process.env.NEXT_SERVER_API_DEBUGGER_KEY_HASH ?? "").split(":");
  return timingSafeEqual(scryptSync(key, Buffer.from(salt,"hex"),64),Buffer.from(digest,"hex"));
}
function active(token?: string): Session | undefined {
  if (!token) return undefined;
  const s = store().sessions.get(token);
  if (!s) return undefined;
  if (s.expires > Date.now()) return s;
  store().sessions.delete(token);
  return undefined;
}
function cookieToken(req: Request): string | undefined {
  const field = (req.headers.get("cookie") ?? "").split(";").map(p => p.trim())
    .find(p => p.startsWith(COOKIE + "="));
  return field?.slice(COOKIE.length + 1);
}
function response(body: unknown, status=200, headers: Record<string,string>={}): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff", ...headers }
  });
}
function disabledResponse(req: Request): Response {
  if (!localRequest(req) || process.env.NODE_ENV !== "development")
    return response({error:"Debugger is disabled"},404);
  return response({error:"Debugger key not loaded in this Next.js dev process. Run init --reset in this application's folder and restart npm run dev."},404);
}
function localRequest(req: Request): boolean {
  try { return LOCAL_HOSTS.has(new URL(req.url).hostname.toLowerCase()); }
  catch { return false; }
}
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const caller = new URL(origin);
    const internal = new URL(req.url);
    if (caller.origin === internal.origin) return true;
    // Next.js can use an internal loopback address while preserving the public Host.
    // Permit this only for same-scheme local requests with matching Host.
    const host = req.headers.get("host");
    return Boolean(host) && LOCAL_HOSTS.has(caller.hostname.toLowerCase()) &&
      LOCAL_HOSTS.has(internal.hostname.toLowerCase()) &&
      caller.protocol === internal.protocol &&
      caller.host.toLowerCase() === host!.toLowerCase();
  } catch { return false; }
}
function safe(value: unknown, depth=0): unknown {
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return value.slice(0, 2000);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(v => safe(v, depth + 1));
  if (typeof value === "object" && value) {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([key,v]) =>
      [key, SENSITIVE.test(key) ? "[REDACTED]" : safe(v, depth + 1)]));
  }
  return "[unsupported]";
}
function safeUrl(raw: string): string {
  try {
    const url = new URL(raw, "http://localhost");
    url.username = "";
    url.password = "";
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return (url.origin === "http://localhost" ? url.pathname + url.search : url.toString()).slice(0, 2048);
  } catch { return "[invalid URL]"; }
}
function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input :
    input instanceof URL ? input.href : input.url;
}
async function jsonPreview(source: Request | Response, limit: number): Promise<unknown> {
  if (!/application\/json|[+]json/i.test(source.headers.get("content-type") ?? "")) return "[non-JSON omitted]";
  if (!source.body) return undefined;
  const declared = Number(source.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return "[body too large]";
  let copy: Request | Response;
  try { copy = source.clone(); } catch { return "[unavailable]"; }
  if (!copy.body) return undefined;
  const reader = copy.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) return "[body too large]";
      chunks.push(part.value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    try { return safe(JSON.parse(new TextDecoder().decode(all))); }
    catch { return "[invalid JSON omitted]"; }
  } catch { return "[body unavailable]"; }
  finally { void reader.cancel().catch(() => {}); }
}
function addLog(event: Omit<ApiDebugEvent,"id"|"time">): void {
  const s = store();
  const entry: ApiDebugEvent = { ...event, id: ++s.nextId, time: new Date().toISOString() };
  s.logs.push(entry);
  if (s.logs.length > MAX_LOGS) s.logs.splice(0, s.logs.length - MAX_LOGS);
  const status = entry.status === 0 ? "NETWORK ERROR" : "HTTP " + entry.status;
  // Server-side fallback: if browser transport isn't ready, developers still see the event.
  console.info("[Server API]", entry.method, entry.url, "→", status, "(" + entry.durationMs + "ms)");
  if (entry.requestBody !== undefined) console.info("  Request:", entry.requestBody);
  if (entry.responseBody !== undefined) console.info("  Response:", entry.responseBody);
  if (entry.error) console.error("  Error:", entry.error);
}
async function capture(original: typeof fetch, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = requestUrl(input);
  if (!enabled() || raw.includes(DEBUG_ROUTE)) return original(input, init);
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const opts = store().options;
  const limit = Math.min(Math.max(opts.maxBodyBytes ?? 8000, 100), 65536);
  let requestBody: unknown;
  if (opts.captureBodies) {
    if (typeof init?.body === "string") {
      if (new TextEncoder().encode(init.body).byteLength > limit) requestBody = "[body too large]";
      else { try { requestBody = safe(JSON.parse(init.body)); } catch { requestBody = "[non-JSON omitted]"; } }
    } else if (input instanceof Request && !init?.body) {
      requestBody = await jsonPreview(input, limit);
    }
  }
  const started = performance.now();
  try {
    const res = await original(input, init);
    const responseBody = opts.captureBodies ? await jsonPreview(res, limit) : undefined;
    addLog({
      method, url: safeUrl(raw), status: res.status,
      durationMs: Math.round(performance.now()-started), requestBody, responseBody
    });
    return res;
  } catch (err) {
    addLog({
      method, url: safeUrl(raw), status: 0,
      durationMs: Math.round(performance.now()-started), requestBody,
      error: "Request failed before receiving a response"
    });
    throw err;
  }
}
/** Install at Node.js startup from instrumentation.ts. Best-effort global fetch wrapping. */
export function registerServerDebugger(options: ServerDebuggerOptions = {}): void {
  if (!enabled()) {
    if (process.env.NODE_ENV === "development")
      console.warn("[API Debugger] Run npx next-server-api-debugger init in your Next.js project.");
    return;
  }
  store().options = { captureBodies: options.captureBodies ?? true, maxBodyBytes: options.maxBodyBytes ?? 8000 };
  const current = globalThis.fetch as FetchWithMarker;
  if (current[FETCH_KEY]) return;
  const original = globalThis.fetch.bind(globalThis);
  const patched = ((input: RequestInfo | URL, init?: RequestInit) => capture(original, input, init)) as FetchWithMarker;
  patched[FETCH_KEY] = true;
  globalThis.fetch = patched;
}
/** Explicit alternative when Next.js replaces global fetch instrumentation. */
export function debugFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if ((globalThis.fetch as FetchWithMarker)[FETCH_KEY]) return globalThis.fetch(input, init);
  return capture(globalThis.fetch.bind(globalThis), input, init);
}
/** app/api/next-server-api-debugger/session/route.ts - GET */
export async function debugSessionGET(request: Request): Promise<Response> {
  if (!enabled() || !localRequest(request)) return disabledResponse(request);
  return response({ authenticated: Boolean(active(cookieToken(request))), ready: true });
}
/** app/api/next-server-api-debugger/session/route.ts - POST */
export async function debugSessionPOST(request: Request): Promise<Response> {
  if (!enabled() || !localRequest(request)) return disabledResponse(request);
  if (!sameOrigin(request)) return response({ error:"Invalid origin" },403);
  if (!/application\/json/i.test(request.headers.get("content-type") ?? "")) return response({ error:"JSON required" },415);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return response({ error:"Request too large" },413);
  const source = (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local")
    .split(",")[0].trim().slice(0,128);
  let attempt = store().attempts.get(source);
  if (!attempt || attempt.until < Date.now()) attempt = { count:0, until:Date.now()+600000 };
  if (attempt.count >= 8) return response({ error:"Too many attempts; try later" },429);
  let payload: unknown;
  try { payload = await request.json(); } catch { return response({ error:"Invalid JSON" },400); }
  const key = typeof payload === "object" && payload !== null && "key" in payload && typeof payload.key === "string"
    ? payload.key : "";
  if (!matchesKey(key)) {
    attempt.count++;
    store().attempts.set(source, attempt);
    return response({ error:"Incorrect private debugging key" },401);
  }
  store().attempts.delete(source);
  const token = randomBytes(32).toString("base64url");
  store().sessions.set(token, { expires: Date.now()+TTL });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return response({ authenticated:true },200,{
    "Set-Cookie": COOKIE + "=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800" + secure
  });
}
/** app/api/next-server-api-debugger/session/route.ts - DELETE */
export async function debugSessionDELETE(request: Request): Promise<Response> {
  if (!enabled() || !localRequest(request)) return disabledResponse(request);
  if (!sameOrigin(request)) return response({ error:"Invalid origin" },403);
  const token = cookieToken(request);
  if (token) store().sessions.delete(token);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return response({ authenticated:false },200,{
    "Set-Cookie": COOKIE + "=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + secure
  });
}
/** app/api/next-server-api-debugger/events/route.ts - GET */
export async function debugEventsGET(request: Request): Promise<Response> {
  if (!enabled() || !localRequest(request)) return disabledResponse(request);
  if (!active(cookieToken(request))) return response({ error:"Session expired; sign in again" },401);
  const since = Number(new URL(request.url).searchParams.get("since") ?? "0");
  if (!Number.isSafeInteger(since) || since < 0) return response({ error:"Invalid cursor" },400);
  // Shared local development ring buffer: captures requests before browser authentication.
  return response({ events: store().logs.filter(item => item.id > since).slice(0,200) });
}
