import type { NextConfig } from "next";

const C2PA_WASM = "./node_modules/@contentauth/c2pa-wasm/pkg/c2pa_bg.wasm";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The C2PA reader (X9) stays a Node package, and its 9 MB WebAssembly is read from disk by path,
  // which tracing cannot see: it is shipped with exactly the functions that run the forensic checks
  // (the drain, intake's after() drain, and /admin's retry), not with every route.
  serverExternalPackages: ["@contentauth/c2pa-wasm"],
  outputFileTracingIncludes: {
    "/api/internal/jobs/drain": [C2PA_WASM],
    "/api/submissions/*/finalize": [C2PA_WASM],
    "/api/submissions/*/supplement": [C2PA_WASM],
    "/admin": [C2PA_WASM],
  },
  // Dev only: less browser noise in the terminal.
  logging: { browserToTerminal: "error" },
  // Dev only. The dev MCP endpoint's file logger writes every browser console line, whatever the
  // setting above, to .next/dev/logs/next-development.log. Started from a lower-case drive
  // (d:\, as VS Code's terminal does) the watcher takes that write for a source change, Fast
  // Refresh reloads the page, the page logs again: a reload about every 300 ms.
  experimental: { mcpServer: false },
};

export default nextConfig;
