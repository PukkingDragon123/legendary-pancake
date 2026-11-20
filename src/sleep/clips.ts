// Tiny IndexedDB store for short night-sound clips (snores, sleep talk). No dependencies.
// Metadata and audio bytes live in separate object stores so listing a night never loads the audio.
// Audio is stored as ArrayBuffer + MIME type (not Blob) for older Safari versions that could not persist Blobs.

import type { SleepEventKind } from './types.ts';

const DB_NAME = 'hoot-hollow-clips';
const DB_VERSION = 1;
const META = 'meta';
const DATA = 'data';

export interface ClipMeta {
  id: string;
  sessionId: string;
  /** event start, epoch ms */
  t: number;
  kind?: SleepEventKind;
  /** event duration, s */
  dur?: number;
  /** bytes */
  size: number;
  type: string;
  created: number;
}

export interface SaveClipMeta {
  sessionId: string;
  t: number;
  kind?: SleepEventKind;
  dur?: number;
  /** use a pre-generated id (the recorder sets event.clipId before the async save finishes) */
  id?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) {
        const s = db.createObjectStore(META, { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId', { unique: false });
        s.createIndex('t', 't', { unique: false });
      }
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Run `fn` inside one transaction over both stores; resolves with whatever `fn` set once the transaction commits. */
async function transact<T>(mode: IDBTransactionMode, fn: (tx: IDBTransaction, set: (v: T) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction([META, DATA], mode);
    let result: T | undefined;
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    fn(tx, (v) => {
      result = v;
    });
  });
}

export function newClipId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function toBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Response(blob).arrayBuffer();
}

/** Store a clip; returns its id. */
export async function saveClip(blob: Blob, meta: SaveClipMeta): Promise<string> {
  const id = meta.id ?? newClipId();
  const data = await toBuffer(blob);
  const record: ClipMeta = {
    id,
    sessionId: meta.sessionId,
    t: meta.t,
    kind: meta.kind,
    dur: meta.dur,
    size: data.byteLength,
    type: blob.type || 'audio/wav',
    created: Date.now(),
  };
  await transact<void>('readwrite', (tx) => {
    tx.objectStore(META).put(record);
    tx.objectStore(DATA).put(data, id);
  });
  return id;
}

/** The clip's audio, or undefined if it does not exist (never saved, deleted, or storage cleared). */
export async function getClip(id: string): Promise<Blob | undefined> {
  return transact<Blob | undefined>('readonly', (tx, set) => {
    const m = tx.objectStore(META).get(id);
    const d = tx.objectStore(DATA).get(id);
    d.onsuccess = () => {
      const meta = m.result as ClipMeta | undefined;
      const buf = d.result as ArrayBuffer | undefined;
      set(buf ? new Blob([buf], { type: meta?.type ?? 'audio/wav' }) : undefined);
    };
  });
}

/** Metadata of all clips of a session, oldest first. */
export async function listClips(sessionId: string): Promise<ClipMeta[]> {
  return transact<ClipMeta[]>('readonly', (tx, set) => {
    const req = tx.objectStore(META).index('sessionId').getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => set((req.result as ClipMeta[]).sort((a, b) => a.t - b.t));
  });
}

/** Delete one clip. */
export async function deleteClip(id: string): Promise<void> {
  await transact<void>('readwrite', (tx) => {
    tx.objectStore(META).delete(id);
    tx.objectStore(DATA).delete(id);
  });
}

/** Delete every clip whose event time is before `ts`; resolves with the number deleted. */
export async function deleteClipsBefore(ts: number): Promise<number> {
  return transact<number>('readwrite', (tx, set) => {
    let n = 0;
    set(0);
    const data = tx.objectStore(DATA);
    const req = tx.objectStore(META).index('t').openCursor(IDBKeyRange.upperBound(ts, true));
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      data.delete(cur.primaryKey);
      cur.delete();
      set(++n);
      cur.continue();
    };
  });
}

/** 16-bit mono PCM -> WAV blob. */
export function encodeWav(pcm: Int16Array, sampleRate: number): Blob {
  const rate = Math.max(1, Math.round(sampleRate));
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true);
  return new Blob([buf], { type: 'audio/wav' });
}
