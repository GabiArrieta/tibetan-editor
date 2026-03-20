/**
 * AddCommentDialog — pequeño dialog para agregar un comentario a una fila.
 *
 * Aparece como un popover inline al hacer click en el botón de comentario de una fila.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useCommentStore } from '../../store/commentStore'
import { useAuthStore } from '../../store/authStore'
import type { LaneKey } from '../../types/document'

interface AddCommentDialogProps {
  documentId: string
  rowId: string
  laneKey?: LaneKey
  anchorText?: string
  onClose(): void
}

export function AddCommentDialog({ documentId, rowId, laneKey, anchorText, onClose }: AddCommentDialogProps) {
  const addComment = useCommentStore(s => s.addComment)
  const setPanelOpen = useCommentStore(s => s.setPanelOpen)
  const user = useAuthStore(s => s.user)
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim()
    if (!trimmed) return
    addComment({
      documentId,
      rowId,
      laneKey,
      body: trimmed,
      authorId: user?.id,
      authorEmail: user?.email ?? undefined,
      anchorText,
    })
    setPanelOpen(true)
    onClose()
  }, [body, documentId, rowId, laneKey, anchorText, user, addComment, setPanelOpen, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 w-80"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-white">Agregar comentario</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
        </div>

        {anchorText && (
          <p className="text-[11px] text-slate-400 italic mb-2 truncate border-l-2 border-indigo-500/50 pl-2">
            "{anchorText.slice(0, 50)}{anchorText.length > 50 ? '…' : ''}"
          </p>
        )}

        <textarea
          ref={textareaRef}
          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 resize-none outline-none focus:border-indigo-400 transition-colors placeholder-slate-500"
          rows={3}
          placeholder="Escribí tu comentario…"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            if (e.key === 'Escape') onClose()
          }}
        />
        <p className="text-[10px] text-slate-600 mt-1 mb-3">Ctrl/⌘+Enter para enviar · Esc para cancelar</p>

        <div className="flex justify-end gap-2">
          <button
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
            disabled={!body.trim()}
            onClick={handleSubmit}
          >
            Comentar
          </button>
        </div>
      </div>
    </div>
  )
}
