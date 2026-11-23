# Changelog

## 1.0.3 — Team handover and key-rotation guidance

- Added `npx next-server-api-debugger status` to verify whether a key is configured locally without disclosing secrets.
- Running `init` with an existing key explains why the original key cannot be recovered and offers interactive rotation.
- Existing users can also rotate with `init --reset`, without uninstalling or reinstalling npm.
- Added team-handover guidance: store and share developer keys only through approved organizational secret management.
- No changes to runtime API interception or browser transport.

## 1.0.2 — Simple localStorage activation and more reliable logs

- Installer now asks for a single custom key, accepting 1–24 characters.
- Browser provider uses `apiDebugLogging` by default, initializes it to `disabled`, and accepts a temporary matching key to authenticate.
- The key is removed from localStorage immediately when processed and replaced with `enabled` only after successful validation.
- Every supported Node `fetch` event in local development enters a bounded 5,000-event replay buffer and prints to the **server terminal** as fallback, even if no browser is authenticated yet.
- Authenticated local browsers can replay buffered API calls. API endpoints reject non-loopback hosts; production remains disabled.
- Key stored in localStorage even briefly is readable by browser scripts. Use only with synthetic local development data.
- No guarantee of interception across all Next.js fetch implementations, external HTTP libraries, or process restarts.

## 1.0.1 — Documentation and discoverability

- Expanded npm README with end-to-end Next.js 16 setup, actual exports, configuration, and Console examples.
- Added clear compatibility, limitations, troubleshooting and security information.
- Added repository, homepage and issue tracker metadata and improved search keywords.
- No changes to runtime request interception or authentication.

## 1.0.0 — Initial development-only release

- Development-mode Next.js App Router fetch logger with explicit debugFetch fallback.
- Per-project private key setup, authenticated browser sessions, and Console output.
- Node.js build and automated authentication tests.
