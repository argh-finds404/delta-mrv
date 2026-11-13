import { defineConfig } from "@playwright/test";

// End-to-end tests run against the fully local stack (pnpm dev:local): the Docker database, a
// local anvil chain with the real registry contract, and evidence on disk. Nothing here reaches
// Base Sepolia, the blob store or the AI service. If the stack is already running it is reused.
export default defineConfig({
  testDir: "test/e2e",
  globalSetup: "./test/e2e/global-setup.ts",
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // software WebGL, so the maps render the same on a machine with no GPU
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", launchOptions: { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] } },
  webServer: {
    command: "pnpm dev:local",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 300_000,
    env: { DELTA_NO_AI: "1" },
  },
});
