/**
 * documentStore — the authoritative source of truth for the document content.
 *
 * Uses Zustand with Immer middleware so deep mutations are handled safely.
 * This store is serialised to JSON for save/load.
 */

import { create } from 'zustand'
import { useStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import { v4 as uuid } from 'uuid'

// ---------------------------------------------------------------------------
// Debounce helper — avoids an extra dependency just for this
// ---------------------------------------------------------------------------

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: TArgs) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { fn(...args); timer = null }, ms)
  }
}
import type {
  TibetanDocument,
  Block,
  BlockType,
  Row,
  Lane,
  LaneKey,
  TextStyle,
  RowLayout,
  BlockLayout,
  FontEntry,
  StylePreset,
  PageSettings,
  SpecialPageData,
  CoverPageData,
  BackPageData,
} from '../types/document'
import {
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_TIBETAN_STYLE,
  DEFAULT_PHONETIC_STYLE,
  DEFAULT_TRANSLATION_STYLE,
  DEFAULT_ROW_LAYOUT,
  DEFAULT_BLOCK_LAYOUT,
  DEFAULT_COVER_DATA,
  DEFAULT_BACK_DATA,
} from '../types/document'

// Re-export so callers can import helpers without touching the types barrel
export type { BlockType, SpecialPageData, CoverPageData, BackPageData }

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
    blockType: 'content',
    label: undefined,
    rows: [makeRow()],
    layout: { ...DEFAULT_BLOCK_LAYOUT },
    ...overrides,
  }
}

export function makeCoverBlock(): Block {
  return {
    id: uuid(),
    blockType: 'cover',
    label: 'Portada',
    rows: [],
    layout: { ...DEFAULT_BLOCK_LAYOUT },
    special: { type: 'cover', cover: { ...DEFAULT_COVER_DATA } },
  }
}

export function makeBackBlock(): Block {
  return {
    id: uuid(),
    blockType: 'back',
    label: 'Página final',
    rows: [],
    layout: { ...DEFAULT_BLOCK_LAYOUT },
    special: { type: 'back', back: { ...DEFAULT_BACK_DATA } },
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
  addCoverBlock(): void
  addBackBlock(): void
  removeBlock(blockId: string): void
  updateBlockLayout(blockId: string, patch: Partial<BlockLayout>): void
  updateBlockLabel(blockId: string, label: string): void
  updateBlockType(blockId: string, blockType: BlockType): void
  updateSpecialData(blockId: string, special: SpecialPageData): void
  moveBlock(blockId: string, direction: 'up' | 'down'): void

  // Row operations
  addRowToBlock(blockId: string): void
  addRowAfter(blockId: string, rowId: string): void
  removeRow(blockId: string, rowId: string): void
  duplicateRow(blockId: string, rowId: string): void
  moveRow(blockId: string, rowId: string, direction: 'up' | 'down'): void
  splitRow(blockId: string, rowId: string, lane: LaneKey, cursorOffset: number): void
  mergeRowWithNext(blockId: string, rowId: string): void
  /**
   * Merge this row's lane texts onto the previous row, then delete this row.
   * Used by the Backspace-at-start handler in LaneEditor.
   * No-op if rowId is already the first row in the block.
   */
  mergeRowWithPrev(blockId: string, rowId: string): void
  /**
   * Distribute multiple lines of text across consecutive rows starting from rowId.
   *
   * - lines[0] → replaces the current row's lane text (at cursor position,
   *   inserting before the existing text after the cursor)
   * - lines[1..N] → N new rows inserted after the current row, each receiving
   *   one line. The other two lanes in the new rows inherit styles but are empty.
   *
   * Returns the ID of the last row in the sequence so the caller can focus it.
   */
  insertRowsAfterFromLines(
    blockId: string,
    rowId: string,
    lane: LaneKey,
    cursorOffset: number,
    lines: string[]
  ): string | null
  /**
   * Distribute multiple lines across ALL rows of the document starting from
   * (blockId, rowId), crossing block boundaries.
   *
   * - lines[0] → current row's lane (merged with text before cursor)
   * - lines[1] → next row in the document (next block's first row if needed)
   * - lines[N] → N-th row after start; new blocks are created for overflow
   *
   * Returns the id of the last row that received text (for focus management).
   */
  distributeLaneAcrossRows(
    blockId: string,
    rowId: string,
    lane: LaneKey,
    cursorOffset: number,
    lines: string[]
  ): string | null
  updateRowLayout(blockId: string, rowId: string, patch: Partial<RowLayout>): void

  // Lane operations
  updateLaneText(blockId: string, rowId: string, lane: LaneKey, text: string): void
  updateLaneStyle(blockId: string, rowId: string, lane: LaneKey, patch: Partial<TextStyle>): void

  // Comment refs on rows (commentIds are managed by commentStore; rows only carry IDs)
  addCommentIdToRow(blockId: string, rowId: string, commentId: string): void
  removeCommentIdFromRow(blockId: string, rowId: string, commentId: string): void
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
  temporal(
  immer((set, get) => ({
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

    addCoverBlock: () => set(state => {
      const hasCover = state.document.blocks.some(b => b.blockType === 'cover')
      if (!hasCover) state.document.blocks.unshift(makeCoverBlock())
    }),

    addBackBlock: () => set(state => {
      const hasBack = state.document.blocks.some(b => b.blockType === 'back')
      if (!hasBack) state.document.blocks.push(makeBackBlock())
    }),

    removeBlock: (blockId) => set(state => {
      const isContent = (b: Block) => !b.blockType || b.blockType === 'content'
      const contentBlocks = state.document.blocks.filter(isContent)
      const block = state.document.blocks.find(b => b.id === blockId)
      if (block && isContent(block) && contentBlocks.length <= 1) return
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

    updateBlockType: (blockId, blockType) => set(state => {
      const b = findBlock(state.document, blockId)
      if (b) b.blockType = blockType
    }),

    updateSpecialData: (blockId, special) => set(state => {
      const b = findBlock(state.document, blockId)
      if (b) b.special = special
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

    mergeRowWithPrev: (blockId, rowId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const idx = b.rows.findIndex(r => r.id === rowId)
      // No previous row — nothing to do
      if (idx <= 0) return
      const prev = b.rows[idx - 1]
      const current = b.rows[idx]

      // Append each lane's text onto the previous row
      ;(['tibetan', 'phonetic', 'translation'] as LaneKey[]).forEach(lane => {
        prev[lane].text = prev[lane].text + current[lane].text
      })

      b.rows.splice(idx, 1)
    }),

    insertRowsAfterFromLines: (blockId, rowId, lane, cursorOffset, lines) => {
      if (!lines.length) return null

      // Pre-compute UUIDs before entering the immer set() so we can return
      // the last row's ID to the caller for focus management.
      const extraRowIds: string[] = lines.slice(1).map(() => uuid())

      set(state => {
        const b = findBlock(state.document, blockId)
        if (!b) return
        const idx = b.rows.findIndex(r => r.id === rowId)
        if (idx < 0) return
        const currentRow = b.rows[idx]

        // The text before the cursor stays in the current row's lane,
        // with lines[0] appended. Text after the cursor goes to the LAST new row.
        const textBeforeCursor = currentRow[lane].text.slice(0, cursorOffset)
        const textAfterCursor  = currentRow[lane].text.slice(cursorOffset)

        currentRow[lane].text = textBeforeCursor + lines[0]

        // Build new rows for lines[1..N-1], and append textAfterCursor to the last one
        const newRows = lines.slice(1).map((lineText, i) => {
          const newRow = makeRow()
          newRow.id = extraRowIds[i]
          const isLast = i === lines.length - 2
          newRow[lane].text = isLast ? lineText + textAfterCursor : lineText
          newRow[lane].style = { ...currentRow[lane].style }
          newRow.layout = { ...currentRow.layout }
          return newRow
        })

        b.rows.splice(idx + 1, 0, ...newRows)
      })

      // Return the ID of the last row so the caller can focus it
      return extraRowIds.length > 0
        ? extraRowIds[extraRowIds.length - 1]
        : rowId
    },

    distributeLaneAcrossRows: (blockId, rowId, lane, cursorOffset, lines) => {
      if (!lines.length) return null

      // Read current state to know existing row order before mutating
      const currentDoc = get().document
      const allRowRefs: Array<{ blockId: string; rowId: string }> = []
      currentDoc.blocks.forEach(b => {
        if (!b.blockType || b.blockType === 'content') {
          b.rows.forEach(r => allRowRefs.push({ blockId: b.id, rowId: r.id }))
        }
      })

      const startIdx = allRowRefs.findIndex(r => r.blockId === blockId && r.rowId === rowId)
      if (startIdx < 0) return null

      // Pre-generate IDs for any new blocks we'll need to create
      const existingAvailable = allRowRefs.length - startIdx
      const newBlocksNeeded = Math.max(0, lines.length - existingAvailable)
      const newBlockData = Array.from({ length: newBlocksNeeded }, () => ({
        blockId: uuid(),
        rowId: uuid(),
      }))

      set(state => {
        const doc = state.document

        // Rebuild flat row refs inside immer draft (same order)
        const draftRefs: Array<{ blockId: string; rowId: string }> = []
        doc.blocks.forEach(b => {
          if (!b.blockType || b.blockType === 'content') {
            b.rows.forEach(r => draftRefs.push({ blockId: b.id, rowId: r.id }))
          }
        })

        const draftStart = draftRefs.findIndex(r => r.blockId === blockId && r.rowId === rowId)
        if (draftStart < 0) return

        const startBlock = findBlock(doc, blockId)
        const startRow = startBlock ? findRow(startBlock, rowId) : undefined
        if (!startRow) return

        const textBefore = startRow[lane].text.slice(0, cursorOffset)
        const textAfter  = startRow[lane].text.slice(cursorOffset)

        for (let i = 0; i < lines.length; i++) {
          const isLast = i === lines.length - 1
          const lineText = (i === 0 ? textBefore : '') + lines[i] + (isLast ? textAfter : '')
          const targetIdx = draftStart + i

          if (targetIdx < draftRefs.length) {
            // Fill existing row in whichever block it lives
            const ref = draftRefs[targetIdx]
            const b = findBlock(doc, ref.blockId)
            const r = b ? findRow(b, ref.rowId) : undefined
            if (r) r[lane].text = lineText
          } else {
            // Create a new block with one row for this line
            const extra = newBlockData[targetIdx - draftRefs.length]
            const newRow = makeRow()
            newRow.id = extra.rowId
            newRow[lane].text = lineText
            newRow[lane].style = { ...startRow[lane].style }
            newRow.layout = { ...startRow.layout }
            const newBlock = makeBlock()
            newBlock.id = extra.blockId
            newBlock.rows = [newRow]
            // Insert before any non-content tail blocks (back page, etc.)
            const lastContentIdx = doc.blocks
              .map((b, bi) => ({ b, bi }))
              .filter(({ b }) => !b.blockType || b.blockType === 'content')
              .pop()?.bi ?? doc.blocks.length - 1
            doc.blocks.splice(lastContentIdx + 1, 0, newBlock)
            // Keep draftRefs in sync for subsequent iterations
            draftRefs.push({ blockId: extra.blockId, rowId: extra.rowId })
          }
        }
      })

      // Return last row ID for focus
      const lastIdx = startIdx + lines.length - 1
      if (lastIdx < allRowRefs.length) return allRowRefs[lastIdx].rowId
      if (newBlockData.length > 0) return newBlockData[newBlockData.length - 1].rowId
      return rowId
    },

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

    // Comment refs

    addCommentIdToRow: (blockId, rowId, commentId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const r = findRow(b, rowId)
      if (!r) return
      if (!r.commentIds) r.commentIds = []
      if (!r.commentIds.includes(commentId)) r.commentIds.push(commentId)
    }),

    removeCommentIdFromRow: (blockId, rowId, commentId) => set(state => {
      const b = findBlock(state.document, blockId)
      if (!b) return
      const r = findRow(b, rowId)
      if (r?.commentIds) {
        r.commentIds = r.commentIds.filter(id => id !== commentId)
      }
    }),
  })),
  {
    // Only snapshot the document content, not UI-related store slices
    partialize: (state) => ({ document: state.document }),
    // Debounce 1 s so continuous typing collapses into a single undo step
    handleSet: (handleSet) => debounce(handleSet, 1000),
    // Keep up to 100 history entries
    limit: 100,
  }
  )
)

// ---------------------------------------------------------------------------
// Convenience hook — undo / redo with reactive enabled-state
// Each selector returns a primitive so React's Object.is comparison is stable.
// ---------------------------------------------------------------------------

export function useDocumentHistory() {
  const undo    = useStore(useDocumentStore.temporal, s => s.undo)
  const redo    = useStore(useDocumentStore.temporal, s => s.redo)
  const canUndo = useStore(useDocumentStore.temporal, s => s.pastStates.length > 0)
  const canRedo = useStore(useDocumentStore.temporal, s => s.futureStates.length > 0)
  return { undo, redo, canUndo, canRedo }
}
