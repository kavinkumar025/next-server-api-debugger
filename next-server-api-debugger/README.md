# next-server-api-debugger

**Debug Next.js server-side API calls in the browser Console with no manual instrumentation or React provider.**

[![npm](https://img.shields.io/npm/v/next-server-api-debugger)](https://www.npmjs.com/package/next-server-api-debugger)
[![CI](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Development by default. Production debugging requires explicit opt-in, a strong separate key, and an exact origin. Automatic setup targets Next.js 16 App Router, Node.js and React 19. Production capture is metadata-only.

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
Choose your key (1–24 letters, digits, dots, underscores, or hyphens): myLocalKey_1
✔ Your key: myLocalKey_1
✔ Plain-text key stored in .env.local
```

The key is stored in plain text as `NEXT_SERVER_API_DEBUGGER_KEY=YOUR_KEY` in your application's `.env.local`, and shown by the `status` command. This is a local-development-only convenience and less secure than hashing: never reuse a real password or commit `.env.local`. Legacy hashed keys remain supported until you run `init --reset`.

**Restart** your local Next.js server after setup:

```bash
npm run dev
```

## Production builds and deployed sites

After `npm run build` / `npm run start`, the debugger can be enabled with a **separate production configuration**. Public deployments must be protected by deployment access controls. The debugger remains **off by default** in production.

Set these **server-only** environment variables in your hosting provider (or in `.env.local` for a local `next start` test):

```dotenv
NEXT_SERVER_API_DEBUGGER_PRODUCTION_ENABLED=true
NEXT_SERVER_API_DEBUGGER_PRODUCTION_KEY=REPLACE_WITH_RANDOM_BASE64URL_KEY
NEXT_SERVER_API_DEBUGGER_PRODUCTION_ORIGIN=https://your-site.example
```

Generate a strong production key in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

The production key must have **at least 43 URL-safe characters**, generated independently of the 1–24-character local key. The short `NEXT_SERVER_API_DEBUGGER_KEY` from `init` is never accepted in production. For a local `next start` smoke test, set `PRODUCTION_ORIGIN=http://localhost:3000`. For deployment, set the exact HTTPS origin (including any nonstandard port). Do not use `NEXT_PUBLIC_` for these settings, commit secrets, or expose them to visitors.

After rebuilding/redeploying or restarting `next start`, check `/api/next-server-api-debugger/session`. It should contain `ready: true` and `mode: "production"`. Use Chrome DevTools on that same origin:

```javascript
localStorage.setItem("apiDebugLogging", "YOUR_STRONG_PRODUCTION_KEY");
```

Production security: debugging is off by default; login is rate-limited on a best-effort per-process basis; the authenticated cookie is HttpOnly, SameSite=Strict, Secure over HTTPS, and **expires in ten minutes**. Production sessions use a signed, stateless cookie so they work across instances with the same production key. Logging strips request/response bodies and removes URL paths, queries and fragments; only method, HTTP status, duration, URL origin and time remain. Logout clears the browser cookie, but a stolen signed cookie may remain valid until its ten-minute expiry. Never enable on a public customer-facing deployment without additional hosting-level access protection.

**Serverless limitation:** events are stored only in the memory of each Node.js instance. A deployed host may serve the captured fetch, session route and events route in different instances; browser Console logs are therefore **best-effort and may be absent** even with a successful login. To reliably debug all production requests, use hosted runtime logs, tracing or a central log drain. This package does not guarantee cross-instance observability.

## Enable logging in Chrome / Edge

Open your app on localhost, open DevTools → Console and enter the key chosen during setup:

```javascript
localStorage.setItem("apiDebugLogging", "kavin");
```

Replace `kavin` with your actual key. The browser instrumentation automatically detects it, immediately replaces the plaintext key with `connecting` while the local server verifies it, and changes the storage value to `enabled` after success. If verification fails, it shows `error:<code>` (for example `error:401` or `error:network`) in the same Local Storage key and prints the reason in the browser Console. Replace that error value with your key to retry.

```javascript
localStorage.getItem("apiDebugLogging"); // "enabled" after successful verification
```

On first browser load, `apiDebugLogging` defaults to `disabled`. Its states are `disabled` (off), `connecting` (verifying the key), `enabled` (authenticated), and `error:<code>` (authentication failure). You cannot enable a session by typing the literal `enabled` without first authenticating. Installing an npm package cannot directly write browser localStorage; browser startup instrumentation initializes the entry.

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
| `app/api/next-server-api-debugger/session/route.ts` | Verify developer key / manage session |
| `app/api/next-server-api-debugger/events/route.ts` | Deliver sanitized logs to authenticated local browser |

JavaScript (`.js`) and `src/app` applications are also supported.

**Next.js 16 Cache Components compatibility:** Generated debugger API routes intentionally do **not** export `runtime` or `dynamic`. If you installed version 1.1.0 and encountered a Turbopack build failure with `cacheComponents`, upgrade to 1.1.1 and run `npx next-server-api-debugger init`. The installer will remove those two legacy exports from package-managed routes. You can also remove them manually; there is no need to disable Cache Components.

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

Shows whether a key and automatic integration are configured **on the current machine**. To also verify the actual running Next.js debugger endpoint, run `npx next-server-api-debugger doctor` from your app root while `npm run dev` is running. It checks localhost port 3000, and does not print your key or hash. For custom ports, set `$env:NEXT_SERVER_API_DEBUGGER_DOCTOR_URL="http://localhost:3001"` in PowerShell. Production `npm start` is intentionally unsupported. The new readable key is displayed by `status`. A legacy hashed key cannot be recovered; run `init --reset` once to migrate.

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
| `next build` + `next start` | Explicit opt-in with a strong production key |
| Deployed serverless sites | Auth support; browser log replay is best-effort per instance |

Next.js may replace or bypass a global `fetch` wrapper, so automatic interception **cannot be guaranteed for every API call**. For a specific request not captured, use the optional explicit wrapper:

```typescript
import { debugFetch } from "next-server-api-debugger/server";

const res = await debugFetch("https://api.example.test/products", { cache: "no-store" });
const data = await res.json();
```

The server also prints captured events to its own terminal as a fallback, even before browser login. Events are buffered in memory; process restarts erase them, and high traffic can overwrite older events. No package can promise every log across crashes, disconnects, unsupported libraries, or multiple processes.

## Troubleshooting

**The install did not ask for a key.** Run `npx next-server-api-debugger init`. npm install scripts do not reliably provide interactive prompts.

**Local Storage keeps reverting to `disabled`.** Enter your configured key, not the literal `enabled`: `localStorage.setItem("apiDebugLogging", "YOUR_KEY")`. The value becomes `connecting` while authenticating, then `enabled` after success. If it shows `error:<code>`, inspect the browser Console error, run `npx next-server-api-debugger doctor` in the app root, and restart `npm run dev` after updating the configured key.

**Local Storage shows `error:404` with a `key not loaded` message.** The route exists but the running Next.js process has not loaded its key. Run init in the same app folder, stop the server completely, and restart `npm run dev`. Check the actual localhost port.

**Production `404` or `Debugger is disabled`.** Configure `PRODUCTION_ENABLED=true`, a distinct 43+-character `PRODUCTION_KEY`, and the exact `PRODUCTION_ORIGIN` on the running server; restart or redeploy. A short local key cannot enable production.

**Local Storage shows `error:401`.** Reset the configured server key from the app root with `npx next-server-api-debugger init --reset`, restart `npm run dev`, then enter the new key in `apiDebugLogging`.

**Local Storage shows `error:403`, `error:404`, or `error:network`.** Run `npx next-server-api-debugger doctor`. Use the localhost address and `npm run dev` instead of a production server. Confirm the running app's `.env.local` contains `NEXT_SERVER_API_DEBUGGER_KEY=YOUR_KEY` and you fully restarted `npm run dev`.

**No logs in browser.** Check `localStorage.getItem("apiDebugLogging")` is `"enabled"`, restart `npm run dev` after setup, and navigate to a page that actually makes server-side requests. Check the terminal for `[Server API]`. Use `debugFetch` for calls Next.js does not automatically expose.

**The installer reports an API route conflict.** Your app already owns one of the generated routes. The installer refuses to overwrite it. Resolve the conflict, then run `init` again.

**`next build` fails with `cacheComponents` and `runtime`/`dynamic` errors in debugger routes.** Version 1.1.0 generated incompatible exports. Upgrade to 1.1.1 and run `npx next-server-api-debugger init` to repair both package-generated routes, then run `npm run build` again.

**Existing integration looks incomplete.** Run `npx next-server-api-debugger status`, then `npx next-server-api-debugger init` to repair missing hooks.

**I previously installed the manual provider.** Remove the old layout `ApiDebugProvider` wrapper after upgrading to avoid duplicate polling.

**Need to change the key.** Run `npx next-server-api-debugger init --reset` and restart development. The current readable key can be shown by `status`, but an old legacy hash cannot be decoded.

## Security constraints

- **Trusted local development only.** API debug endpoints are disabled in production and reject non-loopback hosts.
- **Production debugging requires deployment access controls** as well as a strong key. It must not expose actual visitors' data.
- **The local key is readable in `.env.local` and `status`.** Never use a real password or commit the file.
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
