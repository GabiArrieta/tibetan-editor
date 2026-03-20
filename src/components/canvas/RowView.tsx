/**
 * RowView — renders one synchronised row (tibetan + phonetic + translation).
 *
 * Each lane is an independent LaneEditor. The row has a unique DOM id used by
 * paginationEngine to measure its height.
 *
 * Visual layout:
 *   ┌──────────────────────────────────────┐
 *   │  [Tibetan lane]                      │
 *   │  [gap]                               │
 *   │  [Phonetic lane]                     │
 *   │  [gap]                               │
 *   │  [Translation lane]                  │
 *   └──────────────────────────────────────┘
 */

import React, { useCallback } from 'react'
import type { Row } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { LaneEditor } from './LaneEditor'

interface RowViewProps {
  blockId: string
  row: Row
  isSelected: boolean
  /** Number of open comments on this row */
  commentCount?: number
  onAddComment?: (rowId: string) => void
}

const PT_TO_PX = 1.3333 // 1pt ≈ 1.333px at 96dpi

/** Focus a specific lane by querying the DOM using data-attributes on the lane-editor element itself */
function focusLane(blockId: string, rowId: string, lane: string) {
  const el = document.querySelector<HTMLElement>(
    `.lane-editor[data-block-id="${blockId}"][data-row-id="${rowId}"][data-lane="${lane}"]`
  )
  el?.focus()
}

export const RowView = React.memo(function RowView({
  blockId,
  row,
  isSelected,
  commentCount = 0,
  onAddComment,
}: RowViewProps) {
  const splitRow = useDocumentStore(s => s.splitRow)
  const setFocusedLane = useEditorStore(s => s.setFocusedLane)

  const { layout } = row

  const rowStyle: React.CSSProperties = {
    marginTop: `${layout.marginTopPt * PT_TO_PX}px`,
    marginBottom: `${layout.marginBottomPt * PT_TO_PX}px`,
    paddingLeft: `${(layout.paddingLeftPt + layout.indentationPt) * PT_TO_PX}px`,
    paddingRight: `${layout.paddingRightPt * PT_TO_PX}px`,
    transform: layout.offsetXPt || layout.offsetYPt
      ? `translate(${layout.offsetXPt * PT_TO_PX}px, ${layout.offsetYPt * PT_TO_PX}px)`
      : undefined,
    textAlign: layout.alignment,
    width: layout.widthOverridePt ? `${layout.widthOverridePt * PT_TO_PX}px` : undefined,
  }

  const handleSplit = useCallback((lane: 'tibetan' | 'phonetic' | 'translation', offset: number) => {
    splitRow(blockId, row.id, lane, offset)
    // After the store mutation, the new row is at index (currentRowIndex + 1).
    // We retrieve it from the store and focus its matching lane.
    requestAnimationFrame(() => {
      const state = useDocumentStore.getState()
      const block = state.document.blocks.find(b => b.id === blockId)
      if (!block) return
      const rowIdx = block.rows.findIndex(r => r.id === row.id)
      const newRow = block.rows[rowIdx + 1]
      if (!newRow) return
      focusLane(blockId, newRow.id, lane)
    })
  }, [blockId, row.id, splitRow])

  const handleNavigate = useCallback((lane: 'tibetan' | 'phonetic' | 'translation', direction: 'next' | 'prev') => {
    const order: Array<'tibetan' | 'phonetic' | 'translation'> = ['tibetan', 'phonetic', 'translation']
    const idx = order.indexOf(lane)
    const targetIdx = direction === 'next' ? idx + 1 : idx - 1

    if (targetIdx >= 0 && targetIdx < order.length) {
      const targetLane = order[targetIdx]
      // The lane-editor div carries all three data-attributes directly on itself.
      // Selector: .lane-editor[data-block-id="..."][data-row-id="..."][data-lane="..."]
      focusLane(blockId, row.id, targetLane)
      setFocusedLane({ blockId, rowId: row.id, lane: targetLane })
    }
  }, [blockId, row.id, setFocusedLane])

  return (
    <div
      id={`row-${blockId}-${row.id}`}
      data-block-id={blockId}
      data-row-id={row.id}
      className={[
        'row-view relative group/row',
        isSelected ? 'ring-1 ring-indigo-400/60 rounded-sm' : '',
      ].join(' ')}
      style={rowStyle}
    >
      {/* Comment indicator */}
      {commentCount > 0 && (
        <span
          className="absolute -right-5 top-0 text-[9px] text-amber-400 font-medium leading-none pt-0.5 cursor-pointer select-none"
          title={`${commentCount} comentario(s)`}
          onClick={() => onAddComment?.(row.id)}
        >
          {commentCount}●
        </span>
      )}

      {/* Add comment button — visible on row hover */}
      {onAddComment && commentCount === 0 && (
        <button
          className="absolute -right-5 top-0 text-[10px] text-slate-600 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer leading-none pt-0.5"
          title="Agregar comentario"
          onClick={() => onAddComment(row.id)}
        >
          ✎
        </button>
      )}

      {/* Tibetan lane */}
      <LaneEditor
        blockId={blockId}
        rowId={row.id}
        lane="tibetan"
        text={row.tibetan.text}
        style={row.tibetan.style}
        onSplitRequest={(offset) => handleSplit('tibetan', offset)}
        onNavigate={(dir) => handleNavigate('tibetan', dir)}
      />

      {/* Gap after tibetan */}
      <div style={{ height: `${layout.gapAfterTibetanPt * PT_TO_PX}px` }} />

      {/* Phonetic lane */}
      <LaneEditor
        blockId={blockId}
        rowId={row.id}
        lane="phonetic"
        text={row.phonetic.text}
        style={row.phonetic.style}
        onSplitRequest={(offset) => handleSplit('phonetic', offset)}
        onNavigate={(dir) => handleNavigate('phonetic', dir)}
      />

      {/* Gap after phonetic */}
      <div style={{ height: `${layout.gapAfterPhoneticPt * PT_TO_PX}px` }} />

      {/* Translation lane */}
      <LaneEditor
        blockId={blockId}
        rowId={row.id}
        lane="translation"
        text={row.translation.text}
        style={row.translation.style}
        onSplitRequest={(offset) => handleSplit('translation', offset)}
        onNavigate={(dir) => handleNavigate('translation', dir)}
      />
    </div>
  )
})
