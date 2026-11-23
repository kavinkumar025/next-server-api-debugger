import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", server: "src/server.ts" },
    platform: "node",
    format: ["esm"],
    target: "node20",
    external: ["next", "react"],
    dts: true,
    splitting: false
  },
  {
    entry: { client: "src/client.tsx" },
    platform: "browser",
    format: ["esm"],
    target: "es2022",
    external: ["next", "react"],
    banner: { js: '"use client";' },
    dts: true,
    splitting: false
  },
  {
    entry: { browser: "src/browser.ts" },
    platform: "browser",
    format: ["esm"],
    target: "es2022",
    external: ["next", "react"],
    dts: true,
    splitting: false
  }
]);
