import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only. Forwarding the browser console writes .next/dev/logs/next-development.log,
  // the watcher sees that write as a change, Fast Refresh logs in the browser, and that is
  // forwarded and written again: the page reloaded about every 300 ms. Errors still forward.
  logging: { browserToTerminal: "error" },
};

export default nextConfig;
