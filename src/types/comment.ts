/**
 * Comment types — editorial annotation system.
 *
 * Comments are attached to a Row within a document. Text anchoring is
 * "best-effort": we store the anchor text and offset at creation time,
 * but if the row text changes significantly, the anchor becomes informational
 * rather than precisely re-locatable.
 *
 * This is an intentional trade-off: full range-based anchoring (like Google Docs)
 * requires a structured text model (Yjs / ProseMirror). For this editorial use case,
 * row-level anchoring is sufficient and far simpler to implement correctly.
 */

import type { LaneKey } from './document'

export type CommentStatus = 'open' | 'resolved'

export interface Comment {
  id: string
  documentId: string
  rowId: string
  /** If set, the comment targets a specific lane within the row */
  laneKey?: LaneKey
  /** Comment body text */
  body: string
  authorId?: string
  authorEmail?: string
  authorDisplayName?: string
  createdAt: string
  updatedAt: string
  status: CommentStatus
  resolvedAt?: string
  resolvedBy?: string
  /** Snapshot of the lane text at the time of comment creation (best-effort anchor) */
  anchorText?: string
  anchorOffset?: number
  anchorLength?: number
}

export interface CommentThread {
  /** The root comment */
  comment: Comment
  /** Replies to this comment (future: threaded comments) */
  replies: Comment[]
}

export function makeComment(
  params: Pick<Comment, 'documentId' | 'rowId'> & Partial<Comment>
): Comment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    status: 'open',
    body: '',
    createdAt: now,
    updatedAt: now,
    ...params,
  }
}
