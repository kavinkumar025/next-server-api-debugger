export const KEY_NAME = "NEXT_SERVER_API_DEBUGGER_KEY";
export const HASH_NAME = "NEXT_SERVER_API_DEBUGGER_KEY_HASH";
const allowed = /^[A-Za-z0-9._-]{1,24}$/;
export function parseKeyConfig(text) {
  const found = text.match(/^NEXT_SERVER_API_DEBUGGER_KEY\s*=\s*(.*)$/m);
  const key = found?.[1]?.trim() || null;
  return { key, valid: key !== null && allowed.test(key),
    legacy: /^NEXT_SERVER_API_DEBUGGER_KEY_HASH\s*=/m.test(text) };
}
export function saveKeyConfig(text, key) {
  if (!allowed.test(key)) throw new Error(
    "Key must contain 1–24 letters, digits, dots, underscores, or hyphens."
  );
  const kept = text.split(/\r?\n/).filter(line =>
    !/^\s*NEXT_SERVER_API_DEBUGGER_KEY(?:_HASH)?\s*=/.test(line)
  ).join("\n").replace(/\n+$/, "");
  return (kept ? kept + "\n" : "") + KEY_NAME + "=" + key + "\n";
}
