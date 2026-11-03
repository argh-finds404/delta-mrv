import { builtinModules } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layer boundaries from docs/02-ARCHITECTURE.md §3. A breach is a lint error.
const ANY_SERVER = ["**/server", "**/server/**"];
const APP = ["**/src/app/**"];
const COMPONENTS = ["**/src/components/**"];
const NODE_BUILTINS = [...new Set(builtinModules.map((m) => m.replace(/^node:/, "")))];

const restrict = (message, { paths = [], patterns = [] }) => ({
  "no-restricted-imports": [
    "error",
    {
      paths: paths.map((name) => ({ name, message })),
      patterns: patterns.map((group) => ({ group: [group], message })),
    },
  ],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // app may use services and auth, never db or storage directly
    files: ["src/app/**"],
    rules: restrict("src/app may import server code only via src/server/services or src/server/auth", {
      patterns: ["**/server/db", "**/server/db/**", "**/server/storage", "**/server/storage/**"],
    }),
  },
  {
    files: ["src/components/**"],
    rules: restrict("src/components is presentation only: components and lib, never server or app", {
      patterns: [...ANY_SERVER, ...APP],
    }),
  },
  {
    // isomorphic: must bundle for the browser, Web Crypto only
    files: ["src/lib/**"],
    rules: restrict("src/lib is isomorphic: no server code, no Node built-ins, no UI layers", {
      paths: NODE_BUILTINS,
      patterns: ["node:*", ...ANY_SERVER, ...APP, ...COMPONENTS],
    }),
  },
  {
    // server-only modules cannot be imported outside Next
    files: ["scripts/**"],
    rules: restrict("scripts import src/lib and scripts/lib only, never src/server", {
      patterns: ANY_SERVER,
    }),
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
