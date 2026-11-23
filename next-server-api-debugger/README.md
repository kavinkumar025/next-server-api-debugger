# next-server-api-debugger

**See Next.js server-side API requests and responses in your browser's Developer Tools Console — without moving those requests to the client.**

[![npm](https://img.shields.io/npm/v/next-server-api-debugger)](https://www.npmjs.com/package/next-server-api-debugger)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub Actions](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml)

> **Development-only debugging tool.** Currently targets Next.js 16 App Router using the Node.js runtime, with React 19. Use only with development or synthetic data. It is not a production monitoring product.

## Why use it?

Next.js Server Components and server-side functions can call external APIs using `fetch()`. Those outgoing requests do not normally appear as actual requests in the browser's Network tab. This package captures supported **server-side** fetch activity and sends **sanitized debugging events** to an authenticated browser session, where they appear as friendly, expandable console groups.

**Example console output (illustrative):**

```text
[Server API] GET https://api.example.com/products → HTTP 200 (145 ms)
  Request  { method: "GET", url: "https://api.example.com/products", body: "Not captured / empty" }
  Response { status: 200, body: { products: [{ id: 1, name: "Watch" }] } }
  Time     23/11/2026, 9:00 PM

[Server API] POST https://api.example.com/orders → HTTP 201 (238 ms)
  Request  { method: "POST", body: { productId: 101, quantity: 2 } }
  Response { status: 201, body: { orderId: 12345 } }
```

The values above are examples, not captured real traffic.

## Features

- Inspect supported **GET, POST, PUT, PATCH, DELETE** and other `fetch()` method calls.
- See sanitized URL, method, HTTP status, request/response JSON previews, elapsed time, and a friendly error message for failed calls.
- Expand or collapse each request in the **Chrome / Edge browser Console**.
- Create a **different private debugging key for each project**.
- The private key is never written into the npm package or stored in browser `localStorage`. A salted `scrypt` hash is kept in your application's `.env.local`.
- Only an authenticated browser session can poll captured events; sessions expire after 30 minutes.
- Enable or disable logging using `localStorage` without modifying your application's API calls.
- Development-only endpoints return 404 in `NODE_ENV=production`.
- Explicit `debugFetch()` fallback for calls missed by automatic global fetch interception.

## Compatibility

| Capability | Status |
| --- | --- |
| Next.js 16 App Router | Intended support |
| React 19 | Intended support |
| Node.js runtime | Supported target |
| Next.js `fetch()` | Best-effort automatic interception |
| Explicit `debugFetch()` | Supported fallback in request context |
| Browser Console | Yes |
| Browser's native Network tab | No — server-side requests are not native browser traffic |
| Edge runtime, Axios, database queries | Not supported |
| Production / distributed serverless deployments | Not supported |
| Next.js Pages Router | Not currently a tested integration |

This project uses in-process memory for sessions and captured events. Next.js may modify `fetch` internally, so the global interceptor cannot guarantee every server request is captured.

## Quick start

### 1. Install in your Next.js project

Run this command **inside the Next.js application folder that contains its `package.json`**:

```bash
npm install next-server-api-debugger
npx next-server-api-debugger init
```

The `init` command asks you to choose either a custom key or a generated key. Custom input is hidden. A generated key is shown once so you can save it privately.

> **Optional install-time prompt:** `npm install --foreground-scripts next-server-api-debugger` attempts to run interactive setup during installation. This depends on npm and terminal behavior. The separate `init` command above is the reliable method.

Example installation:

```text
Next Server API Debugger — private key setup

Choose key: [1] Custom (default) / [2] Generate: 1
Enter a private key (hidden; 24+ characters):

✔ Salted key hash saved in .env.local
✔ Debug secrets excluded from Git
```

The setup adds the following **server-only** variable to your `.env.local`:

```dotenv
NEXT_SERVER_API_DEBUGGER_KEY_HASH=<generated-salt-and-hash>
```

Do not put that variable into `NEXT_PUBLIC_*`, commit it to Git, or paste your original key in the browser console. To rotate the key, run `npx next-server-api-debugger init --reset`. Restart the dev server after changing `.env.local`.

### 2. Add `instrumentation.ts`

At your Next.js application root (or inside `src/` when using a `src`-based app):

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

`captureBodies: true` previews small JSON bodies. For safer defaults, set it to `false`.

### 3. Create the session route

Create `app/api/__server-api-debug/session/route.ts` (or `src/app/api/.../route.ts`):

```ts
import {
  debugSessionGET,
  debugSessionPOST,
  debugSessionDELETE
} from "next-server-api-debugger/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export {
  debugSessionGET as GET,
  debugSessionPOST as POST,
  debugSessionDELETE as DELETE
};
```

### 4. Create the events route

Create `app/api/__server-api-debug/events/route.ts`:

```ts
import { debugEventsGET } from "next-server-api-debugger/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { debugEventsGET as GET };
```

### 5. Add the browser provider

In `app/layout.tsx`, wrap your current children. Keep your existing HTML, metadata, styles, and layout:

```tsx
import { ApiDebugProvider } from "next-server-api-debugger/client";
import type { ReactNode } from "react";

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApiDebugProvider storageKey="apiDebugLoggin">
          {children}
        </ApiDebugProvider>
      </body>
    </html>
  );
}
```

If you already have a root layout, **merge** the provider into it rather than replacing the entire file.

### 6. Start your app and activate debugging

```bash
npm run dev
```

Open your local app in the browser, then open DevTools → Console:

```js
localStorage.setItem("apiDebugLoggin", "enabled");
location.reload();
```

A small **Server API Debugger** login appears. Enter your private key. After authorization the page reloads, and supported requests made in that authenticated Next.js request context are forwarded into the browser Console.

**Important:** A key in `localStorage` alone is never treated as authentication. The value `enabled` is just an on/off preference. The real key is validated on the server and exchanged for an HttpOnly, SameSite=Strict cookie.

### 7. Disable logging and log out

```js
localStorage.removeItem("apiDebugLoggin");
```

The provider observes this setting and requests logout. Previously printed Console entries remain visible until you clear the console.

## When you don't see a server request

Next.js may wrap or replace the global `fetch` function after instrumentation. To log a specific server request, use the explicit fallback instead:

```ts
import { debugFetch } from "next-server-api-debugger/server";

export async function getProducts() {
  const res = await debugFetch(
    "https://api.example.com/products",
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("Products request failed");
  return res.json();
}
```

This code must execute in an **authenticated request context** in the Node.js runtime. Calls in background jobs, build-time static rendering, isolated workers, and contexts without a matching Next.js session cookie will not be forwarded to a browser session.

### Example POST request

```ts
import { debugFetch } from "next-server-api-debugger/server";

const response = await debugFetch("https://api.example.com/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId: 101, quantity: 2 })
});
```

Only JSON payloads within the configured size limit are previewed; binary, streaming, unsupported and oversized bodies are omitted or truncated.

## Configuration reference

### `registerServerDebugger(options)`

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `captureBodies` | `boolean` | `false` | Attempt to capture small JSON request/response bodies |
| `maxBodyBytes` | `number` | `8000` | Preview size threshold, capped at 65,536 bytes |

### `<ApiDebugProvider />`

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `storageKey` | `string` | `"apiDebugLoggin"` | Browser-only on/off preference |
| `pollIntervalMs` | `number` | `1500` | Polling interval, minimum 500 ms |
| `children` | `ReactNode` | required | Existing application content |

### Server exports

| Export | Purpose |
| --- | --- |
| `registerServerDebugger` | Node runtime instrumentation |
| `debugFetch` | Explicit fetch wrapper |
| `debugSessionGET` | Check session |
| `debugSessionPOST` | Authenticate private key |
| `debugSessionDELETE` | Log out |
| `debugEventsGET` | Poll current session's events |

## How it works

```text
Next.js server (Node.js)
  └─ fetch / debugFetch
       └─ attach sanitized event to authenticated request session
            └─ GET /api/__server-api-debug/events (cookie protected)
                 └─ ApiDebugProvider
                      └─ Chrome/Edge DevTools Console
```

The package does **not** convert server calls into client-side API calls. It mirrors limited debugging information, keeping original requests on the server. Browser Network tools may show the **debug polling request**, not the underlying server-to-server HTTP requests.

## Troubleshooting

**`npm install` didn't ask for a key.** Run `npx next-server-api-debugger init` from the consuming app's root. Interactive npm lifecycle prompts are not reliable in CI or background installations.

**No login box appears.** Make sure `localStorage.setItem("apiDebugLoggin", "enabled")` was run on the correct local origin, reload the page, and check that `ApiDebugProvider` is in the root layout.

**"Debugger routes unavailable."** Ensure both `/api/__server-api-debug/session` and `/api/__server-api-debug/events` route handlers exist and your dev server has restarted.

**"Incorrect private debugging key."** Check that you are using the original secret, not the saved hash. To reset, run `npx next-server-api-debugger init --reset`, then restart the app.

**No API logs appear.** Trigger a server request after login; use `debugFetch` if global interception misses it. Server calls made before login or without the debug session will not be shown. Logging is not guaranteed for every Next.js rendering/cache mode.

**I see a server API request in the Console but not the Network tab.** This is expected. The native Network tab cannot display outgoing requests that happened entirely on the server.

**I see "Not captured / empty" for a request or response.** Body capture is disabled by default or the content was not suitable for a JSON preview.

**Can I enable this on my public production site?** No. The initial release intentionally disables the endpoints in `NODE_ENV=production` and has in-memory session/event storage unsuitable for serverless production.

## Security considerations

This project is for **trusted local development only**.

- The installer's private key is project-specific. The original key is not committed or shipped; the consuming project stores a salted `scrypt` hash in `.env.local`.
- Debug login requires a same-origin request and uses basic throttling. Successful login creates a 30-minute HttpOnly, SameSite=Strict session cookie.
- Only events associated with the authenticated session are returned; there is no globally shared public event feed.
- URL query values and JSON fields with common sensitive names are redacted on a **best-effort** basis. Unrecognized fields or values can still expose secrets or personal information.
- Do **not** expose local dev servers publicly or debug real credentials, authentication tokens, financial information, or personal records.
- JSON preview cloning can add overhead and may not be appropriate for streaming, binary, or large responses.
- Never use this tool as a substitute for a production observability platform.

## Develop and contribute

Source: [GitHub repository](https://github.com/kavinkumar025/next-server-api-debugger)

The actual npm package is stored inside the repository's `next-server-api-debugger/` subdirectory:

```bash
git clone https://github.com/kavinkumar025/next-server-api-debugger.git
cd next-server-api-debugger/next-server-api-debugger
npm install
npm run typecheck
npm test
npm pack --dry-run
```

The repository includes unit tests and a reference integration in `examples/next16-app/`. For bugs or documentation requests, [open an issue](https://github.com/kavinkumar025/next-server-api-debugger/issues).

## License

MIT © [kavinkumar025](https://github.com/kavinkumar025).
