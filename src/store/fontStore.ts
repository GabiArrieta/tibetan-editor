/**
 * fontStore — runtime font state.
 *
 * Tracks which fonts have been loaded from IndexedDB, their active ObjectURLs,
 * and which fonts are missing from storage (requiring user re-upload).
 *
 * This store is NOT persisted to JSON. It is rebuilt on app load by
 * fontLoader.loadFontsForDocument().
 */

import { create } from 'zustand'
import type { FontStoreState, LoadedFont } from '../types/fonts'

interface FontStore extends FontStoreState {
  registerLoadedFont(font: LoadedFont): void
  unregisterFont(fontId: string): void
  setMissingFontIds(ids: string[]): void
  addMissingFontId(id: string): void
  setLoading(loading: boolean): void
  clear(): void
}

export const useFontStore = create<FontStore>((set, get) => ({
  loadedFonts: {},
  missingFontIds: [],
  loading: false,

  registerLoadedFont: (font) => set(state => ({
    loadedFonts: { ...state.loadedFonts, [font.id]: font },
    missingFontIds: state.missingFontIds.filter(id => id !== font.id),
  })),

  unregisterFont: (fontId) => {
    const existing = get().loadedFonts[fontId]
    if (existing?.objectUrl) {
      URL.revokeObjectURL(existing.objectUrl)
    }
    set(state => {
      const next = { ...state.loadedFonts }
      delete next[fontId]
      return { loadedFonts: next }
    })
  },

  setMissingFontIds: (ids) => set({ missingFontIds: ids }),

  addMissingFontId: (id) => set(state => ({
    missingFontIds: state.missingFontIds.includes(id)
      ? state.missingFontIds
      : [...state.missingFontIds, id],
  })),

  setLoading: (loading) => set({ loading }),

  clear: () => {
    // Revoke all active ObjectURLs before clearing
    const fonts = get().loadedFonts
    Object.values(fonts).forEach(f => {
      if (f.objectUrl) URL.revokeObjectURL(f.objectUrl)
    })
    set({ loadedFonts: {}, missingFontIds: [], loading: false })
  },
}))
