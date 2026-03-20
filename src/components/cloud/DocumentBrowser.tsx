/**
 * DocumentBrowser — lista de documentos guardados en la nube.
 *
 * Muestra todos los documentos del usuario (propios + compartidos).
 * Permite abrir, eliminar, compartir y ver fecha de actualización.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { useAuthStore } from '../../store/authStore'
import { useEditorStore } from '../../store/editorStore'
import {
  listCloudDocuments,
  loadDocumentFromCloud,
  deleteCloudDocument,
  shareDocument,
  listCollaborators,
  removeCollaborator,
} from '../../lib/supabase/cloudSync'
import type { AccessibleDocument, DbCollaborator } from '../../lib/supabase/client'
import { Button } from '../shared/Button'

interface DocumentBrowserProps {
  onClose(): void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: 'bg-indigo-600/40 text-indigo-300',
    editor: 'bg-emerald-700/40 text-emerald-300',
    viewer: 'bg-slate-600/40 text-slate-300',
  }
  const labels: Record<string, string> = { owner: 'Tuyo', editor: 'Editor', viewer: 'Lector' }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[role] ?? 'bg-slate-700'}`}>
      {labels[role] ?? role}
    </span>
  )
}

export function DocumentBrowser({ onClose }: DocumentBrowserProps) {
  const loadDocument = useDocumentStore(s => s.loadDocument)
  const setDirty = useEditorStore(s => s.setDirty)
  const user = useAuthStore(s => s.user)

  const [docs, setDocs] = useState<AccessibleDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  // Share panel state
  const [shareDocId, setShareDocId] = useState<string | null>(null)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<DbCollaborator[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listCloudDocuments()
    if (result.error) setError(result.error)
    else setDocs(result.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleOpen = async (docId: string) => {
    setOpening(docId)
    const result = await loadDocumentFromCloud(docId)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      loadDocument(result.data)
      setDirty(false)
      onClose()
    }
    setOpening(null)
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('¿Eliminar este documento de la nube? Esta acción no se puede deshacer.')) return
    setDeleting(docId)
    const result = await deleteCloudDocument(docId)
    if (result.error) setError(result.error)
    else setDocs(prev => prev.filter(d => d.id !== docId))
    setDeleting(null)
  }

  const openSharePanel = async (docId: string) => {
    setShareDocId(docId)
    setShareEmail('')
    setShareError(null)
    const result = await listCollaborators(docId)
    setCollaborators(result.data ?? [])
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareDocId) return
    setShareLoading(true)
    setShareError(null)
    const result = await shareDocument(shareDocId, shareEmail, shareRole)
    if (result.error) {
      setShareError(result.error)
    } else {
      setShareEmail('')
      const updated = await listCollaborators(shareDocId)
      setCollaborators(updated.data ?? [])
    }
    setShareLoading(false)
  }

  const handleRemoveCollaborator = async (userId: string) => {
    if (!shareDocId) return
    await removeCollaborator(shareDocId, userId)
    const updated = await listCollaborators(shareDocId)
    setCollaborators(updated.data ?? [])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-[680px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-white font-semibold text-base">Documentos en la nube</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              {loading ? '…' : '↻ Actualizar'}
            </Button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Document list */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded px-3 py-2 mb-3">
                {error}
              </p>
            )}

            {loading ? (
              <div className="text-center text-slate-500 py-12 text-sm">Cargando…</div>
            ) : docs.length === 0 ? (
              <div className="text-center text-slate-500 py-12 text-sm">
                No hay documentos en la nube todavía.<br />
                Usá "Guardar en nube" para subir tu documento actual.
              </div>
            ) : (
              <div className="space-y-1.5">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className={[
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      shareDocId === doc.id
                        ? 'bg-indigo-900/20 border-indigo-600/50'
                        : 'bg-slate-700/40 border-slate-600/40 hover:border-slate-500/60',
                    ].join(' ')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{doc.title}</p>
                        <RoleBadge role={doc.access_role} />
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Actualizado: {formatDate(doc.updated_at)}
                        {doc.collaborator_count > 0 && (
                          <span className="ml-2 text-slate-600">· {doc.collaborator_count} colaborador(es)</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleOpen(doc.id)}
                        disabled={opening === doc.id}
                      >
                        {opening === doc.id ? '…' : 'Abrir'}
                      </Button>
                      {doc.access_role === 'owner' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openSharePanel(doc.id)}
                            title="Compartir"
                          >
                            Compartir
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            title="Eliminar"
                          >
                            {deleting === doc.id ? '…' : '×'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share panel */}
          {shareDocId && (
            <div className="w-64 border-l border-slate-700 p-4 shrink-0 flex flex-col gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Compartir</h3>
                <button onClick={() => setShareDocId(null)} className="text-slate-500 hover:text-white text-sm">×</button>
              </div>

              <form onSubmit={handleShare} className="space-y-2">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="email del colaborador"
                  required
                  className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600 focus:border-indigo-400 outline-none"
                />
                <select
                  value={shareRole}
                  onChange={e => setShareRole(e.target.value as 'editor' | 'viewer')}
                  className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600 outline-none"
                >
                  <option value="editor">Puede editar</option>
                  <option value="viewer">Solo lectura</option>
                </select>
                {shareError && <p className="text-red-400 text-[11px]">{shareError}</p>}
                <Button variant="primary" size="sm" type="submit" disabled={shareLoading} className="w-full justify-center">
                  {shareLoading ? '…' : 'Invitar'}
                </Button>
              </form>

              {collaborators.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">Accesos actuales</p>
                  <div className="space-y-1">
                    {collaborators.map(c => (
                      <div key={c.user_id} className="flex items-center justify-between bg-slate-700/50 rounded px-2 py-1">
                        <div>
                          <p className="text-[11px] text-slate-300 truncate max-w-[130px]">{c.user_id.slice(0, 8)}…</p>
                          <p className="text-[10px] text-slate-500">{c.role}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveCollaborator(c.user_id)}
                          className="text-red-500 hover:text-red-400 text-[11px]"
                          title="Quitar acceso"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-600 leading-relaxed">
                El colaborador debe tener una cuenta en la app para poder acceder.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
