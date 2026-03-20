/**
 * commentStore — gestión de comentarios editoriales.
 *
 * Los comentarios son independientes del document store.
 * Se persisten localmente en localStorage y opcionalmente en Supabase.
 *
 * La asociación con el documento se hace a través de:
 *   - comment.documentId
 *   - comment.rowId
 *   - comment.laneKey (opcional)
 */

import { create } from 'zustand'
import { makeComment } from '../types/comment'
import type { Comment, CommentStatus } from '../types/comment'
import type { LaneKey } from '../types/document'
import { isSupabaseConfigured, supabase } from '../lib/supabase/client'

const STORAGE_PREFIX = 'te:comments:'

function loadFromStorage(documentId: string): Comment[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentId}`)
    return raw ? (JSON.parse(raw) as Comment[]) : []
  } catch { return [] }
}

function saveToStorage(documentId: string, comments: Comment[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${documentId}`, JSON.stringify(comments))
  } catch { /* quota */ }
}

interface AddCommentParams {
  documentId: string
  rowId: string
  laneKey?: LaneKey
  body: string
  authorId?: string
  authorEmail?: string
  authorDisplayName?: string
  anchorText?: string
  anchorOffset?: number
  anchorLength?: number
}

interface CommentStore {
  /** All loaded comments, keyed by document id then comment id */
  commentsByDoc: Record<string, Comment[]>
  panelOpen: boolean

  /** Load comments for a document from localStorage */
  loadForDocument(documentId: string): void

  /** Add a new comment */
  addComment(params: AddCommentParams): Comment

  /** Update comment body */
  editComment(documentId: string, commentId: string, body: string): void

  /** Resolve or reopen a comment */
  setStatus(documentId: string, commentId: string, status: CommentStatus, resolvedBy?: string): void

  /** Delete a comment */
  deleteComment(documentId: string, commentId: string): void

  /** Get all comments for a document */
  getForDocument(documentId: string): Comment[]

  /** Get comments for a specific row */
  getForRow(documentId: string, rowId: string): Comment[]

  /** Count open comments for a row */
  openCountForRow(documentId: string, rowId: string): number

  /** Sync comments to Supabase (best-effort, does not block UI) */
  syncToCloud(documentId: string): Promise<void>

  /** Load comments from Supabase for a document */
  loadFromCloud(documentId: string): Promise<void>

  setPanelOpen(open: boolean): void
}

export const useCommentStore = create<CommentStore>((set, get) => ({
  commentsByDoc: {},
  panelOpen: false,

  loadForDocument: (documentId) => {
    const existing = get().commentsByDoc[documentId]
    if (existing) return // already loaded
    const comments = loadFromStorage(documentId)
    set(state => ({
      commentsByDoc: { ...state.commentsByDoc, [documentId]: comments },
    }))
  },

  addComment: (params) => {
    const comment = makeComment(params)
    set(state => {
      const existing = state.commentsByDoc[params.documentId] ?? []
      const updated = [...existing, comment]
      saveToStorage(params.documentId, updated)
      return {
        commentsByDoc: { ...state.commentsByDoc, [params.documentId]: updated },
      }
    })
    return comment
  },

  editComment: (documentId, commentId, body) => {
    set(state => {
      const list = state.commentsByDoc[documentId] ?? []
      const updated = list.map(c =>
        c.id === commentId ? { ...c, body, updatedAt: new Date().toISOString() } : c
      )
      saveToStorage(documentId, updated)
      return { commentsByDoc: { ...state.commentsByDoc, [documentId]: updated } }
    })
  },

  setStatus: (documentId, commentId, status, resolvedBy) => {
    set(state => {
      const list = state.commentsByDoc[documentId] ?? []
      const now = new Date().toISOString()
      const updated = list.map(c =>
        c.id === commentId
          ? {
              ...c,
              status,
              updatedAt: now,
              resolvedAt: status === 'resolved' ? now : undefined,
              resolvedBy: status === 'resolved' ? resolvedBy : undefined,
            }
          : c
      )
      saveToStorage(documentId, updated)
      return { commentsByDoc: { ...state.commentsByDoc, [documentId]: updated } }
    })
  },

  deleteComment: (documentId, commentId) => {
    set(state => {
      const list = state.commentsByDoc[documentId] ?? []
      const updated = list.filter(c => c.id !== commentId)
      saveToStorage(documentId, updated)
      return { commentsByDoc: { ...state.commentsByDoc, [documentId]: updated } }
    })
  },

  getForDocument: (documentId) => get().commentsByDoc[documentId] ?? [],

  getForRow: (documentId, rowId) =>
    (get().commentsByDoc[documentId] ?? []).filter(c => c.rowId === rowId),

  openCountForRow: (documentId, rowId) =>
    (get().commentsByDoc[documentId] ?? []).filter(c => c.rowId === rowId && c.status === 'open').length,

  syncToCloud: async (documentId) => {
    if (!isSupabaseConfigured || !supabase) return
    const comments = get().commentsByDoc[documentId] ?? []
    if (comments.length === 0) return
    try {
      // Upsert all comments for this document
      await supabase.from('comments').upsert(
        comments.map(c => ({
          id: c.id,
          document_id: c.documentId,
          row_id: c.rowId,
          lane_key: c.laneKey ?? null,
          body: c.body,
          status: c.status,
          anchor_text: c.anchorText ?? null,
          anchor_offset: c.anchorOffset ?? null,
          anchor_length: c.anchorLength ?? null,
          resolved_at: c.resolvedAt ?? null,
          resolved_by: c.resolvedBy ?? null,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        })),
        { onConflict: 'id' }
      )
    } catch { /* fail silently — local state is the source of truth */ }
  },

  loadFromCloud: async (documentId) => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true })
      if (error || !data) return
      const comments: Comment[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        documentId: row.document_id as string,
        rowId: row.row_id as string,
        laneKey: (row.lane_key as LaneKey | null) ?? undefined,
        body: row.body as string,
        status: row.status as CommentStatus,
        anchorText: (row.anchor_text as string | null) ?? undefined,
        anchorOffset: (row.anchor_offset as number | null) ?? undefined,
        anchorLength: (row.anchor_length as number | null) ?? undefined,
        resolvedAt: (row.resolved_at as string | null) ?? undefined,
        resolvedBy: (row.resolved_by as string | null) ?? undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }))
      saveToStorage(documentId, comments)
      set(state => ({
        commentsByDoc: { ...state.commentsByDoc, [documentId]: comments },
      }))
    } catch { /* fail silently */ }
  },

  setPanelOpen: (open) => set({ panelOpen: open }),
}))
