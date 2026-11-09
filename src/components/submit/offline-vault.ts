// Offline Draft Vault using native IndexedDB (doc 12 §3 & §8).
// Preserves field photographs and telemetry locally when disconnected in mangrove or rural sites.

export interface StoredEvidenceFile {
  name: string;
  type: string;
  size: number;
  sha256: string;
  data: ArrayBuffer;
}

export interface OfflineDraft {
  id: string;
  projectId: string;
  projectTitle: string;
  activityType: string;
  note: string;
  deviceGps: { lat: number; lon: number } | null;
  beforeFile: StoredEvidenceFile;
  afterFile: StoredEvidenceFile;
  createdAt: number;
}

const DB_NAME = "delta_field_vault";
const STORE_NAME = "offline_submissions";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineDraft(
  draft: Omit<OfflineDraft, "id" | "createdAt">,
): Promise<string> {
  const db = await openDb();
  if (!db) throw new Error("IndexedDB is unavailable in this environment");

  const id = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: OfflineDraft = {
    ...draft,
    id,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

export async function listOfflineDrafts(): Promise<OfflineDraft[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve((req.result as OfflineDraft[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function countOfflineDrafts(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();

    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineDraft(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function fileToStored(file: File, sha256: string): Promise<StoredEvidenceFile> {
  return file.arrayBuffer().then((data) => ({
    name: file.name,
    type: file.type || "image/jpeg",
    size: file.size,
    sha256,
    data,
  }));
}

export function storedToFile(stored: StoredEvidenceFile): File {
  return new File([stored.data], stored.name, { type: stored.type });
}

