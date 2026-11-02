import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Database tests: need DATABASE_URL_UNPOOLED on a non-production branch (see test/integration/setup.ts).
export default defineConfig({
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["test/integration/setup.ts"],
    // Every query is a round trip to Neon, and a suspended compute needs a moment to wake.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
