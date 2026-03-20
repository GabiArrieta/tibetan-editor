/**
 * fontStorage — IndexedDB persistence layer for font binaries.
 *
 * Font binaries are stored separately from the project JSON.
 * The project JSON stores only FontEntry metadata with a storageKey
 * that maps to an entry here.
 *
 * Store name: 'font-binaries'
 * Key type:   string (matches FontEntry.storageKey)
 * Value type: ArrayBuffer (the raw font file bytes)
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'tibetan-editor-fonts'
const DB_VERSION = 1
const STORE_NAME = 'font-binaries'

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

/**
 * Save a font binary to IndexedDB.
 * @param storageKey  Unique key (e.g. a UUID) for this font entry
 * @param buffer      The raw font file as ArrayBuffer
 */
export async function saveFontBinary(storageKey: string, buffer: ArrayBuffer): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, buffer, storageKey)
}

/**
 * Retrieve a font binary from IndexedDB.
 * Returns null if the key does not exist (font was removed or never uploaded).
 */
export async function getFontBinary(storageKey: string): Promise<ArrayBuffer | null> {
  const db = await getDB()
  const result = await db.get(STORE_NAME, storageKey)
  return result ?? null
}

/**
 * Delete a font binary from IndexedDB.
 */
export async function deleteFontBinary(storageKey: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, storageKey)
}

/**
 * Check whether a font binary exists in IndexedDB.
 */
export async function fontBinaryExists(storageKey: string): Promise<boolean> {
  const db = await getDB()
  const count = await db.count(STORE_NAME, storageKey)
  return count > 0
}

/**
 * List all storage keys currently in IndexedDB.
 * Useful for detecting orphaned binaries.
 */
export async function listStorageKeys(): Promise<string[]> {
  const db = await getDB()
  return db.getAllKeys(STORE_NAME) as Promise<string[]>
}

/**
 * Delete all font binaries whose storageKey is not in the provided set.
 * Call this after loading a project to clean up orphaned blobs.
 */
export async function pruneOrphanedFonts(activeKeys: Set<string>): Promise<void> {
  const db = await getDB()
  const allKeys = await db.getAllKeys(STORE_NAME) as string[]
  const tx = db.transaction(STORE_NAME, 'readwrite')
  await Promise.all(
    allKeys
      .filter(k => !activeKeys.has(k))
      .map(k => tx.store.delete(k))
  )
  await tx.done
}
