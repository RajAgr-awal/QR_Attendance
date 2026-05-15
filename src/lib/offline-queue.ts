/**
 * offline-queue.ts
 * IndexedDB-backed queue for scans made while offline.
 * Uses the `idb` library for a promise-based API.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type ScanStatus = 'pending' | 'synced' | 'failed'

export interface PendingScan {
  id?: number
  qrData: string
  eventDayId: string
  scannedAt: string   // ISO timestamp from when the scan actually happened
  status: ScanStatus
  errorMessage?: string
  syncedAt?: string
}

interface QRAttendanceDB extends DBSchema {
  'pending-scans': {
    key: number
    value: PendingScan
    indexes: { status: ScanStatus; scannedAt: string }
  }
}

const DB_NAME = 'qr-attendance-offline'
const STORE = 'pending-scans'
const VERSION = 1

let _db: IDBPDatabase<QRAttendanceDB> | null = null

async function getDB(): Promise<IDBPDatabase<QRAttendanceDB>> {
  if (_db) return _db
  _db = await openDB<QRAttendanceDB>(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('status', 'status')
        store.createIndex('scannedAt', 'scannedAt')
      }
    },
  })
  return _db
}

export async function enqueueScan(
  scan: Pick<PendingScan, 'qrData' | 'eventDayId' | 'scannedAt'>
): Promise<number> {
  const db = await getDB()
  return db.add(STORE, { ...scan, status: 'pending' }) as Promise<number>
}

export async function getPendingScans(): Promise<PendingScan[]> {
  const db = await getDB()
  return db.getAllFromIndex(STORE, 'status', 'pending')
}

export async function getAllScans(): Promise<PendingScan[]> {
  const db = await getDB()
  return db.getAll(STORE)
}

export async function markSynced(id: number): Promise<void> {
  const db = await getDB()
  const item = await db.get(STORE, id)
  if (item) await db.put(STORE, { ...item, status: 'synced', syncedAt: new Date().toISOString() })
}

export async function markFailed(id: number, error: string): Promise<void> {
  const db = await getDB()
  const item = await db.get(STORE, id)
  if (item) await db.put(STORE, { ...item, status: 'failed', errorMessage: error })
}

export async function clearSynced(): Promise<void> {
  const db = await getDB()
  const synced = await db.getAllFromIndex(STORE, 'status', 'synced')
  const tx = db.transaction(STORE, 'readwrite')
  await Promise.all(synced.map((s) => tx.store.delete(s.id!)))
  await tx.done
}
