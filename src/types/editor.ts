/**
 * Editor UI state types.
 * These are ephemeral — they live in editorStore and are NOT persisted to JSON.
 */

import type { LaneKey } from './document'

// ---------------------------------------------------------------------------
// Selection model
// ---------------------------------------------------------------------------

export interface RowSelection {
  blockId: string
  rowId: string
}

export interface LaneSelection {
  blockId: string
  rowId: string
  lane: LaneKey
}

// ---------------------------------------------------------------------------
// Pagination result
// Computed by paginationEngine and stored in editorStore.
// ---------------------------------------------------------------------------

export interface PageBreak {
  /** Index into the flat list of [blockIdx, rowIdx] where a new page starts */
  blockIdx: number
  rowIdx: number
}

export interface PaginationResult {
  /** Total number of pages */
  pageCount: number
  /** Array of (blockIdx, rowIdx) pairs marking the start of each page after page 1 */
  pageBreaks: PageBreak[]
}

// ---------------------------------------------------------------------------
// Right panel tabs
// ---------------------------------------------------------------------------

export type RightPanelTab = 'row' | 'document' | 'fonts'

// ---------------------------------------------------------------------------
// Editor store state
// ---------------------------------------------------------------------------

export interface EditorState {
  /** Currently selected row (for property panel) */
  selectedRow: RowSelection | null
  /** Currently focused lane (for keyboard shortcuts context) */
  focusedLane: LaneSelection | null
  /** Canvas zoom level (1.0 = 100%) */
  zoom: number
  /** Whether the import assistant modal is open */
  importAssistantOpen: boolean
  /** Whether the font manager panel is visible */
  fontManagerOpen: boolean
  /** Active right panel tab */
  rightPanelTab: RightPanelTab
  /** Result of the last pagination calculation */
  pagination: PaginationResult
  /** Whether the document has unsaved changes */
  isDirty: boolean
}

export const DEFAULT_EDITOR_STATE: EditorState = {
  selectedRow: null,
  focusedLane: null,
  zoom: 1.0,
  importAssistantOpen: false,
  fontManagerOpen: false,
  rightPanelTab: 'row',
  pagination: { pageCount: 1, pageBreaks: [] },
  isDirty: false,
}
