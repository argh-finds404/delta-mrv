import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: less browser noise in the terminal.
  logging: { browserToTerminal: "error" },
  // Dev only. The dev MCP endpoint's file logger writes every browser console line, whatever the
  // setting above, to .next/dev/logs/next-development.log. Started from a lower-case drive
  // (d:\, as VS Code's terminal does) the watcher takes that write for a source change, Fast
  // Refresh reloads the page, the page logs again: a reload about every 300 ms.
  experimental: { mcpServer: false },
};

export default nextConfig;
