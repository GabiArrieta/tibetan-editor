/**
 * fontValidation — basic font file validation.
 *
 * Checks magic bytes to verify the file is actually a font before storing it.
 * Does NOT do full font parsing — that would require a full font library.
 */

import type { FontValidationResult } from '../../types/fonts'
import type { FontFormat } from '../../types/document'

// Magic bytes for common font formats
const MAGIC = {
  // TTF: starts with 0x00 0x01 0x00 0x00 or sfnt version bytes
  ttf: [[0x00, 0x01, 0x00, 0x00], [0x74, 0x72, 0x75, 0x65]], // true
  // OTF: starts with 'OTTO' (0x4F 0x54 0x54 0x4F)
  otf: [[0x4F, 0x54, 0x54, 0x4F]],
  // WOFF: starts with 'wOFF' (0x77 0x4F 0x46 0x46)
  woff: [[0x77, 0x4F, 0x46, 0x46]],
  // WOFF2: starts with 'wOF2' (0x77 0x4F 0x46 0x32)
  woff2: [[0x77, 0x4F, 0x46, 0x32]],
}

function matchesMagic(bytes: Uint8Array, magic: number[][]): boolean {
  return magic.some(pattern =>
    pattern.every((byte, i) => bytes[i] === byte)
  )
}

export function validateFontFile(
  buffer: ArrayBuffer,
  fileName: string
): FontValidationResult {
  if (buffer.byteLength < 4) {
    return { valid: false, error: 'El archivo es demasiado pequeño para ser una fuente válida.' }
  }

  const bytes = new Uint8Array(buffer.slice(0, 4))
  const ext = fileName.toLowerCase().split('.').pop() ?? ''

  // Try to detect format from magic bytes first
  if (matchesMagic(bytes, MAGIC.woff2)) {
    return { valid: true, format: 'woff2' }
  }
  if (matchesMagic(bytes, MAGIC.woff)) {
    return { valid: true, format: 'woff' }
  }
  if (matchesMagic(bytes, MAGIC.otf)) {
    return { valid: true, format: 'otf' }
  }
  if (matchesMagic(bytes, MAGIC.ttf)) {
    return { valid: true, format: 'ttf' }
  }

  // Fall back to extension heuristic (some tools write non-standard headers)
  const extFormats: Record<string, FontFormat> = {
    ttf: 'ttf', otf: 'otf', woff: 'woff', woff2: 'woff2',
  }
  if (ext in extFormats) {
    return {
      valid: true,
      format: extFormats[ext],
    }
  }

  return {
    valid: false,
    error: `Formato no reconocido. Se aceptan: .ttf, .otf, .woff, .woff2. (Cabecera: ${
      Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })`,
  }
}

/**
 * Returns the MIME type string for a given font format.
 * Used when creating Blob ObjectURLs.
 */
export function fontMimeType(format: string): string {
  const map: Record<string, string> = {
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
  }
  return map[format] ?? 'font/ttf'
}
