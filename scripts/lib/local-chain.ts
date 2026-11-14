// A local anvil chain with ImpactAnchorRegistry deployed, for the anchor tests, the end-to-end
// test and local development. Never Base Sepolia, never a real key (docs/09-WEB3.md §6):
// the accounts come from anvil's published test mnemonic and hold nothing anywhere else.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createPublicClient, createWalletClient, getContractAddress, http, parseAbi, toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

type Hex = `0x${string}`;

const MNEMONIC = "test test test test test test test test test test test junk";
const account = (index: number) => mnemonicToAccount(MNEMONIC, { addressIndex: index });
export const localKey = (index: number): Hex => toHex(account(index).getHdKey().privateKey!);

/** Foundry's own install directory first (it is not on every shell's PATH), then the PATH. */
function foundry(name: string): string {
  const exe = join(homedir(), ".foundry", "bin", process.platform === "win32" ? `${name}.exe` : name);
  return existsSync(exe) ? exe : name;
}

export type LocalChain = {
  rpcUrl: string;
  contractAddress: Hex;
  /** The account the registry's owner authorised to anchor. anvil keeps it unlocked, so the node can sign for it. */
  anchorerAddress: Hex;
  anchorerKey: Hex;
  /** An account with funds and no rights, for the refusal tests. */
  strangerKey: Hex;
  stop: () => void;
};

/**
 * Starts anvil under Base Sepolia's chain id and deploys the registry from account `deployer`
 * (owner), with account `deployer + 1` as the anchorer. With `statePath` the chain survives a
 * restart, and an already-deployed registry is found again instead of deployed twice.
 */
export async function startLocalChain(opts: { port: number; deployer?: number; statePath?: string }): Promise<LocalChain> {
  const rpcUrl = `http://127.0.0.1:${opts.port}`;
  const args = ["--chain-id", String(baseSepolia.id), "--port", String(opts.port), "--silent"];
  // written every second as well as on exit: a killed process must not lose a confirmed batch
  if (opts.statePath) args.push("--state", opts.statePath, "--state-interval", "1");
  const anvil = spawn(foundry("anvil"), args, { stdio: "ignore" });
  const failed = new Promise<never>((_, reject) => anvil.once("error", (e) => reject(new Error(`could not start anvil (is Foundry installed?): ${e.message}`))));
  const stop = () => void anvil.kill();

  try {
    const transport = http(rpcUrl);
    const reader = createPublicClient({ chain: baseSepolia, transport });
    const ready = (async () => {
      for (let i = 0; i < 100; i++) {
        if (await reader.getChainId().then(() => true, () => false)) return;
        await new Promise((r) => setTimeout(r, 150));
      }
      throw new Error(`anvil did not answer on ${rpcUrl}`);
    })();
    await Promise.race([ready, failed]);

    const d = opts.deployer ?? 0;
    const owner = account(d);
    const anchorer = account(d + 1);
    const contractAddress = getContractAddress({ from: owner.address, nonce: BigInt(0) });
    if (!(await reader.getCode({ address: contractAddress }))) {
      execFileSync(foundry("forge"), ["build", "--root", "contracts"], { stdio: "ignore" });
      const artifact = JSON.parse(readFileSync("contracts/out/ImpactAnchorRegistry.sol/ImpactAnchorRegistry.json", "utf8")) as { abi: readonly unknown[]; bytecode: { object: Hex } };
      const wallet = createWalletClient({ account: owner, chain: baseSepolia, transport });
      const deployed = await reader.waitForTransactionReceipt({ hash: await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [owner.address] }) });
      if (deployed.contractAddress?.toLowerCase() !== contractAddress.toLowerCase()) throw new Error("the registry was not deployed where expected");
      const abi = parseAbi(["function setAnchorer(address anchorer, bool authorized)"]);
      await reader.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: contractAddress, abi, functionName: "setAnchorer", args: [anchorer.address, true] }) });
    }
    return { rpcUrl, contractAddress, anchorerAddress: anchorer.address, anchorerKey: localKey(d + 1), strangerKey: localKey(d + 2), stop };
  } catch (e) {
    stop();
    throw e;
  }
}
