// Сохранения: журнал в IndexedDB (автосейв), настройки — в localStorage. Всё с защитой от недоступного хранилища.
import type { GameEvent } from '../domain/events';
import { cyrb53 } from '../domain/checksum';

export interface SaveData {
  journal: GameEvent[];
  inkState: string | null;
  savedAt: string;
  mode: string;
}

const DB = 'dvoinoe-dno';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    } catch (e) {
      rej(e);
    }
  });
}

export async function saveGame(slot: string, data: SaveData) {
  try {
    const db = await openDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, slot);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    /* хранилище недоступно (приватное окно) — игра работает без сохранения */
  }
}

export async function loadGame(slot: string): Promise<SaveData | null> {
  try {
    const db = await openDb();
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(slot);
      r.onsuccess = () => res((r.result as SaveData) ?? null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function clearGame(slot: string) {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(slot);
  } catch {
    /* ignore */
  }
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export interface JournalExport {
  format: 'dvoinoe-dno/journal@1';
  student: string;
  exportedAt: string;
  journal: GameEvent[];
  checksum: string;
}

export function exportJournal(journal: GameEvent[], student: string): JournalExport {
  return { format: 'dvoinoe-dno/journal@1', student, exportedAt: new Date().toISOString(), journal, checksum: cyrb53(JSON.stringify(journal)) };
}

export function verifyJournal(x: JournalExport): boolean {
  return x.format === 'dvoinoe-dno/journal@1' && cyrb53(JSON.stringify(x.journal)) === x.checksum;
}

export function download(name: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
