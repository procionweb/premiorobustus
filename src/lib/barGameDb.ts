export type BarCharacter = "jackson" | "ginaldo";

export interface BarPrize {
  id: string;
  name: string;
  weight: number;
  enabled: boolean;
}

export interface BarGameResult {
  id: string;
  playedAt: string;
  character: BarCharacter;
  score: number;
  drunk: number;
  outcome: "time" | "fall";
  prizeId: string | null;
  prizeName: string | null;
}

export const DEFAULT_BAR_PRIZES: BarPrize[] = [
  { id: "dose", name: "Dose Bhaskar", weight: 30, enabled: true },
  { id: "desconto", name: "Desconto especial", weight: 25, enabled: true },
  { id: "brinde", name: "Brinde surpresa", weight: 20, enabled: true },
  { id: "again", name: "Jogue novamente", weight: 25, enabled: true },
];

const DB_NAME = "bhaskar.bar.offline.v1";
const DB_VERSION = 1;
const SETTINGS = "settings";
const RESULTS = "results";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(RESULTS)) {
        const store = db.createObjectStore(RESULTS, { keyPath: "id" });
        store.createIndex("playedAt", "playedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getBarPrizes(): Promise<BarPrize[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SETTINGS, "readonly").objectStore(SETTINGS).get("prizes");
    request.onsuccess = () => resolve(request.result?.value ?? DEFAULT_BAR_PRIZES.map((prize) => ({ ...prize })));
    request.onerror = () => reject(request.error);
  });
}

export async function saveBarPrizes(prizes: BarPrize[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SETTINGS, "readwrite");
    transaction.objectStore(SETTINGS).put({ key: "prizes", value: prizes });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveBarResult(result: BarGameResult): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RESULTS, "readwrite");
    transaction.objectStore(RESULTS).put(result);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getBarResults(): Promise<BarGameResult[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(RESULTS, "readonly").objectStore(RESULTS).getAll();
    request.onsuccess = () => resolve((request.result as BarGameResult[]).sort((a, b) => b.playedAt.localeCompare(a.playedAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function clearBarResults(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RESULTS, "readwrite");
    transaction.objectStore(RESULTS).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function createBarResultId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
