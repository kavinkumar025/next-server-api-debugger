# next-server-api-debugger

A development-only Next.js 16 App Router utility for inspecting **server-side fetch request and response information in the browser console**. It does not move API calls to the client.

**Supported:** Node.js runtime and Next.js App Router. Global fetch patching is best-effort; use debugFetch for guaranteed capture in supported request contexts. No Edge, Axios, database, static generation, or guaranteed capture of every Next.js internal request. Only small JSON body previews, with best-effort redaction. **Never use real secrets or personal data for debugging.** In-memory sessions are not suitable for production or multiple server instances.

## Build the npm package

From this package directory:

```bash
npm install
npm run typecheck
npm test
npm pack --dry-run
```

Do not publish before tests and a real application smoke test pass.

## Install in a Next.js application

```bash
npm install --foreground-scripts next-server-api-debugger
```

When npm runs the install script in a real foreground terminal it attempts to ask for a **project-specific private key**, which is hidden during entry. Standard installs, CI, or package managers may not support that interaction. The reliable alternative is:

```bash
npm install next-server-api-debugger
npx next-server-api-debugger init
```

Setup accepts a custom secret of 24-1024 characters or generates one. A generated secret is shown once so the developer can save it in their own password manager; it is not embedded in JavaScript. Only a salted scrypt hash is written to the consuming application's **.env.local**, which is added to .gitignore. Use `npx next-server-api-debugger init --reset` to rotate the key. Restart the Next.js development server after setup.

## Integrate

Copy the relevant example files from `examples/next16-app/` to your Next.js app. Merge the provider into your existing layout rather than replacing your layout design.

1. `instrumentation.ts` calls `registerServerDebugger({ captureBodies:true })` in the Node runtime.
2. `app/api/__server-api-debug/session/route.ts` exposes session login/check/logout.
3. `app/api/__server-api-debug/events/route.ts` exposes the authenticated event feed.
4. Your root layout wraps children in `<ApiDebugProvider storageKey="apiDebugLoggin">`.
5. For any server request that auto instrumentation misses, import `debugFetch` from `next-server-api-debugger/server` and call it instead of fetch.

## Using browser console

Run your Next.js app in development (`npm run dev`). In DevTools Console:

```javascript
localStorage.setItem("apiDebugLoggin", "enabled");
location.reload();
```

A small password input appears. Enter the private key you set during installation. It is sent to a same-origin route only for verification, **never stored in localStorage**, and exchanged for an HttpOnly SameSite=Strict cookie. After refresh, server requests show collapsed console groups, e.g.:

```text
[Server API] GET https://api.example.test/products → HTTP 200 (145 ms)
  Request: { method: 'GET', url: 'https://api.example.test/products', body: 'Not captured / empty' }
  Response: { status: 200, body: { products: [] } }
[Server API] POST https://api.example.test/orders → HTTP 201 (212 ms)
```

Disable and log out by removing the flag:

```javascript
localStorage.removeItem("apiDebugLoggin");
```

The client checks localStorage at intervals. New logs stop when disabled; existing console entries are not erased.

## Security and scope

- **Development only**: endpoints return 404 in NODE_ENV=production.
- No debug key ships with npm. Each project creates its own secret and only stores a salted hash locally.
- Sessions are in process memory, expire after 30 minutes, and are isolated by session cookie. The debugger does not broadcast across users.
- Login requires same-origin and has basic throttling. Avoid exposing your development server publicly.
- Sensitive URL parameters and common JSON keys are redacted, but **redaction is best-effort**; unrecognized fields may contain sensitive data. Only use synthetic or non-sensitive development data.
- The native Chrome Network panel cannot display requests made solely on the server; browser console events are forwarded by an authenticated route.
- No production/serverless multi-instance support, and body preview capture can add overhead to streaming or large responses.
