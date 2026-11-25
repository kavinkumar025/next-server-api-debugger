# next-server-api-debugger

[![npm](https://img.shields.io/npm/v/next-server-api-debugger)](https://www.npmjs.com/package/next-server-api-debugger)

**Automatic Next.js 16 server-side API debugging in your browser Console.**

## Quick start

```bash
npm install next-server-api-debugger
npx next-server-api-debugger init
```

After restarting `npm run dev`, open DevTools → Console:

```javascript
localStorage.setItem("apiDebugLogging", "YOUR_KEY");
```

The package generates the Next.js instrumentation hooks and protected routes. **No manual layout edits or provider required.**

Use `npx next-server-api-debugger status` to check setup or `npx next-server-api-debugger init --reset` to rotate the key.

**Development only; supported fetch interception is best-effort.** Version 1.1.1 fixes Next.js 16 Cache Components build compatibility for generated API routes.

[Full package documentation](./next-server-api-debugger/README.md) · [Issues](https://github.com/kavinkumar025/next-server-api-debugger/issues).
