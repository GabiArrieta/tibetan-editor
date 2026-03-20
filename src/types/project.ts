/**
 * Project types — multi-project management.
 *
 * A Project is a named container that holds one or more TibetanDocuments.
 * In the initial implementation, most projects have a single document.
 * The model supports multiple documents per project for future use (e.g. chapters).
 */

export interface ProjectMeta {
  id: string
  name: string
  description?: string
  /** ISO timestamp */
  createdAt: string
  /** ISO timestamp */
  updatedAt: string
  /**
   * Ordered list of document IDs belonging to this project.
   * The first document is the primary / active one.
   */
  documentIds: string[]
  /** Supabase document ID currently synced to the cloud, if any */
  cloudId?: string
}

/**
 * Full local project snapshot including all documents.
 * Used for local save/load (.tibproj files).
 */
export interface LocalProject {
  version: 2
  meta: ProjectMeta
  /** Keyed by document id */
  documents: Record<string, import('./document').TibetanDocument>
}

export function makeProjectMeta(name: string, primaryDocumentId: string): ProjectMeta {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    documentIds: [primaryDocumentId],
  }
}
