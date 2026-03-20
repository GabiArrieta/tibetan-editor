/**
 * editorStore — ephemeral UI and editor state.
 *
 * This store is NOT persisted to JSON. It holds selection state, zoom level,
 * modal visibility, and the result of the pagination engine.
 */

import { create } from 'zustand'
import type { EditorState, RowSelection, LaneSelection, RightPanelTab, PaginationResult } from '../types/editor'
import { DEFAULT_EDITOR_STATE } from '../types/editor'

interface EditorStore extends EditorState {
  selectRow(selection: RowSelection | null): void
  setFocusedLane(selection: LaneSelection | null): void
  setZoom(zoom: number): void
  setImportAssistantOpen(open: boolean): void
  setFontManagerOpen(open: boolean): void
  setRightPanelTab(tab: RightPanelTab): void
  setPagination(result: PaginationResult): void
  setDirty(dirty: boolean): void
}

export const useEditorStore = create<EditorStore>((set) => ({
  ...DEFAULT_EDITOR_STATE,

  selectRow: (selection) => set({ selectedRow: selection }),

  setFocusedLane: (selection) => set({ focusedLane: selection }),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(3, zoom)) }),

  setImportAssistantOpen: (open) => set({ importAssistantOpen: open }),

  setFontManagerOpen: (open) => set({ fontManagerOpen: open }),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  setPagination: (result) => set({ pagination: result }),

  setDirty: (dirty) => set({ isDirty: dirty }),
}))
