/**
 * ProjectBrowser — modal para gestionar múltiples proyectos.
 *
 * Permite: listar proyectos, crear nuevo, renombrar, abrir, eliminar.
 * Cada proyecto tiene un documento asociado guardado en localStorage.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useDocumentStore, makeBlock } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { loadFontsForDocument } from '../../lib/fonts/fontLoader'
import { Button } from '../shared/Button'
import type { ProjectMeta } from '../../types/project'
import type { TibetanDocument } from '../../types/document'
import { DEFAULT_PAGE_SETTINGS } from '../../types/document'
import { v4 as uuid } from 'uuid'

const DOC_STORAGE_PREFIX = 'te:doc:'

function saveDocToStorage(doc: TibetanDocument) {
  try {
    localStorage.setItem(`${DOC_STORAGE_PREFIX}${doc.id}`, JSON.stringify(doc))
  } catch { /* quota */ }
}

function loadDocFromStorage(docId: string): TibetanDocument | null {
  try {
    const raw = localStorage.getItem(`${DOC_STORAGE_PREFIX}${docId}`)
    return raw ? JSON.parse(raw) as TibetanDocument : null
  } catch { return null }
}

function removeDocFromStorage(docId: string) {
  localStorage.removeItem(`${DOC_STORAGE_PREFIX}${docId}`)
}

function makeEmptyDoc(title: string): TibetanDocument {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    title,
    createdAt: now,
    updatedAt: now,
    pageSettings: { ...DEFAULT_PAGE_SETTINGS },
    fontRegistry: [],
    stylePresets: [],
    blocks: [makeBlock()],
  }
}

interface ProjectBrowserProps {
  onClose(): void
}

export function ProjectBrowser({ onClose }: ProjectBrowserProps) {
  const { projects, activeProjectId, createProject, updateProject, removeProject, setActiveProject } = useProjectStore()
  const doc = useDocumentStore(s => s.document)
  const loadDocument = useDocumentStore(s => s.loadDocument)
  const setDirty = useEditorStore(s => s.setDirty)

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Auto-save the current document to localStorage whenever this modal opens
  useEffect(() => {
    const activeProject = projects.find(p => p.id === activeProjectId)
    if (activeProject?.documentIds[0] === doc.id) {
      saveDocToStorage(doc)
    }
  }, [])

  const handleOpen = useCallback((project: ProjectMeta) => {
    if (project.id === activeProjectId) { onClose(); return }
    // Save current document first
    saveDocToStorage(doc)
    // Load the target project's primary document
    const docId = project.documentIds[0]
    const loaded = loadDocFromStorage(docId)
    if (loaded) {
      loadDocument(loaded)
      loadFontsForDocument().catch(() => {})
      setActiveProject(project.id)
      setDirty(false)
    } else {
      // If document not found locally, create a new empty one
      const emptyDoc = makeEmptyDoc(project.name)
      loadDocument(emptyDoc)
      setActiveProject(project.id)
      setDirty(false)
    }
    onClose()
  }, [activeProjectId, doc, loadDocument, setActiveProject, setDirty, onClose])

  const handleCreate = useCallback(() => {
    const name = newName.trim() || 'Nuevo proyecto'
    // Save current doc
    saveDocToStorage(doc)
    // Create new empty doc
    const emptyDoc = makeEmptyDoc(name)
    const newProject = createProject(name, emptyDoc.id)
    loadDocument(emptyDoc)
    setDirty(false)
    setNewName('')
    setActiveProject(newProject.id)
    onClose()
  }, [newName, doc, createProject, loadDocument, setDirty, setActiveProject, onClose])

  const handleDelete = useCallback((project: ProjectMeta) => {
    if (project.documentIds.length > 0) {
      project.documentIds.forEach(removeDocFromStorage)
    }
    removeProject(project.id)
    setConfirmDeleteId(null)
    // If we deleted the active project, open the first remaining one
    if (project.id === activeProjectId) {
      const remaining = projects.filter(p => p.id !== project.id)
      if (remaining.length > 0) {
        handleOpen(remaining[0])
      } else {
        // No projects left — create a default one
        const emptyDoc = makeEmptyDoc('Mi proyecto')
        loadDocument(emptyDoc)
        createProject('Mi proyecto', emptyDoc.id)
        setDirty(false)
        onClose()
      }
    }
  }, [activeProjectId, projects, removeProject, handleOpen, loadDocument, createProject, setDirty, onClose])

  const handleRename = useCallback((projectId: string) => {
    const name = editName.trim()
    if (name) updateProject(projectId, { name })
    setEditingId(null)
    setEditName('')
  }, [editName, updateProject])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">Proyectos</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
          {projects.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">No hay proyectos. Creá uno.</p>
          )}
          {projects.map(p => {
            const isActive = p.id === activeProjectId
            return (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors group',
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500/40'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600',
                ].join(' ')}
              >
                {editingId === p.id ? (
                  <input
                    autoFocus
                    className="flex-1 bg-slate-700 text-white text-sm px-2 py-0.5 rounded border border-slate-500 outline-none focus:border-indigo-400"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(p.id)
                      if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                    }}
                    onBlur={() => handleRename(p.id)}
                  />
                ) : (
                  <button
                    className="flex-1 text-left text-sm text-white font-medium truncate"
                    onClick={() => handleOpen(p)}
                  >
                    {p.name}
                    {isActive && <span className="ml-2 text-[10px] text-indigo-400 font-normal">activo</span>}
                  </button>
                )}

                <span className="text-[10px] text-slate-500 shrink-0">
                  {formatDate(p.updatedAt)}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    className="text-slate-500 hover:text-indigo-300 text-xs px-1 py-0.5 rounded hover:bg-slate-700 transition-colors"
                    title="Renombrar"
                    onClick={() => { setEditingId(p.id); setEditName(p.name) }}
                  >
                    ✎
                  </button>
                  {confirmDeleteId === p.id ? (
                    <>
                      <button
                        className="text-red-400 hover:text-red-300 text-xs px-1 py-0.5 rounded hover:bg-slate-700 transition-colors"
                        onClick={() => handleDelete(p)}
                      >
                        Borrar
                      </button>
                      <button
                        className="text-slate-500 hover:text-white text-xs px-1 py-0.5"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-slate-600 hover:text-red-400 text-xs px-1 py-0.5 rounded hover:bg-slate-700 transition-colors"
                      title="Eliminar proyecto"
                      onClick={() => setConfirmDeleteId(p.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Create new project */}
        <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
          <input
            className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 placeholder-slate-500 outline-none focus:border-indigo-400 transition-colors"
            placeholder="Nombre del nuevo proyecto…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
          <Button size="sm" variant="primary" onClick={handleCreate}>Crear</Button>
        </div>
      </div>
    </div>
  )
}
