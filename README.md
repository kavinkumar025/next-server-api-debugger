# next-server-api-debugger

[![npm](https://img.shields.io/npm/v/next-server-api-debugger)](https://www.npmjs.com/package/next-server-api-debugger)
[![GitHub Actions](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/kavinkumar025/next-server-api-debugger/actions/workflows/ci.yml)

**Inspect Next.js server-side API requests and responses in your browser console during local development.**

Full documentation, installation guide, examples and security notes: **[Package README](./next-server-api-debugger/README.md)**.

## Install

```bash
npm install next-server-api-debugger
npx next-server-api-debugger init
```

This creates a project-specific debug key hash. The package defaults to `apiDebugLogging = "disabled"` in browser localStorage once `ApiDebugProvider` loads. For local-only debugging set the storage value to your chosen key, which is cleared immediately after validation. See the [full documentation](./next-server-api-debugger/README.md) for security limitations.

## Develop

```bash
cd next-server-api-debugger
npm install
npm run typecheck
npm test
npm pack --dry-run
```

Development-only Node.js App Router support. See the detailed README for compatibility and limitations.

[Report an issue](https://github.com/kavinkumar025/next-server-api-debugger/issues) · [View npm package](https://www.npmjs.com/package/next-server-api-debugger)
