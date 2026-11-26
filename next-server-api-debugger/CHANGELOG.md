## 1.2.0 — Visible localhost key and useful 404 errors

- Store and display the chosen local developer key as NEXT_SERVER_API_DEBUGGER_KEY in the app's .env.local.
- Show the key during setup and through status; retain legacy hash support for existing users.
- Make a missing server key explicit in the local 404 error and continue blocking production and remote clients.
- Add key config tests, server auth tests, and a real Next.js smoke test using the readable key.
- Security tradeoff: never reuse an account password or commit .env.local.

# Changelog

## 1.1.3 — Authentication diagnostic improvements

- Failed browser login now displays `error:401`, `error:403`, `error:404`, or `error:network` in the same `apiDebugLogging` Local Storage key instead of silently reverting to disabled.
- New `npx next-server-api-debugger doctor` checks the running localhost session endpoint.
- Accept a loopback Host alias when Next.js internally rewrites the request hostname, while rejecting cross-site requests.
- Regression tests for the login state and local origin handling.

## 1.1.2 — Clear browser Local Storage activation status

- Show `connecting` while verifying a key entered in `apiDebugLogging`, rather than immediately reverting to `disabled`.
- Set `enabled` only after the local server confirms authentication; return to `disabled` with a Console error if verification fails.
- Avoid enabling logging when a user disables it during authentication.
- Add browser activation regression tests for valid keys, invalid keys, cancelled login, and missing sessions.

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
