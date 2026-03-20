/**
 * importParser — bulk text import assistant logic.
 *
 * Given three raw pasted text blocks (one per lane), splits them by line
 * and builds an array of Row candidates. Detects imbalances and fills
 * missing entries with empty strings.
 */

import { v4 as uuid } from 'uuid'
import type { Row } from '../../types/document'
import {
  DEFAULT_TIBETAN_STYLE,
  DEFAULT_PHONETIC_STYLE,
  DEFAULT_TRANSLATION_STYLE,
  DEFAULT_ROW_LAYOUT,
} from '../../types/document'

export interface ImportInput {
  tibetan: string
  phonetic: string
  translation: string
}

export interface ImportPreviewRow {
  tibetan: string
  phonetic: string
  translation: string
  /** True if one or more lanes are empty due to line-count imbalance */
  hasImbalance: boolean
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[]
  /** True if the three blocks had different line counts */
  hasImbalance: boolean
  counts: { tibetan: number; phonetic: number; translation: number }
}

/**
 * Split a raw text block by newlines, normalising Unicode and trimming
 * trailing whitespace per line. Empty trailing lines are removed.
 */
function splitLines(text: string): string[] {
  return text
    .normalize('NFC')
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    // Remove completely empty trailing lines
    .reduce<string[]>((acc, line, i, arr) => {
      if (line.length > 0 || i < arr.length - 1) acc.push(line)
      return acc
    }, [])
}

/**
 * Normalise clipboard text pasted from Word/Google Docs:
 * - Strip zero-width spaces (U+200B, U+FEFF)
 * - Normalise curly quotes to straight equivalents (optional, user-facing)
 * - NFC normalisation
 */
export function normaliseClipboardText(text: string): string {
  return text
    .replace(/[\u200B\uFEFF]/g, '')
    .normalize('NFC')
}

/**
 * Build a preview from three raw text blocks.
 * This is called before the user confirms the import.
 */
export function buildImportPreview(input: ImportInput): ImportPreviewResult {
  const tibetanLines = splitLines(normaliseClipboardText(input.tibetan))
  const phoneticLines = splitLines(normaliseClipboardText(input.phonetic))
  const translationLines = splitLines(normaliseClipboardText(input.translation))

  const counts = {
    tibetan: tibetanLines.length,
    phonetic: phoneticLines.length,
    translation: translationLines.length,
  }

  const maxLines = Math.max(counts.tibetan, counts.phonetic, counts.translation)
  const hasImbalance = counts.tibetan !== counts.phonetic ||
    counts.phonetic !== counts.translation

  const rows: ImportPreviewRow[] = []
  for (let i = 0; i < maxLines; i++) {
    const t = tibetanLines[i] ?? ''
    const p = phoneticLines[i] ?? ''
    const tr = translationLines[i] ?? ''
    rows.push({
      tibetan: t,
      phonetic: p,
      translation: tr,
      hasImbalance: (i >= counts.tibetan) || (i >= counts.phonetic) || (i >= counts.translation),
    })
  }

  return { rows, hasImbalance, counts }
}

/**
 * Convert confirmed import preview rows to Row objects ready to insert.
 */
export function previewToRows(preview: ImportPreviewRow[]): Row[] {
  return preview.map(p => ({
    id: uuid(),
    tibetan: {
      text: p.tibetan,
      style: { ...DEFAULT_TIBETAN_STYLE },
    },
    phonetic: {
      text: p.phonetic,
      style: { ...DEFAULT_PHONETIC_STYLE },
    },
    translation: {
      text: p.translation,
      style: { ...DEFAULT_TRANSLATION_STYLE },
    },
    layout: { ...DEFAULT_ROW_LAYOUT },
  }))
}
