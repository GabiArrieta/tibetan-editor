/**
 * documentStore — the authoritative source of truth for the document content.
 *
 * Uses Zustand with Immer middleware so deep mutations are handled safely.
 * This store is serialised to JSON for save/load.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type {
  TibetanDocument,
  Block,
  Row,
  Lane,
  LaneKey,
  TextStyle,
  RowLayout,
  BlockLayout,
  FontEntry,
  StylePreset,
  PageSettings,
} from '../types/document'
import {
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_TIBETAN_STYLE,
  DEFAULT_PHONETIC_STYLE,
  DEFAULT_TRANSLATION_STYLE,
  DEFAULT_ROW_LAYOUT,
  DEFAULT_BLOCK_LAYOUT,
} from '../types/document'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makeEmptyLane(style: TextStyle): Lane {
  return { text: '', style: { ...style } }
}

export function makeRow(overrides?: Partial<Row>): Row {
  return {
    id: uuid(),
    tibetan: makeEmptyLane(DEFAULT_TIBETAN_STYLE),
    phonetic: makeEmptyLane(DEFAULT_PHONETIC_STYLE),
    translation: makeEmptyLane(DEFAULT_TRANSLATION_STYLE),
    layout: { ...DEFAULT_ROW_LAYOUT },
    ...overrides,
  }
}

export function makeBlock(overrides?: Partial<Block>): Block {
  return {
    id: uuid(),
    label: undefined,
    rows: [makeRow()],
    layout: { ...DEFAULT_BLOCK_LAYOUT },
    ...overrides,
  }
}

function makeNewDocument(): TibetanDocument {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    title: 'Nuevo documento',
    createdAt: now,
    updatedAt: now,
    pageSettings: { ...DEFAULT_PAGE_SETTINGS },
    fontRegistry: [],
    stylePresets: [],
    blocks: [makeBlock()],
  }
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface DocumentStore {
  document: TibetanDocument

  // Document-level
  setTitle(title: string): void
  setPageSettings(settings: Partial<PageSettings>): void
  loadDocument(doc: TibetanDocument): void
  newDocument(): void

  // Font registry
  addFont(entry: FontEntry): void
  removeFont(fontId: string): void
  updateFont(fontId: string, patch: Partial<FontEntry>): void

  // Style presets
  addStylePreset(preset: StylePreset): void
  removeStylePreset(presetId: string): void

  // Block operations
  addBlock(): void
  removeBlock(blockId: string): void
  updateBlockLayout(blockId: string, patch: Partial<BlockLayout>): void
  updateBlockLabel(blockId: string, label: string): void
  moveBlock(blockId: string, direction: 'up' | 'down'): void

  // Row operations
  addRowToBlock(blockId: string): void
  addRowAfter(blockId: string, rowId: string): void
  removeRow(blockId: string, rowId: string): void
  duplicateRow(blockId: string, rowId: string): void
  moveRow(blockId: string, rowId: string, direction: 'up' | 'down'): void
  splitRow(blockId: string, rowId: string, lane: LaneKey, cursorOffset: number): void
  mergeRowWithNext(blockId: string, rowId: string): void
  updateRowLayout(blockId: string, rowId: string, patch: Partial<RowLayout>): void

  // Lane operations
  updateLaneText(blockId: string, rowId: string, lane: LaneKey, text: string): void
  updateLaneStyle(blockId: string, rowId: string, lane: LaneKey, patch: Partial<TextStyle>): void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

function findBlock(doc: TibetanDocument, blockId: string): Block | undefined {
  return doc.blocks.find(b => b.id === blockId)
}

function findRow(block: Block, rowId: string): Row | undefined {
  return block.rows.find(r => r.id === rowId)
}

export const useDocumentStore = create<DocumentStore>()(
  immer((set) => ({
    document: makeNewDocument(),

    setTitle: (title) => set(state => { state.document.title = title }),

    setPageSettings: (settings) => set(state => {
      Object.assign(state.document.pageSettings, settings)
    }),

    loadDocument: (doc) => set(state => { state.document = doc }),

    newDocument: () => set(state => { state.document = makeNewDocument() }),

    // Font registry

    addFont: (entry) => set(state => { state.document.fontRegistry.push(entry) }),

    removeFont: (fontId) => set(state => {
      state.document.fontRegistry = state.document.fontRegistry.filter(f => f.id !== fontId)
    }),

    updateFont: (fontId, patch) => set(state => {
      const f = state.document.fontRegistry.find(f => f.id === fontId)
      if (f) Object.assign(f, patch)
    }),

    // Style presets

    addStylePreset: (preset) => set(state => { state.document.stylePresets.push(preset) }),

    removeStylePreset: (presetId) => set(state => {
      state.document.stylePresets = state.document.stylePresets.filter(p => p.id !== presetId)
    }),

    // Block operations

    addBlock: () => set(state => { state.document.blocks.push(makeBlock()) }),

    removeBlock: (blockId) => set(state => {
      if (state.document.blocks.length <= 1) return
      state.document.blocks = state.document.blocks.filter(b => b.id !== blockId)
    }),

    updateBlockLayout: (blockId, patch) => set(state => {
      const b = findBlock(state.document, blockId)
      if (b) Object.assign(b.layout, patch)
    }),

    updateBlockLabel: (blockId, label) => set(state => {
      const b = findBlock(state.document, blockId)
      if (b) b.label = label
    }),

    moveBlock: (blockId, direction) => set(state => {
      const blocks = state.document.blocks
      const idx = blocks.findIndex(b => b.id === blockId)
      if (idx < 0) return
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= blocks.length) return
      const [block] = blocks.splice(idx, 1)
      blocks.splice(targetIdx, 0, block)
    }),

    // Row operations

    addRowToBlock: (blockId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (b) b.rows.push(makeRow())
    }),

    addRowAfter: (blockId, rowId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const idx = b.rows.findIndex(r => r.id === rowId)
      const newRow = makeRow()
      b.rows.splice(idx + 1, 0, newRow)
    }),

    removeRow: (blockId, rowId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b || b.rows.length <= 1) return
      b.rows = b.rows.filter(r => r.id !== rowId)
    }),

    duplicateRow: (blockId, rowId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const idx = b.rows.findIndex(r => r.id === rowId)
      if (idx < 0) return
      const source = b.rows[idx]
      const duplicate: Row = {
        ...structuredClone(source as unknown as object) as Row,
        id: uuid(),
      }
      b.rows.splice(idx + 1, 0, duplicate)
    }),

    moveRow: (blockId, rowId, direction) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const idx = b.rows.findIndex(r => r.id === rowId)
      if (idx < 0) return
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= b.rows.length) return
      const [row] = b.rows.splice(idx, 1)
      b.rows.splice(targetIdx, 0, row)
    }),

    splitRow: (blockId, rowId, lane, cursorOffset) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const idx = b.rows.findIndex(r => r.id === rowId)
      if (idx < 0) return
      const row = b.rows[idx]

      const before = row[lane].text.slice(0, cursorOffset)
      const after = row[lane].text.slice(cursorOffset)

      // Mutate in place for the "before" part
      row[lane].text = before

      // New row gets the "after" part in the split lane; other lanes stay empty
      const newRow = makeRow()
      newRow[lane].text = after
      newRow[lane].style = { ...row[lane].style }
      newRow.layout = { ...row.layout }

      b.rows.splice(idx + 1, 0, newRow)
    }),

    mergeRowWithNext: (blockId, rowId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const idx = b.rows.findIndex(r => r.id === rowId)
      if (idx < 0 || idx >= b.rows.length - 1) return
      const current = b.rows[idx]
      const next = b.rows[idx + 1]

      // Concatenate each lane's text
      ;(['tibetan', 'phonetic', 'translation'] as LaneKey[]).forEach(lane => {
        current[lane].text = current[lane].text + next[lane].text
      })

      b.rows.splice(idx + 1, 1)
    }),

    updateRowLayout: (blockId, rowId, patch) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const r = findRow(b, rowId)
      if (r) Object.assign(r.layout, patch)
    }),

    // Lane operations

    updateLaneText: (blockId, rowId, lane, text) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const r = findRow(b, rowId)
      if (r) r[lane].text = text
    }),

    updateLaneStyle: (blockId, rowId, lane, patch) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const r = findRow(b, rowId)
      if (r) Object.assign(r[lane].style, patch)
    }),
  }))
)
