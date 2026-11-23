# next-server-api-debugger

**Debug Next.js server-side API calls from Chrome / Edge DevTools Console during local development.**

[![npm](https://img.shields.io/npm/v/next-server-api-debugger)](https://www.npmjs.com/package/next-server-api-debugger)
[![CI](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> **Local development only.** Compatible target: Next.js 16 App Router, React 19, Node.js runtime. The package does not move server API requests into the browser, and it does not replace production monitoring.

## What you'll see

Open your browser Console to inspect **GET / POST / PUT / PATCH / DELETE**, request and response JSON previews, status codes, timings and errors. Example:

```text
[Server API] GET https://api.example.test/products → HTTP 200 (145 ms)
   Request  { method: "GET", url: "...", body: "Empty or not captured" }
   Response { status: 200, body: { products: [{ id: 1 }] } }
   Time     23/11/2026, 10:00 PM

[Server API] POST https://api.example.test/orders → HTTP 201 (238 ms)
   Request  { method: "POST", body: { productId: 1, quantity: 2 } }
   Response { status: 201, body: { orderId: 123 } }
```

**Note:** These are sample values. Native browser Network panels do not display server-to-server traffic; this package forwards debugging events into the **Console**.

## Features (1.0.2)

- Easy one-question setup: custom developer key containing **1–24 characters**. A short key (for example `kavin`) is accepted.
- The client provider initializes `localStorage.apiDebugLogging` to **`disabled`** when it first loads. npm installation itself cannot write into a user's browser storage.
- For local debugging, put your matching key in `localStorage.apiDebugLogging`; the client immediately reads it and replaces it with `disabled` while verifying. On successful verification, the value becomes **`enabled`**.
- The original key is not permanently saved by the package: the app's `.env.local` stores a **salted scrypt hash**, not plaintext. **However, any key placed in localStorage is briefly readable by browser scripts and may remain visible in DevTools command history.** This is **not a secure secret entry method**.
- Captured Node.js `fetch` calls are buffered (up to 5,000 recent events **per local Node process**) and also print a server-terminal log line. This helps recover logs even if browser authentication happens *after* a server-side fetch.
- Authenticated browsers on the same **local** development server can replay those buffered logs. Because this is a development-wide ring buffer, it is **not isolated by user**.
- JSON request/response previews with best-effort sensitive-field redaction; maximum 65,536 bytes per preview.
- The debugging endpoints are restricted to `localhost`, `127.0.0.1` and IPv6 loopback, and are disabled in `NODE_ENV=production`.

## Install

Run inside the consuming Next.js project root:

```bash
npm install next-server-api-debugger
npx next-server-api-debugger init
```

**Installation prompt (1.0.2):**

```text
Next Server API Debugger — private key setup

Choose your debug key (1-24 characters, hidden):
✔ Salted key hash saved in .env.local
✔ Debug secrets excluded from Git
```

Just type your desired key and press Enter — no `[1]/[2]` menu. Input is hidden. For example, `kavin`, `debug123`, or `=` are accepted. Short and guessable keys are appropriate **only for a trusted local development server**.

If upgrading from 1.0.0 or 1.0.1, **rotate your key** and restart Next.js because the new version enforces a 1–24-character key:

```bash
npx next-server-api-debugger init --reset
```

There is also a best-effort installation-time prompt with:

```bash
npm install --foreground-scripts next-server-api-debugger
```

npm lifecycle scripts may not have an interactive terminal. The explicit `init` command is the reliable fallback.

## Next.js integration

### 1. `instrumentation.ts`

Add at your Next.js root, or `src/instrumentation.ts` if your app uses `src`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerServerDebugger } =
      await import("next-server-api-debugger/server");

    registerServerDebugger({
      captureBodies: true,
      maxBodyBytes: 8000
    });
  }
}
```

This installs a **best-effort** `globalThis.fetch` wrapper on the Node.js server. If Next.js internally replaces or bypasses that wrapper, use `debugFetch` explicitly (below).

### 2. Authentication route

Create `app/api/__server-api-debug/session/route.ts`:

```ts
import {
  debugSessionGET, debugSessionPOST, debugSessionDELETE
} from "next-server-api-debugger/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  debugSessionGET as GET,
  debugSessionPOST as POST,
  debugSessionDELETE as DELETE
};
```

### 3. Events route

Create `app/api/__server-api-debug/events/route.ts`:

```ts
import { debugEventsGET } from "next-server-api-debugger/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { debugEventsGET as GET };
```

If you use the Next.js `src/` directory, create these routes under `src/app/` instead.

### 4. Browser provider

Merge into your existing `app/layout.tsx` without replacing unrelated layout content:

```tsx
import { ApiDebugProvider } from "next-server-api-debugger/client";

export default function RootLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApiDebugProvider storageKey="apiDebugLogging">
          {children}
        </ApiDebugProvider>
      </body>
    </html>
  );
}
```

### 5. Start development and activate

Restart your local development server after setup:

```bash
npm run dev
```

Open your local app, then Chrome DevTools → Console:

```javascript
// Set your own 1–24 character developer key, chosen during init:
localStorage.setItem("apiDebugLogging", "kavin");
```

The provider checks the storage value automatically. After successful server verification, the key is replaced with `enabled`:

```javascript
localStorage.getItem("apiDebugLogging"); // "enabled"
```

Now reload or navigate your Next.js app to trigger server-side requests. Buffered recent calls (including calls made before authentication) and new calls appear in the Console.

**Warning:** The console command above can be seen in browser console history, and the key is temporarily present in localStorage before the provider reads it. Avoid reusing a real account password. This behavior is intended **only for a trusted local app** and cannot provide the secrecy of a password prompt.

To stop forwarding logs:

```javascript
localStorage.setItem("apiDebugLogging", "disabled");
```

The client logs out and stops polling. Existing Console entries remain until you clear the console.

## Explicit fallback: `debugFetch()`

Next.js may wrap or replace the global `fetch` function after `instrumentation.ts` runs. To reliably instrument a specific call within the supported Node environment, use:

```ts
import { debugFetch } from "next-server-api-debugger/server";

const response = await debugFetch("https://api.example.test/products", {
  method: "GET", cache: "no-store"
});
const products = await response.json();
```

POST example:

```ts
const response = await debugFetch("https://api.example.test/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId: 101, quantity: 2 })
});
```

The original API request stays on the server. This does not instrument Axios, databases, Edge runtime, Next.js internal cache hits, or API traffic occurring in a different process.

## How logs are delivered

```text
Node.js fetch / explicit debugFetch
  ├─ terminal: [Server API] METHOD URL → HTTP STATUS (DURATION)
  └─ in-memory local-development ring buffer (latest 5,000)
       └─ authenticated local /api/__server-api-debug/events
            └─ ApiDebugProvider → browser DevTools Console
```

The buffer can be overwritten under heavy traffic, and process restarts erase it. The browser polls in batches of 200, so an inactive browser may miss older events if the buffer fills. **No library can guarantee a browser console entry for every possible API call** across crashes, process restarts, network failures, alternative HTTP libraries or unsupported runtimes. The terminal fallback helps diagnose calls when browser forwarding is unavailable.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `registerServerDebugger({ captureBodies })` | `true` | Attempt to preview JSON bodies |
| `registerServerDebugger({ maxBodyBytes })` | `8000` | Preview limit, maximum 65,536 bytes |
| `<ApiDebugProvider storageKey />` | `apiDebugLogging` | Browser activation storage key |
| `<ApiDebugProvider pollIntervalMs />` | `750` | Browser polling interval (minimum 500 ms) |

## Troubleshooting

**Setup says key too short.** Check your installed version: `npm ls next-server-api-debugger`. Version 1.0.0/1.0.1 required 24+ characters. Upgrade to 1.0.2 and run `npx next-server-api-debugger init --reset`.

**`npm install` did not prompt.** Run `npx next-server-api-debugger init` directly. npm installers do not reliably support interactive prompts.

**No `apiDebugLogging` in localStorage.** Ensure `ApiDebugProvider` is mounted and reload the app; it initializes the setting to `disabled` on first client render. Installing an npm package cannot directly change browser storage.

**Key rejected.** The key must match the original custom key used in setup. If necessary rotate it using `init --reset`, and restart your dev server.

**No logs in the browser.** Confirm `localStorage.getItem("apiDebugLogging")` is `"enabled"`, both route handlers exist, and the server is running in development on localhost. Trigger a new server fetch. Check terminal output and use `debugFetch` if automatic interception does not capture the call.

**No response body.** Only small JSON responses can be previewed, and some bodies are omitted for safety or performance. Redaction is best-effort, not comprehensive.

**`npm audit` reports vulnerabilities.** Run `npm audit` to see which dependency introduces them. Do not blindly run `npm audit fix --force`, which can introduce breaking upgrades.

## Important security constraints

- **Do not deploy this debugger to production** or expose local development servers to untrusted networks.
- Debug routes return 404 when `NODE_ENV` is not `development` or the request hostname is not a loopback address.
- Browser localStorage is readable by JavaScript. A 1-character or other short key is easy to guess; the hash in `.env.local` does not make a short key strong. Never reuse credentials.
- The session is an HttpOnly, SameSite=Strict cookie and expires after 30 minutes. Login includes basic throttling.
- Browser clients authenticated to the same local Node process can see the shared process-level buffer. **Do not process real sensitive user data** while using this utility.
- The console and terminal may contain request/response data; common sensitive field names are redacted, but unknown sensitive fields may not be.
- Production/serverless multi-instance aggregation, external telemetry, persistence and guaranteed delivery are out of scope.

## Development

```bash
git clone https://github.com/kavinkumar025/next-server-api-debugger.git
cd next-server-api-debugger/next-server-api-debugger
npm install
npm run typecheck
npm test
npm pack --dry-run
```

See [the GitHub repository](https://github.com/kavinkumar025/next-server-api-debugger), [open an issue](https://github.com/kavinkumar025/next-server-api-debugger/issues), and [the npm package](https://www.npmjs.com/package/next-server-api-debugger).

MIT © kavinkumar025.
