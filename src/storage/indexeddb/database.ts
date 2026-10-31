/* ---------------------------------------------------------------------------
   Minimal IndexedDB wrapper for LUMEN's persistent context. Two stores:
   - scenes:       keyed by sessionId  (the scene-graph snapshot)
   - observations: keyed by id, indexed by sessionId
   All calls are best-effort and degrade gracefully if IndexedDB is unavailable.
--------------------------------------------------------------------------- */

const DB_NAME = "lumen-2";
const DB_VERSION = 1;

export const STORE_SCENES = "scenes";
export const STORE_OBSERVATIONS = "observations";

function hasIdb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIdb()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SCENES)) {
        db.createObjectStore(STORE_SCENES, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORE_OBSERVATIONS)) {
        const os = db.createObjectStore(STORE_OBSERVATIONS, { keyPath: "id" });
        os.createIndex("bySession", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(store: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value as never);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDb();
  const result = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function idbGetAllByIndex<T>(
  store: string,
  index: string,
  key: IDBValidKey
): Promise<T[]> {
  const db = await openDb();
  const result = await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).index(index).getAll(key);
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
