/**
 * Runtime font types used by fontStore and fontLoader.
 * These are ephemeral runtime values — not persisted to the project JSON.
 * The project JSON stores FontEntry (from document.ts) with only metadata.
 */

import type { FontRole } from './document'

// ---------------------------------------------------------------------------
// Loaded font — a font whose binary has been retrieved from IndexedDB
// and whose ObjectURL has been injected into the DOM via @font-face.
// ---------------------------------------------------------------------------

export interface LoadedFont {
  /** Matches FontEntry.id */
  id: string
  /** CSS font-family name */
  family: string
  role: FontRole
  /**
   * Object URL pointing to the font binary blob.
   * Created via URL.createObjectURL() after loading from IndexedDB.
   * Must be revoked when the font is removed to avoid memory leaks.
   */
  objectUrl: string
  /** Whether this font has been successfully injected into the DOM */
  injected: boolean
}

// ---------------------------------------------------------------------------
// Font upload result — returned after validating and storing a new font file
// ---------------------------------------------------------------------------

export interface FontUploadResult {
  success: boolean
  storageKey?: string
  family?: string
  format?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Font validation result
// ---------------------------------------------------------------------------

export interface FontValidationResult {
  valid: boolean
  format?: 'ttf' | 'woff' | 'woff2' | 'otf'
  error?: string
}

// ---------------------------------------------------------------------------
// Font store state
// ---------------------------------------------------------------------------

export interface FontStoreState {
  /** Map from FontEntry.id to its runtime LoadedFont */
  loadedFonts: Record<string, LoadedFont>
  /** IDs of fonts whose binaries were not found in IndexedDB */
  missingFontIds: string[]
  /** Whether fonts are currently being loaded */
  loading: boolean
}
