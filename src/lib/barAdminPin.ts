const DB_NAME = "bhaskar.bar.admin.v1";
const STORE = "settings";
const KEY = "pin";

interface PinRecord { key: string; salt: string; hash: string }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function hex(bytes: Uint8Array) { return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(""); }
function bytes(value: string) { return new Uint8Array(value.match(/.{2}/g)?.map((part) => parseInt(part, 16)) ?? []); }

async function derive(pin: string, salt: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = bytes(salt);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(result));
}

async function readPin(): Promise<PinRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function hasBarAdminPin() { return Boolean(await readPin()); }

export async function setBarAdminPin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("O PIN deve ter entre 4 e 6 números.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: PinRecord = { key: KEY, salt: hex(salt), hash: await derive(pin, hex(salt)) };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function verifyBarAdminPin(pin: string) {
  const record = await readPin();
  if (!record) return false;
  return (await derive(pin, record.salt)) === record.hash;
}
