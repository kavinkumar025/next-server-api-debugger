# Changelog

## 1.1.1 — Next.js 16 Cache Components build compatibility

- Remove `runtime = "nodejs"` and `dynamic = "force-dynamic"` from automatically generated debugger routes.
- When running `init` or installing an update, repair those two exports in previously generated debugger routes without touching unrelated application-owned code.
- Add regression tests for fresh and existing generated routes under Cache Components.
- No change to the developer key or browser activation workflow.

## 1.1.0 — Automatic Next.js integration

- npm install / init automatically configure Next.js 16 Node instrumentation, browser instrumentation, and debug routes.
- No manual React layout provider required; browser instrumentation activates logging automatically.
- Existing server instrumentation is preserved in an original-file backup and composed by the wrapper.
- Existing browser instrumentation retains its code; conflicting routes are not overwritten.
- Supports JS/TS and root/src App Router layouts, and idempotent reinstall.
- Existing status / init / key reset commands remain available.
- Server-side fetch interception is best-effort, not guaranteed for all libraries.

## 1.0.3 — Team handover and key rotation

- Status command and interactive key rotation.

## 1.0.2 — Simpler keys and buffered logging

- 1–24 character developer keys, default apiDebugLogging, terminal fallback and recent-event replay.

## 1.0.1 — Documentation

- Expanded usage docs and package metadata.

## 1.0.0 — Initial release

- Local development fetch debugger and authenticated event transport.
