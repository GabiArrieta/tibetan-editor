/**
 * projectStore — multi-project management.
 *
 * Tracks the list of known projects (local only, not the document content).
 * Each project is a lightweight metadata record pointing to one or more document IDs.
 *
 * Local persistence: the project list is saved to localStorage.
 * The document content for each project lives in documentStore (in memory) and
 * is saved separately to localStorage or Supabase as a full TibetanDocument.
 */

import { create } from 'zustand'
import type { ProjectMeta } from '../types/project'
import { makeProjectMeta } from '../types/project'

const STORAGE_KEY = 'te:projects'

function loadFromStorage(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ProjectMeta[]
  } catch {
    return []
  }
}

function saveToStorage(projects: ProjectMeta[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch {
    // Quota exceeded — fail silently, user still has the in-memory state
  }
}

interface ProjectStore {
  projects: ProjectMeta[]
  activeProjectId: string | null

  /** Initialize from localStorage on app start */
  initialize(primaryDocumentId: string): void

  /** Create a new project associated with a document id */
  createProject(name: string, documentId: string): ProjectMeta

  /** Update project metadata */
  updateProject(projectId: string, patch: Partial<Pick<ProjectMeta, 'name' | 'description' | 'cloudId'>>): void

  /** Link a cloud document ID to a project */
  setCloudId(projectId: string, cloudId: string): void

  /** Set the active (currently open) project */
  setActiveProject(projectId: string): void

  /** Remove a project from the list (does not delete its document content) */
  removeProject(projectId: string): void

  /** Associate a document ID with a project */
  addDocumentToProject(projectId: string, documentId: string): void

  /** Get the active project metadata, or null */
  getActiveProject(): ProjectMeta | null
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,

  initialize: (primaryDocumentId: string) => {
    const stored = loadFromStorage()
    if (stored.length === 0) {
      // First run — create a default project for the initial document
      const initial = makeProjectMeta('Mi primer proyecto', primaryDocumentId)
      set({ projects: [initial], activeProjectId: initial.id })
      saveToStorage([initial])
    } else {
      // Verify the primary document is covered by at least one project
      const covered = stored.some(p => p.documentIds.includes(primaryDocumentId))
      if (!covered) {
        const initial = makeProjectMeta('Proyecto actual', primaryDocumentId)
        const updated = [initial, ...stored]
        set({ projects: updated, activeProjectId: initial.id })
        saveToStorage(updated)
      } else {
        const activeId = stored.find(p => p.documentIds.includes(primaryDocumentId))?.id ?? stored[0].id
        set({ projects: stored, activeProjectId: activeId })
      }
    }
  },

  createProject: (name, documentId) => {
    const meta = makeProjectMeta(name, documentId)
    set(state => {
      const updated = [...state.projects, meta]
      saveToStorage(updated)
      return { projects: updated, activeProjectId: meta.id }
    })
    return meta
  },

  updateProject: (projectId, patch) => {
    set(state => {
      const updated = state.projects.map(p =>
        p.id === projectId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      )
      saveToStorage(updated)
      return { projects: updated }
    })
  },

  setCloudId: (projectId, cloudId) => {
    set(state => {
      const updated = state.projects.map(p =>
        p.id === projectId ? { ...p, cloudId, updatedAt: new Date().toISOString() } : p
      )
      saveToStorage(updated)
      return { projects: updated }
    })
  },

  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId })
  },

  removeProject: (projectId) => {
    set(state => {
      const updated = state.projects.filter(p => p.id !== projectId)
      saveToStorage(updated)
      const newActive = state.activeProjectId === projectId
        ? (updated[0]?.id ?? null)
        : state.activeProjectId
      return { projects: updated, activeProjectId: newActive }
    })
  },

  addDocumentToProject: (projectId, documentId) => {
    set(state => {
      const updated = state.projects.map(p => {
        if (p.id !== projectId) return p
        if (p.documentIds.includes(documentId)) return p
        return { ...p, documentIds: [...p.documentIds, documentId], updatedAt: new Date().toISOString() }
      })
      saveToStorage(updated)
      return { projects: updated }
    })
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find(p => p.id === activeProjectId) ?? null
  },
}))
