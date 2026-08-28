import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

export type BarCharacter = "jackson" | "ginaldo";

export interface BarPrize {
  id: string;
  name: string;
  description: string;
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

export interface BarParticipant {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export const DEFAULT_BAR_PRIZES: BarPrize[] = [
  { id: "off-5", name: "5% OFF", description: "Você ganhou 5% OFF em qualquer compra Bhaskar.", weight: 12.5, enabled: true },
  { id: "dupla", name: "Dupla Bhaskar", description: "Compre uma Bhaskar 275 ml e ganhe 10% OFF em uma garrafa de 750 ml.", weight: 12.5, enabled: true },
  { id: "leve-4", name: "Compre 3 e leve 4", description: "Compre 3 e leve 4. Leve a de menor valor escolhido como brinde.", weight: 12.5, enabled: true },
  { id: "off-10", name: "10% OFF", description: "Você ganhou 10% OFF em qualquer compra Bhaskar.", weight: 12.5, enabled: true },
  { id: "segunda-20", name: "Segunda com 20% OFF", description: "Você ganhou 20% OFF na segunda garrafa Bhaskar que comprar.", weight: 12.5, enabled: true },
  { id: "off-15", name: "15% OFF", description: "Você ganhou 15% OFF em compras acima de R$ 89,90.", weight: 12.5, enabled: true },
  { id: "off-275", name: "30% OFF na 275 ml", description: "Comprando uma Bhaskar 750 ml, ganhe 30% OFF em uma garrafa de 275 ml.", weight: 12.5, enabled: true },
  { id: "super-275", name: "Bhaskar 275 ml", description: "SUPER PRÊMIO! Você ganhou uma garrafa Bhaskar 275 ml.", weight: 12.5, enabled: true },
];

const DB_NAME = "bhaskar.bar.offline.v1";
const DB_VERSION = 2;
const SETTINGS = "settings";
const RESULTS = "results";
const PARTICIPANTS = "participants";
const NATIVE_DB_NAME = "bhaskar_participants";
const sqlite = new SQLiteConnection(CapacitorSQLite);
let nativeDbPromise: Promise<SQLiteDBConnection> | null = null;

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
      if (!db.objectStoreNames.contains(PARTICIPANTS)) {
        const store = db.createObjectStore(PARTICIPANTS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIndexedParticipants(): Promise<BarParticipant[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PARTICIPANTS, "readonly").objectStore(PARTICIPANTS).getAll();
    request.onsuccess = () => resolve(request.result as BarParticipant[]);
    request.onerror = () => reject(request.error);
  });
}

async function getNativeDb(): Promise<SQLiteDBConnection> {
  if (!nativeDbPromise) {
    nativeDbPromise = (async () => {
      const consistent = await sqlite.checkConnectionsConsistency();
      const existing = await sqlite.isConnection(NATIVE_DB_NAME, false);
      const db = consistent.result && existing.result
        ? await sqlite.retrieveConnection(NATIVE_DB_NAME, false)
        : await sqlite.createConnection(NATIVE_DB_NAME, false, "no-encryption", 1, false);
      if (!(await db.isDBOpen()).result) await db.open();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS participants (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_participants_created_at ON participants(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_participants_phone ON participants(phone);
      `);

      // Preserve registrations made by builds that still used IndexedDB.
      const legacy = await getIndexedParticipants().catch(() => []);
      if (legacy.length) {
        await db.executeSet(legacy.map((participant) => ({
          statement: "INSERT OR IGNORE INTO participants (id, name, phone, created_at) VALUES (?, ?, ?, ?)",
          values: [participant.id, participant.name, participant.phone, participant.createdAt],
        })));
      }
      return db;
    })().catch((error) => {
      nativeDbPromise = null;
      throw error;
    });
  }
  return nativeDbPromise;
}

export async function saveBarParticipant(participant: BarParticipant): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    await db.run(
      "INSERT INTO participants (id, name, phone, created_at) VALUES (?, ?, ?, ?)",
      [participant.id, participant.name, participant.phone, participant.createdAt],
    );
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PARTICIPANTS, "readwrite");
    transaction.objectStore(PARTICIPANTS).put(participant);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getBarParticipants(): Promise<BarParticipant[]> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    const result = await db.query("SELECT id, name, phone, created_at AS createdAt FROM participants ORDER BY created_at DESC");
    return (result.values ?? []) as BarParticipant[];
  }
  const participants = await getIndexedParticipants();
  return participants.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBarParticipantsPage(limit = 100, offset = 0): Promise<BarParticipant[]> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    const result = await db.query(
      "SELECT id, name, phone, created_at AS createdAt FROM participants ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    return (result.values ?? []) as BarParticipant[];
  }
  const participants = await getIndexedParticipants();
  return participants.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(offset, offset + limit);
}

export async function countBarParticipants(): Promise<number> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    const result = await db.query("SELECT COUNT(*) AS total FROM participants");
    return Number(result.values?.[0]?.total ?? 0);
  }
  return (await getIndexedParticipants()).length;
}

export async function clearBarParticipants(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const db = await getNativeDb();
    await db.run("DELETE FROM participants");
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PARTICIPANTS, "readwrite");
    transaction.objectStore(PARTICIPANTS).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function createBarParticipantId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getBarPrizes(): Promise<BarPrize[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SETTINGS, "readonly").objectStore(SETTINGS).get("prizes");
    request.onsuccess = () => {
      const saved = request.result?.value as BarPrize[] | undefined;
      const legacyIds = new Set(["dose", "desconto", "brinde", "again"]);
      if (!saved?.length || saved.every((prize) => legacyIds.has(prize.id))) {
        resolve(DEFAULT_BAR_PRIZES.map((prize) => ({ ...prize })));
        return;
      }
      resolve(saved.map((prize) => ({ ...prize, description: prize.description ?? "" })));
    };
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
