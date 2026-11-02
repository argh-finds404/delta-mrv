import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Database tests: need DATABASE_URL_UNPOOLED on a non-production branch (see test/integration/db.ts).
export default defineConfig({
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 30_000, // a suspended Neon compute needs a moment to wake
    fileParallelism: false,
  },
});
