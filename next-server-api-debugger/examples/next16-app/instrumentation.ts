export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerServerDebugger } = await import("next-server-api-debugger/server");
    registerServerDebugger({ captureBodies: true, maxBodyBytes: 8000 });
  }
}
