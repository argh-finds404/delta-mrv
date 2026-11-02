// Enforces docs/07-DEPENDENCIES.md §4 (forbidden packages and files) and the
// docs/09-WEB3.md §6 rule that ANCHOR_PRIVATE_KEY lives in one source file.
// Checks direct dependencies only; transitive ones are the lockfile's business.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const failures = [];

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const specs = {
  ...pkg.peerDependencies,
  ...pkg.optionalDependencies,
  ...pkg.devDependencies,
  ...pkg.dependencies,
};

const FORBIDDEN = new Set([
  "@google/generative-ai", "@neondatabase/serverless", "pg", "prisma",
  "drizzle-zod", "next-auth", "ethers", "web3", "wagmi", "hardhat",
  "cloudinary", "aws-sdk", "axios", "moment", "lodash",
]);
const FORBIDDEN_PREFIXES = ["@prisma/", "@auth/", "@rainbow-me/", "@aws-sdk/"];

for (const [name, spec] of Object.entries(specs)) {
  if (FORBIDDEN.has(name) || FORBIDDEN_PREFIXES.some((p) => name.startsWith(p))) {
    failures.push(`forbidden package: ${name}@${spec} (docs/07-DEPENDENCIES.md §4)`);
  }
}
// drizzle-orm must be a 0.x release: 1.x, @beta and @rc use another relations API.
if (specs["drizzle-orm"] && !/^[\^~]?0\./.test(specs["drizzle-orm"])) {
  failures.push(`drizzle-orm must be 0.x, found ${specs["drizzle-orm"]}`);
}

for (const f of ["package-lock.json", "yarn.lock"]) {
  if (existsSync(join(root, f))) failures.push(`forbidden file: ${f} (pnpm-lock.yaml only)`);
}

const SKIP = new Set(["node_modules", ".git", ".next", "out", "build", "coverage", ".vercel"]);
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

for (const file of walk(root)) {
  if (/^middleware\.(ts|js)$/.test(file.split(sep).pop())) {
    failures.push(`forbidden file: ${relative(root, file)} (use src/proxy.ts)`);
  }
}

try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n");
  for (const f of tracked) {
    if (/^\.env(\..+)?$/.test(f) && f !== ".env.example") failures.push(`committed env file: ${f}`);
  }
} catch {
  // not a git checkout (CI tarball): nothing to inspect
}

// src/env.ts only declares the variable; this script and tests only name it.
const KEY = "ANCHOR_PRIVATE_KEY";
const EXEMPT = new Set(["src/env.ts", "scripts/check-forbidden-deps.mjs"]);
const users = [];
for (const dir of ["src", "scripts", "contracts"]) {
  for (const file of walk(join(root, dir))) {
    const rel = relative(root, file).split(sep).join("/");
    if (EXEMPT.has(rel) || rel.startsWith("contracts/lib/") || !/\.(m?[jt]sx?|cjs|sol)$/.test(rel)) continue;
    if (readFileSync(file, "utf8").includes(KEY)) users.push(rel);
  }
}
if (users.length > 1) failures.push(`${KEY} appears in ${users.length} source files, max 1: ${users.join(", ")}`);

if (failures.length) {
  console.error(failures.map((f) => `  x ${f}`).join("\n"));
  process.exit(1);
}
console.log("forbidden-deps: ok");
