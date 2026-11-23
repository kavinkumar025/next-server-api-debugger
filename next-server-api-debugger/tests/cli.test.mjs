import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const cli = fileURLToPath(new URL("../bin/cli.mjs", import.meta.url));

function withProject(run) {
  const dir = mkdtempSync(join(tmpdir(), "api-debugger-cli-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "example-next-app" }));
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function invoke(dir, action) {
  return spawnSync(process.execPath, [cli, action], {
    cwd: dir,
    env: { ...process.env, NEXT_SERVER_API_DEBUGGER_PROJECT_DIR: dir },
    encoding: "utf8"
  });
}

test("status reports no key when a project has not been configured", () => {
  withProject(dir => {
    const result = invoke(dir, "status");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No debug key found/);
  });
});

test("status reports existing hash without printing the original key or hash", () => {
  withProject(dir => {
    const privateKey = "secret-from-former-developer";
    const savedHash = "0123456789abcdef0123456789abcdef:" + "a".repeat(128);
    writeFileSync(join(dir, ".env.local"),
      "NEXT_SERVER_API_DEBUGGER_KEY_HASH=" + savedHash + "\n"
    );
    const result = invoke(dir, "status");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /key configured/i);
    assert.match(result.stdout, /cannot be displayed/i);
    assert.match(result.stdout, /init --reset/);
    assert.ok(!result.stdout.includes(privateKey));
    assert.ok(!result.stdout.includes(savedHash));
  });
});

test("non-interactive init does not rotate or expose existing keys", () => {
  withProject(dir => {
    const savedHash = "0123456789abcdef0123456789abcdef:" + "a".repeat(128);
    const before = "NEXT_SERVER_API_DEBUGGER_KEY_HASH=" + savedHash + "\n";
    const file = join(dir, ".env.local");
    writeFileSync(file, before);
    const result = invoke(dir, "init");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Interactive terminal needed/i);
    assert.equal(readFileSync(file, "utf8"), before);
  });
});
