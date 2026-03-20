/**
 * projectIO — save and load project JSON.
 *
 * The project file format is the serialised TibetanDocument.
 * Font binaries are NOT included — only FontEntry metadata.
 * After loading, the caller must call loadFontsForDocument() to
 * restore fonts from IndexedDB.
 */

import type { TibetanDocument } from '../../types/document'

const AUTOSAVE_KEY = 'tibetan-editor:autosave'
const AUTOSAVE_INTERVAL_MS = 30_000

// ---------------------------------------------------------------------------
// Save to file (triggers browser download)
// ---------------------------------------------------------------------------

export function saveProjectToFile(doc: TibetanDocument): void {
  const updated: TibetanDocument = { ...doc, updatedAt: new Date().toISOString() }
  const json = JSON.stringify(updated, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.title.replace(/[^\w\s-]/g, '').trim() || 'documento'}.tibetan.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Load from file
// ---------------------------------------------------------------------------

export function loadProjectFromFile(): Promise<TibetanDocument> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.tibetan.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No se seleccionó ningún archivo.'))
      try {
        const text = await file.text()
        const doc = JSON.parse(text) as TibetanDocument
        if (!doc.id || !doc.blocks) {
          throw new Error('El archivo no es un proyecto Tibetan Editor válido.')
        }
        resolve(doc)
      } catch (err) {
        reject(err)
      }
    }
    input.click()
  })
}

// ---------------------------------------------------------------------------
// Autosave to localStorage
// ---------------------------------------------------------------------------

export function autosaveToLocalStorage(doc: TibetanDocument): void {
  try {
    const payload = JSON.stringify({ doc, savedAt: new Date().toISOString() })
    localStorage.setItem(AUTOSAVE_KEY, payload)
  } catch {
    // localStorage can throw if storage quota is exceeded
    console.warn('Autosave failed: localStorage quota exceeded')
  }
}

export function loadAutosave(): TibetanDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const { doc } = JSON.parse(raw) as { doc: TibetanDocument; savedAt: string }
    return doc
  } catch {
    return null
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY)
}

export function getAutosaveTimestamp(): string | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const { savedAt } = JSON.parse(raw) as { savedAt: string }
    return savedAt
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Autosave hook helper — call this from a useEffect
// ---------------------------------------------------------------------------

export function startAutosave(
  getDoc: () => TibetanDocument,
  onSave?: () => void
): () => void {
  const interval = setInterval(() => {
    autosaveToLocalStorage(getDoc())
    onSave?.()
  }, AUTOSAVE_INTERVAL_MS)
  return () => clearInterval(interval)
}
