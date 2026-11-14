// pnpm dev:local
//
// The whole product on this machine, with no external service: the Docker database, a local
// anvil chain with the real registry contract, evidence stored on disk, and the app wired to
// all three. It is also what the end-to-end test runs against (playwright.config.ts).
//
//   1. starts anvil under Base Sepolia's chain id and deploys ImpactAnchorRegistry (state is
//      kept in .local/, so the chain survives a restart)
//   2. tops the seed up (pnpm db:seed is idempotent)
//   3. starts next dev with the chain, storage and demo settings in its environment
//   4. the first time, anchors the seeded history that was approved more than six hours ago,
//      so every state is on show: anchored, approved and waiting, in review, escalated
//
// Nothing here can reach Base Sepolia or a real key: the accounts are anvil's published test
// accounts, and the database is always the local one, whatever .env.local says.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import postgres from "postgres";
import { createPublicClient, http, parseAbi, zeroHash } from "viem";
import { baseSepolia } from "viem/chains";
import { startLocalChain } from "./lib/local-chain";

const PORT = Number(process.env.PORT ?? 3000);
const APP = `http://localhost:${PORT}`;
const DB = "postgresql://delta:delta_local@localhost:5432/delta";
const CRON_SECRET = "local-development-cron-secret";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

async function main() {
  mkdirSync(".local/storage", { recursive: true });
  const chain = await startLocalChain({ port: 8545, statePath: ".local/anvil-state.json" });
  console.log(`local chain  ${chain.rpcUrl}  registry ${chain.contractAddress}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: DB,
    DATABASE_URL_UNPOOLED: DB,
    NEON_BRANCH: "local-docker",
    BETTER_AUTH_URL: APP,
    NEXT_PUBLIC_CHAIN_ID: String(baseSepolia.id),
    BASE_SEPOLIA_RPC_URL: chain.rpcUrl,
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: chain.rpcUrl,
    ANCHOR_CONTRACT_ADDRESS: chain.contractAddress,
    NEXT_PUBLIC_CONTRACT_ADDRESS: chain.contractAddress,
    // no key is handed over: the local node signs with its own unlocked account
    LOCAL_CHAIN_ANCHORER: chain.anchorerAddress,
    LOCAL_STORAGE_DIR: ".local/storage",
    // email confirmation and password reset on, each message written here instead of sent
    EMAIL_OUTBOX_DIR: ".local/outbox",
    FORENSICS_MATCH_KEY: "local-development-only-forensics-match-key",
    CRON_SECRET,
    DEMO_MODE: "true",
    // DELTA_NO_AI=1 (the end-to-end test): the advisory job reports itself unavailable instead of calling out
    ...(process.env.DELTA_NO_AI ? { GEMINI_API_KEY: "" } : {}),
  };

  try {
    execFileSync(pnpm, ["db:seed"], { env, stdio: "inherit", shell: process.platform === "win32" });
  } catch {
    chain.stop();
    throw new Error("the seed did not run: is the Docker database up? (docker compose up -d, then pnpm db:migrate)");
  }

  const app = spawn(pnpm, ["exec", "next", "dev", "-p", String(PORT)], { env, stdio: "inherit", shell: process.platform === "win32" });
  const stop = () => {
    chain.stop();
    app.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  app.on("exit", (code) => {
    chain.stop();
    process.exit(code ?? 0);
  });

  await firstAnchor(chain.rpcUrl, chain.contractAddress);
}

/** Once per local database: anchors the seeded history, and says so if the chain and the database disagree. */
async function firstAnchor(rpcUrl: string, contractAddress: `0x${string}`) {
  const sql = postgres(DB, { max: 1, onnotice: () => {} });
  try {
    const [last] = await sql<{ id: number }[]>`select id from anchor_batch where status = 'CONFIRMED' and lower(contract_address) = ${contractAddress.toLowerCase()} order by id desc limit 1`;
    if (last) {
      const reader = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
      const held = await reader.readContract({ address: contractAddress, abi: parseAbi(["function getAnchor(uint256) view returns ((bytes32 merkleRoot, uint64 anchoredAt, uint32 leafCount))"]), functionName: "getAnchor", args: [BigInt(last.id)] });
      if (held.merkleRoot === zeroHash) {
        console.warn(`\nThe local chain was reset: the database says batch ${last.id} is confirmed, but this chain holds nothing under it.\nProof pages of records anchored before the reset will report a mismatch. To start clean, recreate the database volume\n(docker compose down -v, up -d, pnpm db:migrate) and delete .local/.\n`);
      }
      return;
    }
  } finally {
    await sql.end();
  }

  for (let i = 0; i < 120; i++) {
    if (await fetch(APP).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const before = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const res = await fetch(`${APP}/api/internal/anchor/daily?before=${encodeURIComponent(before)}`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  const run = (await res.json()) as { created?: { batchId: number; leafCount: number } | null; error?: string };
  console.log(res.ok && run.created ? `first anchor: batch ${run.created.batchId}, ${run.created.leafCount} seeded records, on the local chain` : `first anchor: ${run.error ?? "nothing was waiting"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
