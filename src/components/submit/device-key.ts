// X2: this browser's signing key for capture statements (src/lib/capture-statement.ts). An
// ECDSA P-256 key pair made with WebCrypto, private half non-extractable: script on this page,
// Delta's included, can ask it to sign but can never read it. Kept in IndexedDB, one per account
// on this device. It is held by the browser, not by a hardware security chip, and the page says
// so: it shows that one device signed, not which device or where.
import { toBase64Url, type CaptureSignature } from "@/src/lib/capture-statement";

const DB = "delta_device_key";
const STORE = "keys";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function keyFor(userId: string): Promise<CryptoKeyPair> {
  const db = await open();
  const existing = await new Promise<CryptoKeyPair | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(userId);
    req.onsuccess = () => resolve(req.result as CryptoKeyPair | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing) return existing;
  const made = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(made, userId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return made;
}

/** Signs a capture statement with this device's key for this account, making the key the first time. */
export async function signWithDeviceKey(userId: string, statement: string, signedAt: string): Promise<CaptureSignature> {
  const keys = await keyFor(userId);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(statement));
  return { kind: "device-key", publicKey: toBase64Url(await crypto.subtle.exportKey("spki", keys.publicKey)), signature: toBase64Url(signature), signedAt };
}
