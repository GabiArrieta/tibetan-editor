/**
 * cloudStore — estado UI de la sincronización con la nube.
 *
 * Gestiona:
 * - Estado del último guardado en nube
 * - Si el documento actual tiene una versión en la nube
 * - Modales abiertos (auth, browser, share)
 */

import { create } from 'zustand'

export type CloudSyncStatus = 'idle' | 'saving' | 'saved' | 'error'

interface CloudStore {
  // Estado de sync
  syncStatus: CloudSyncStatus
  lastCloudSave: string | null       // ISO timestamp
  cloudDocumentId: string | null     // ID del documento en la nube

  // Modales
  authModalOpen: boolean
  documentBrowserOpen: boolean

  // Actions
  setSyncStatus(status: CloudSyncStatus): void
  setLastCloudSave(timestamp: string, docId: string): void
  setCloudDocumentId(id: string | null): void
  setAuthModalOpen(open: boolean): void
  setDocumentBrowserOpen(open: boolean): void
  reset(): void
}

export const useCloudStore = create<CloudStore>((set) => ({
  syncStatus: 'idle',
  lastCloudSave: null,
  cloudDocumentId: null,
  authModalOpen: false,
  documentBrowserOpen: false,

  setSyncStatus: (status) => set({ syncStatus: status }),

  setLastCloudSave: (timestamp, docId) => set({
    lastCloudSave: timestamp,
    cloudDocumentId: docId,
    syncStatus: 'saved',
  }),

  setCloudDocumentId: (id) => set({ cloudDocumentId: id }),

  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  setDocumentBrowserOpen: (open) => set({ documentBrowserOpen: open }),

  reset: () => set({
    syncStatus: 'idle',
    lastCloudSave: null,
    cloudDocumentId: null,
  }),
}))
