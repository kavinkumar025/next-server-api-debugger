# next-server-api-debugger

Development-only browser console inspection for Next.js server-side fetch calls.

Package source and complete documentation: [next-server-api-debugger/](./next-server-api-debugger/README.md).

From the package folder:

```bash
npm install
npm run typecheck
npm test
npm pack --dry-run
```

The private developer key is generated per consuming Next.js application with `npx next-server-api-debugger init` or an attempted foreground install prompt. The original secret is never committed or shipped in the npm bundle. This package is development-only; it does not enable production API logging.
