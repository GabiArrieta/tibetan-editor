/**
 * AppShell — layout principal de la aplicación.
 *
 * Inicializa: autenticación, fuentes, autosave, atajos de teclado.
 * Monta: TopBar, sidebars, canvas, modales (import, auth, cloud browser).
 */

import React, { useEffect } from 'react'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightPanel } from './RightPanel'
import { DocumentCanvas } from '../canvas/DocumentCanvas'
import { ImportAssistant } from '../import/ImportAssistant'
import { AuthModal } from '../auth/AuthModal'
import { DocumentBrowser } from '../cloud/DocumentBrowser'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { useAuthStore } from '../../store/authStore'
import { useCloudStore } from '../../store/cloudStore'
import { loadFontsForDocument } from '../../lib/fonts/fontLoader'
import { startAutosave, loadAutosave } from '../../lib/persistence/projectIO'
import { isSupabaseConfigured } from '../../lib/supabase/client'

export function AppShell() {
  const doc = useDocumentStore(s => s.document)
  const loadDocument = useDocumentStore(s => s.loadDocument)
  const setDirty = useEditorStore(s => s.setDirty)

  const initializeAuth = useAuthStore(s => s.initialize)

  const authModalOpen = useCloudStore(s => s.authModalOpen)
  const setAuthModalOpen = useCloudStore(s => s.setAuthModalOpen)
  const documentBrowserOpen = useCloudStore(s => s.documentBrowserOpen)
  const setDocumentBrowserOpen = useCloudStore(s => s.setDocumentBrowserOpen)
  const resetCloudStore = useCloudStore(s => s.reset)

  useKeyboardShortcuts()

  // Inicializar autenticación Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const unsubscribe = initializeAuth()
    return unsubscribe
  }, [])

  // Comprobar autosave al iniciar
  useEffect(() => {
    const autosaved = loadAutosave()
    if (autosaved) {
      const raw = localStorage.getItem('tibetan-editor:autosave')
      const savedAt = raw ? JSON.parse(raw).savedAt : null
      if (savedAt && confirm(
        `Se encontró un autoguardado del ${new Date(savedAt).toLocaleString()}.\n¿Restaurar?`
      )) {
        loadDocument(autosaved)
      }
    }
  }, [])

  // Cargar fuentes cuando cambia el documento
  useEffect(() => {
    if (doc.fontRegistry.length > 0) {
      loadFontsForDocument()
    }
    // Resetear estado de nube cuando cambia el documento raíz
    resetCloudStore()
  }, [doc.id])

  // Autosave cada 30 segundos
  useEffect(() => {
    const stop = startAutosave(() => useDocumentStore.getState().document)
    return stop
  }, [])

  // Marcar dirty en cambios de contenido
  useEffect(() => {
    setDirty(true)
  }, [doc.blocks, doc.title, doc.pageSettings])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      <TopBar />

      <div className="flex flex-1 min-h-0">
        <LeftSidebar />
        <DocumentCanvas />
        <RightPanel />
      </div>

      {/* Modales */}
      <ImportAssistant />

      {authModalOpen && (
        <AuthModal onClose={() => setAuthModalOpen(false)} />
      )}

      {documentBrowserOpen && (
        <DocumentBrowser onClose={() => setDocumentBrowserOpen(false)} />
      )}
    </div>
  )
}
