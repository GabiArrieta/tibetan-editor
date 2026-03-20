/**
 * AppShell — layout principal de la aplicación.
 *
 * Inicializa: autenticación, fuentes, autosave, atajos de teclado, proyectos, comentarios.
 * Monta: TopBar, sidebars, canvas, modales (import, auth, cloud browser, project browser).
 */

import React, { useEffect, useState, useCallback } from 'react'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightPanel } from './RightPanel'
import { DocumentCanvas } from '../canvas/DocumentCanvas'
import { ImportAssistant } from '../import/ImportAssistant'
import { AuthModal } from '../auth/AuthModal'
import { DocumentBrowser } from '../cloud/DocumentBrowser'
import { ProjectBrowser } from '../projects/ProjectBrowser'
import { CommentPanel } from '../comments/CommentPanel'
import { AddCommentDialog } from '../comments/AddCommentDialog'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { useCloudStore } from '../../store/cloudStore'
import { useProjectStore } from '../../store/projectStore'
import { useCommentStore } from '../../store/commentStore'
import { loadFontsForDocument } from '../../lib/fonts/fontLoader'
import { startAutosave, loadAutosave } from '../../lib/persistence/projectIO'

export function AppShell() {
  const doc = useDocumentStore(s => s.document)
  const loadDocument = useDocumentStore(s => s.loadDocument)
  const setDirty = useEditorStore(s => s.setDirty)
  const selectRow = useEditorStore(s => s.selectRow)

  const authModalOpen = useCloudStore(s => s.authModalOpen)
  const setAuthModalOpen = useCloudStore(s => s.setAuthModalOpen)
  const documentBrowserOpen = useCloudStore(s => s.documentBrowserOpen)
  const setDocumentBrowserOpen = useCloudStore(s => s.setDocumentBrowserOpen)
  const resetCloudStore = useCloudStore(s => s.reset)

  const initializeProjects = useProjectStore(s => s.initialize)
  const addDocumentToProject = useProjectStore(s => s.addDocumentToProject)
  const activeProjectId = useProjectStore(s => s.activeProjectId)

  const loadComments = useCommentStore(s => s.loadForDocument)
  const commentPanelOpen = useCommentStore(s => s.panelOpen)

  const [projectBrowserOpen, setProjectBrowserOpen] = useState(false)
  const [addCommentState, setAddCommentState] = useState<{ rowId: string; documentId: string } | null>(null)

  useKeyboardShortcuts()

  // Listen for add-comment events from canvas
  useEffect(() => {
    const handler = (e: Event) => {
      const { rowId, documentId } = (e as CustomEvent).detail as { rowId: string; documentId: string }
      setAddCommentState({ rowId, documentId })
    }
    window.addEventListener('te:add-comment', handler)
    return () => window.removeEventListener('te:add-comment', handler)
  }, [])

  // Inicializar proyectos con el documento actual
  useEffect(() => {
    initializeProjects(doc.id)
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

  // Cargar fuentes y comentarios cuando cambia el documento
  useEffect(() => {
    if (doc.fontRegistry.length > 0) {
      loadFontsForDocument()
    }
    resetCloudStore()
    loadComments(doc.id)
    // Link doc to active project if not already linked
    if (activeProjectId) {
      const state = useProjectStore.getState()
      const project = state.projects.find(p => p.id === activeProjectId)
      if (project && !project.documentIds.includes(doc.id)) {
        addDocumentToProject(activeProjectId, doc.id)
      }
    }
  }, [doc.id])

  // Autosave cada 30 segundos
  useEffect(() => {
    const stop = startAutosave(() => useDocumentStore.getState().document)
    return stop
  }, [])

  // Marcar dirty en cambios de contenido (skip on initial load)
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!initialized) { setInitialized(true); return }
    setDirty(true)
  }, [doc.blocks, doc.title, doc.pageSettings])

  const handleSelectRow = useCallback((blockId: string | null, rowId: string) => {
    if (!blockId) {
      // Try to find blockId from the document
      const block = doc.blocks.find(b => b.rows.some(r => r.id === rowId))
      if (block) selectRow({ blockId: block.id, rowId })
    } else {
      selectRow({ blockId, rowId })
    }
  }, [doc.blocks, selectRow])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      <TopBar onOpenProjectBrowser={() => setProjectBrowserOpen(true)} />

      <div className="flex flex-1 min-h-0">
        <LeftSidebar />
        <DocumentCanvas />
        {commentPanelOpen ? (
          <div className="w-60 shrink-0">
            <CommentPanel
              documentId={doc.id}
              onSelectRow={handleSelectRow}
            />
          </div>
        ) : (
          <RightPanel />
        )}
      </div>

      {/* Modales */}
      <ImportAssistant />

      {authModalOpen && (
        <AuthModal onClose={() => setAuthModalOpen(false)} />
      )}

      {documentBrowserOpen && (
        <DocumentBrowser onClose={() => setDocumentBrowserOpen(false)} />
      )}

      {projectBrowserOpen && (
        <ProjectBrowser onClose={() => setProjectBrowserOpen(false)} />
      )}

      {addCommentState && (
        <AddCommentDialog
          documentId={addCommentState.documentId}
          rowId={addCommentState.rowId}
          onClose={() => setAddCommentState(null)}
        />
      )}
    </div>
  )
}
