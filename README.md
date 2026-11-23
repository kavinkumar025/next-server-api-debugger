# next-server-api-debugger

A Next.js server API debugging package in early development. The package source is in [`next-server-api-debugger`](./next-server-api-debugger).

## Development

```sh
cd next-server-api-debugger
npm ci
npm run typecheck
npm run build
```

The package currently exports `logServerApi`, `PACKAGE_NAME`, and `VERSION` from its main entry point, and `ApiDebugProvider` from its client entry point.
