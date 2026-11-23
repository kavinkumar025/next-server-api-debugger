# next-server-api-debugger

**Debug Next.js server-side API calls in the browser Console with no manual instrumentation or React provider.**

[![npm](https://img.shields.io/npm/v/next-server-api-debugger)](https://www.npmjs.com/package/next-server-api-debugger)
[![CI](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Development only. Automatic setup targets **Next.js 16 App Router** with Node.js and React 19. Do not expose debugging endpoints to the public internet.

## Quick start: two commands

Run in your Next.js app root (where `package.json` exists):

```bash
npm install next-server-api-debugger
npx next-server-api-debugger init
```

The npm installer attempts to configure supported Next.js apps automatically. The `init` command ensures integration is complete and prompts you for **one custom key (1–24 characters)**. You no longer need to create server instrumentation, a browser instrumentation file, debug route handlers, or modify your React layout manually.

An optional interactive installation is `npm install --foreground-scripts next-server-api-debugger`, but npm may run scripts without a usable terminal. The explicit `init` command is reliable.

```text
Next Server API Debugger — private key setup
Choose your debug key (1-24 characters, hidden):
✔ Salted key hash saved in .env.local
```

The private key is **not written in plaintext** to project files; its salted hash is stored in the application's `.env.local` file, excluded from Git. Remember your key.

**Restart** your local Next.js server after setup:

```bash
npm run dev
```

## Enable logging in Chrome / Edge

Open your app on localhost, open DevTools → Console and enter the key chosen during setup:

```javascript
localStorage.setItem("apiDebugLogging", "kavin");
```

Replace `kavin` with your actual key. The browser instrumentation automatically detects it, sends it to your local server for verification, and changes the storage value to `enabled`.

```javascript
localStorage.getItem("apiDebugLogging"); // "enabled" after successful verification
```

On first browser load, `apiDebugLogging` defaults to `disabled`. Installing an npm package cannot directly write browser localStorage; browser startup instrumentation initializes the entry.

Trigger a server-side API call by loading or navigating a Next.js page. Supported requests print user-friendly expandable Console groups:

```text
[Server API] GET https://api.example.test/products → HTTP 200 (145ms)
  Request  { method: 'GET', url: 'https://api.example.test/products', body: 'Empty or not captured' }
  Response { status: 200, body: { products: [{ id: 1 }] } }

[Server API] POST https://api.example.test/orders → HTTP 201 (238ms)
  Request  { method: 'POST', body: { productId: 101, quantity: 2 } }
  Response { status: 201, body: { orderId: 123 } }
```

These are illustrative values, not real captured data. The native Network tab cannot show outgoing requests made entirely on the server; this package forwards debugging events to the browser Console.

Disable:

```javascript
localStorage.setItem("apiDebugLogging", "disabled");
```

## What is configured automatically?

The package uses Next.js server and client instrumentation hooks and App Router route handlers. The `postinstall` script attempts setup on supported projects; `init` repeats missing setup work in a safe, idempotent manner.

| Generated/extended file | Purpose |
|---|---|
| `instrumentation.ts` / `src/instrumentation.ts` | Initialize Node.js server-side fetch interception |
| `instrumentation-client.ts` / `src/instrumentation-client.ts` | Automatically start browser logging |
| `app/api/__server-api-debug/session/route.ts` | Verify developer key / manage session |
| `app/api/__server-api-debug/events/route.ts` | Deliver sanitized logs to authenticated local browser |

JavaScript (`.js`) and `src/app` applications are also supported.

**Existing user code is preserved:**

- Existing server instrumentation is moved to `instrumentation.next-server-api-debugger-original.ts` (or `.js`), and the generated wrapper runs the existing `register()` function and re-exports other functions such as `onRequestError`.
- Existing `instrumentation-client` files retain their code; the debugger adds just one side-effect import.
- Existing unrelated route handlers at the debugger's reserved API paths are **not overwritten**. The setup reports a conflict instead.
- Re-running `init` does not add duplicate hooks, route handlers, or imports.
- The app layout is not edited. **You no longer need `<ApiDebugProvider>`.** If you used the old provider manually, remove it to avoid duplicate browser logs.

**This package modifies application source during setup.** Review the generated files in Git before committing. When uninstalling, remove generated hooks/routes and restore the original instrumentation first to avoid unresolved imports.

## Developer key and team handover

```bash
npx next-server-api-debugger status
```

Shows whether a key and automatic integration are configured **on the current machine**. The original key cannot be displayed because only a salted, one-way hash is stored. Ask your organization's password manager for the shared key.

```bash
npx next-server-api-debugger init
```

Creates a key if missing or offers to replace an existing one. To rotate immediately:

```bash
npx next-server-api-debugger init --reset
```

Restart the local Next.js server after changing the key. **Uninstalling/reinstalling the npm package does not reset an existing application's `.env.local` file.**

## Supported features

| Feature | Support |
|---|---|
| Next.js 16 / React 19 / Node.js App Router | Automatic setup |
| JS and TS; root and `src` layouts | Yes |
| GET, POST, PUT, PATCH, DELETE via server `fetch()` | Best-effort |
| Request and response JSON preview, HTTP status, duration | Captured for supported requests |
| Browser Console and local server terminal | Yes |
| Local buffered replay | Up to 5,000 events per Node.js process |
| Axios / raw HTTP libraries / databases / Edge runtime | Not automatically intercepted |
| Browser Network tab | Cannot show actual server-to-server traffic |
| Production / multiple server instances | Unsupported |

Next.js may replace or bypass a global `fetch` wrapper, so automatic interception **cannot be guaranteed for every API call**. For a specific request not captured, use the optional explicit wrapper:

```typescript
import { debugFetch } from "next-server-api-debugger/server";

const res = await debugFetch("https://api.example.test/products", { cache: "no-store" });
const data = await res.json();
```

The server also prints captured events to its own terminal as a fallback, even before browser login. Events are buffered in memory; process restarts erase them, and high traffic can overwrite older events. No package can promise every log across crashes, disconnects, unsupported libraries, or multiple processes.

## Troubleshooting

**The install did not ask for a key.** Run `npx next-server-api-debugger init`. npm install scripts do not reliably provide interactive prompts.

**No logs in browser.** Check `localStorage.getItem("apiDebugLogging")` is `"enabled"`, restart `npm run dev` after setup, and navigate to a page that actually makes server-side requests. Check the terminal for `[Server API]`. Use `debugFetch` for calls Next.js does not automatically expose.

**The installer reports an API route conflict.** Your app already owns one of the generated routes. The installer refuses to overwrite it. Resolve the conflict, then run `init` again.

**Existing integration looks incomplete.** Run `npx next-server-api-debugger status`, then `npx next-server-api-debugger init` to repair missing hooks.

**I previously installed the manual provider.** Remove the old layout `ApiDebugProvider` wrapper after upgrading to avoid duplicate polling.

**Need to change the key.** Run `npx next-server-api-debugger init --reset` and restart development. The original key cannot be recovered from the saved hash.

## Security constraints

- **Trusted local development only.** API debug endpoints are disabled in production and reject non-loopback hosts.
- **LocalStorage is not secret storage.** Entering a key there briefly exposes it to browser scripts and browser Console history. A 1-character key is guessable. Never reuse credentials.
- Common JSON fields and URL query parameters are sanitized on a **best-effort** basis. Some fields can still expose sensitive data. Only test with synthetic data.
- All authenticated local debug sessions connected to the same Node.js process can see that process's buffered events. It is not user-isolated.
- Sessions use HttpOnly, SameSite=Strict cookies with a 30-minute expiry.
- Do not use for production observability, live customer traffic, or public development servers.

## Contributing and development

```bash
git clone https://github.com/kavinkumar025/next-server-api-debugger.git
cd next-server-api-debugger/next-server-api-debugger
npm install
npm run typecheck
npm test
npm pack --dry-run
```

[Source](https://github.com/kavinkumar025/next-server-api-debugger) · [Issues](https://github.com/kavinkumar025/next-server-api-debugger/issues) · [npm](https://www.npmjs.com/package/next-server-api-debugger)

MIT © kavinkumar025.
