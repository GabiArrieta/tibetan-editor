/**
 * fontLoader — loads fonts from IndexedDB and injects them into the DOM.
 *
 * For each FontEntry in a document's fontRegistry:
 * 1. Retrieve the ArrayBuffer from IndexedDB
 * 2. Create a Blob ObjectURL
 * 3. Inject a @font-face rule into a <style> element
 * 4. Register the LoadedFont in fontStore
 *
 * Also provides a utility to get the ObjectURL for PDF export.
 */

import { v4 as uuid } from 'uuid'
import type { FontEntry } from '../../types/document'
import type { LoadedFont } from '../../types/fonts'
import { getFontBinary, saveFontBinary } from './fontStorage'
import { validateFontFile, fontMimeType } from './fontValidation'
import { useFontStore } from '../../store/fontStore'
import { useDocumentStore } from '../../store/documentStore'

const FONT_STYLE_ELEMENT_ID = 'tibetan-editor-fonts'

function getOrCreateStyleElement(): HTMLStyleElement {
  let el = document.getElementById(FONT_STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = FONT_STYLE_ELEMENT_ID
    document.head.appendChild(el)
  }
  return el
}

/**
 * Inject a @font-face rule for a given font family and ObjectURL.
 */
function injectFontFace(family: string, objectUrl: string, format: string): void {
  const styleEl = getOrCreateStyleElement()
  const formatName = format === 'ttf' ? 'truetype'
    : format === 'otf' ? 'opentype'
    : format // woff, woff2 are used directly
  const rule = `@font-face { font-family: ${JSON.stringify(family)}; src: url(${JSON.stringify(objectUrl)}) format(${JSON.stringify(formatName)}); font-display: swap; }`
  styleEl.textContent += '\n' + rule
}

/**
 * Load a single FontEntry from IndexedDB and inject it into the DOM.
 * Returns the LoadedFont on success, or null if the binary is missing.
 */
export async function loadFont(entry: FontEntry): Promise<LoadedFont | null> {
  const buffer = await getFontBinary(entry.storageKey)
  if (!buffer) return null

  const mimeType = fontMimeType(entry.format)
  const blob = new Blob([buffer], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)

  injectFontFace(entry.family, objectUrl, entry.format)

  return {
    id: entry.id,
    family: entry.family,
    role: entry.role,
    objectUrl,
    injected: true,
  }
}

/**
 * Load all fonts in the document's fontRegistry.
 * Updates fontStore with results.
 */
export async function loadFontsForDocument(): Promise<void> {
  const { fontRegistry } = useDocumentStore.getState().document
  const { registerLoadedFont, addMissingFontId, setLoading, clear } = useFontStore.getState()

  clear()
  setLoading(true)

  await Promise.all(
    fontRegistry.map(async (entry) => {
      const loaded = await loadFont(entry)
      if (loaded) {
        registerLoadedFont(loaded)
      } else {
        addMissingFontId(entry.id)
      }
    })
  )

  setLoading(false)
}

/**
 * Handle a user-uploaded font file:
 * 1. Validate it
 * 2. Store the binary in IndexedDB
 * 3. Inject it into the DOM
 * 4. Return the data needed to create a FontEntry
 */
export async function handleFontUpload(
  file: File,
  role: FontEntry['role'],
  familyOverride?: string
): Promise<{ entry: FontEntry; objectUrl: string } | { error: string }> {
  const buffer = await file.arrayBuffer()
  const validation = validateFontFile(buffer, file.name)

  if (!validation.valid) {
    return { error: validation.error ?? 'Archivo de fuente inválido.' }
  }

  const format = validation.format!
  const storageKey = `font-${uuid()}`
  const family = familyOverride || file.name.replace(/\.[^/.]+$/, '')

  await saveFontBinary(storageKey, buffer)

  const entry: FontEntry = {
    id: uuid(),
    family,
    role,
    fileName: file.name,
    format,
    storageKey,
  }

  const loaded = await loadFont(entry)
  if (!loaded) return { error: 'No se pudo cargar la fuente después de guardarla.' }

  useFontStore.getState().registerLoadedFont(loaded)

  return { entry, objectUrl: loaded.objectUrl }
}

/**
 * Get the ObjectURL for a font, suitable for passing to @react-pdf/renderer.
 * Returns null if the font is not loaded.
 */
export function getFontObjectUrl(fontId: string): string | null {
  const { loadedFonts } = useFontStore.getState()
  return loadedFonts[fontId]?.objectUrl ?? null
}

/**
 * Remove a font: revoke its ObjectURL and remove from the DOM.
 * The binary deletion from IndexedDB is the caller's responsibility.
 */
export function unloadFont(fontId: string): void {
  useFontStore.getState().unregisterFont(fontId)
  // Rebuild the entire @font-face stylesheet to remove the revoked URL
  rebuildFontFaceStyles()
}

/**
 * Rebuild the @font-face stylesheet from currently loaded fonts.
 * Called after a font is removed.
 */
export function rebuildFontFaceStyles(): void {
  const styleEl = getOrCreateStyleElement()
  const { loadedFonts } = useFontStore.getState()
  const { fontRegistry } = useDocumentStore.getState().document

  let rules = ''
  for (const entry of fontRegistry) {
    const loaded = loadedFonts[entry.id]
    if (loaded?.injected) {
      const formatName = entry.format === 'ttf' ? 'truetype'
        : entry.format === 'otf' ? 'opentype'
        : entry.format
      rules += `\n@font-face { font-family: ${JSON.stringify(entry.family)}; src: url(${JSON.stringify(loaded.objectUrl)}) format(${JSON.stringify(formatName)}); font-display: swap; }`
    }
  }
  styleEl.textContent = rules
}
