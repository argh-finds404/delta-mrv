import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // server-only throws outside Next's server bundle
    alias: { "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)) },
  },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
