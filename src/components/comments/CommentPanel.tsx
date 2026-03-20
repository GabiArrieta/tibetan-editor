/**
 * CommentPanel — panel lateral para ver y gestionar comentarios del documento.
 *
 * Se muestra como un drawer a la derecha del canvas.
 * Permite: ver todos los comentarios, filtrar por estado, resolver, eliminar.
 */

import React, { useState, useCallback } from 'react'
import { useCommentStore } from '../../store/commentStore'
import { useAuthStore } from '../../store/authStore'
import type { Comment } from '../../types/comment'

interface CommentPanelProps {
  documentId: string
  onSelectRow?: (blockId: string | null, rowId: string) => void
}

type Filter = 'all' | 'open' | 'resolved'

export function CommentPanel({ documentId, onSelectRow }: CommentPanelProps) {
  const { getForDocument, setStatus, deleteComment, editComment } = useCommentStore()
  const user = useAuthStore(s => s.user)

  const [filter, setFilter] = useState<Filter>('open')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const all = getForDocument(documentId)
  const visible = all.filter(c => {
    if (filter === 'open') return c.status === 'open'
    if (filter === 'resolved') return c.status === 'resolved'
    return true
  })

  const openCount = all.filter(c => c.status === 'open').length

  const handleResolve = useCallback((c: Comment) => {
    setStatus(documentId, c.id, 'resolved', user?.id)
  }, [documentId, setStatus, user])

  const handleReopen = useCallback((c: Comment) => {
    setStatus(documentId, c.id, 'open')
  }, [documentId, setStatus])

  const handleDelete = useCallback((c: Comment) => {
    deleteComment(documentId, c.id)
  }, [documentId, deleteComment])

  const handleSaveEdit = useCallback((commentId: string) => {
    if (editBody.trim()) editComment(documentId, commentId, editBody.trim())
    setEditingId(null)
    setEditBody('')
  }, [documentId, editComment, editBody])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700/50">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-700/50 flex items-center justify-between shrink-0">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
          Comentarios
          {openCount > 0 && (
            <span className="ml-1.5 bg-amber-500 text-black text-[9px] font-bold rounded-full px-1.5 py-px">
              {openCount}
            </span>
          )}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex px-2 py-1.5 gap-1 shrink-0 border-b border-slate-700/30">
        {(['open', 'resolved', 'all'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'text-[10px] px-2 py-0.5 rounded transition-colors',
              filter === f
                ? 'bg-indigo-600/40 text-indigo-300'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {f === 'open' ? 'Abiertos' : f === 'resolved' ? 'Resueltos' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {visible.length === 0 && (
          <p className="text-[11px] text-slate-600 text-center py-8 px-3">
            {filter === 'open' ? 'No hay comentarios abiertos.' : 'No hay comentarios.'}
          </p>
        )}
        {visible.map(c => (
          <div
            key={c.id}
            className={[
              'mx-2 my-1.5 p-2.5 rounded-lg border text-xs group',
              c.status === 'resolved'
                ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
                : 'bg-slate-800/70 border-slate-700/50',
            ].join(' ')}
          >
            {/* Row link */}
            <button
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors mb-1 truncate w-full text-left"
              onClick={() => onSelectRow?.(null, c.rowId)}
              title="Ir a la fila"
            >
              fila: {c.rowId.slice(0, 8)}…
              {c.laneKey && <span className="ml-1 text-slate-500">({c.laneKey})</span>}
            </button>

            {/* Anchor text preview */}
            {c.anchorText && (
              <p className="text-[10px] text-slate-500 italic mb-1 truncate" title={c.anchorText}>
                "{c.anchorText.slice(0, 40)}{c.anchorText.length > 40 ? '…' : ''}"
              </p>
            )}

            {/* Body */}
            {editingId === c.id ? (
              <div className="space-y-1">
                <textarea
                  autoFocus
                  className="w-full bg-slate-700 border border-slate-500 rounded text-xs text-white p-1.5 resize-none outline-none focus:border-indigo-400"
                  rows={3}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.metaKey) handleSaveEdit(c.id)
                    if (e.key === 'Escape') { setEditingId(null); setEditBody('') }
                  }}
                />
                <div className="flex gap-1">
                  <button
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    onClick={() => handleSaveEdit(c.id)}
                  >
                    Guardar
                  </button>
                  <button
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                    onClick={() => { setEditingId(null); setEditBody('') }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
            )}

            {/* Meta + actions */}
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-600">
                {c.authorDisplayName ?? c.authorEmail ?? 'Anónimo'} · {formatDate(c.createdAt)}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {c.status === 'open' ? (
                  <>
                    {editingId !== c.id && (
                      <button
                        className="text-[10px] text-slate-500 hover:text-indigo-300"
                        onClick={() => { setEditingId(c.id); setEditBody(c.body) }}
                        title="Editar"
                      >
                        ✎
                      </button>
                    )}
                    <button
                      className="text-[10px] text-slate-500 hover:text-green-400"
                      onClick={() => handleResolve(c)}
                      title="Marcar como resuelto"
                    >
                      ✓
                    </button>
                  </>
                ) : (
                  <button
                    className="text-[10px] text-slate-500 hover:text-amber-400"
                    onClick={() => handleReopen(c)}
                    title="Reabrir"
                  >
                    ↩
                  </button>
                )}
                <button
                  className="text-[10px] text-slate-600 hover:text-red-400"
                  onClick={() => handleDelete(c)}
                  title="Eliminar comentario"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
