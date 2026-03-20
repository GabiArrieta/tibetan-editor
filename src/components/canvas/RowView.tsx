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
 *
 * Cross-row navigation model:
 * The three LaneEditors in a row are "frames" of three parallel continuous flows.
 * - ArrowDown at the end of a lane → focus the same lane in the NEXT row
 * - ArrowUp at the start of a lane → focus the same lane in the PREVIOUS row
 * - Backspace at position 0 → merge this row onto the previous row
 * - Multi-line paste → distribute lines into this row + consecutive new rows
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
function focusLane(blockId: string, rowId: string, lane: string, atEnd = false) {
  const el = document.querySelector<HTMLElement>(
    `.lane-editor[data-block-id="${blockId}"][data-row-id="${rowId}"][data-lane="${lane}"]`
  )
  if (!el) return
  el.focus()
  if (atEnd) {
    // Place caret at the end of the text content
    const sel = window.getSelection()
    const range = document.createRange()
    const node = el.firstChild
    if (node && sel) {
      range.setStart(node, node.textContent?.length ?? 0)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else if (sel) {
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
}

export const RowView = React.memo(function RowView({
  blockId,
  row,
  isSelected,
  commentCount = 0,
  onAddComment,
}: RowViewProps) {
  const splitRow = useDocumentStore(s => s.splitRow)
  const mergeRowWithPrev = useDocumentStore(s => s.mergeRowWithPrev)
  const insertRowsAfterFromLines = useDocumentStore(s => s.insertRowsAfterFromLines)
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

  // Split the current row at cursor — called by Enter
  const handleSplit = useCallback((lane: 'tibetan' | 'phonetic' | 'translation', offset: number) => {
    splitRow(blockId, row.id, lane, offset)
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

  // Tab / Shift+Tab — navigate lanes within the same row
  const handleNavigate = useCallback((lane: 'tibetan' | 'phonetic' | 'translation', direction: 'next' | 'prev') => {
    const order: Array<'tibetan' | 'phonetic' | 'translation'> = ['tibetan', 'phonetic', 'translation']
    const idx = order.indexOf(lane)
    const targetIdx = direction === 'next' ? idx + 1 : idx - 1

    if (targetIdx >= 0 && targetIdx < order.length) {
      const targetLane = order[targetIdx]
      focusLane(blockId, row.id, targetLane)
      setFocusedLane({ blockId, rowId: row.id, lane: targetLane })
    }
  }, [blockId, row.id, setFocusedLane])

  // ArrowDown/ArrowUp — navigate to the adjacent row's same lane
  const handleNavigateRow = useCallback((
    lane: 'tibetan' | 'phonetic' | 'translation',
    direction: 'next' | 'prev'
  ) => {
    requestAnimationFrame(() => {
      const state = useDocumentStore.getState()
      const block = state.document.blocks.find(b => b.id === blockId)
      if (!block) return
      const rowIdx = block.rows.findIndex(r => r.id === row.id)
      const targetIdx = direction === 'next' ? rowIdx + 1 : rowIdx - 1
      const targetRow = block.rows[targetIdx]
      if (!targetRow) return
      // When moving up, place the caret at the end of the previous row's lane
      const placeAtEnd = direction === 'prev'
      focusLane(blockId, targetRow.id, lane, placeAtEnd)
      setFocusedLane({ blockId, rowId: targetRow.id, lane })
    })
  }, [blockId, row.id, setFocusedLane])

  // Backspace at position 0 — merge this row onto the previous row
  const handleMergeWithPrev = useCallback((
    lane: 'tibetan' | 'phonetic' | 'translation'
  ) => {
    // Remember how many characters are at the end of the previous row's lane
    // BEFORE the merge — we'll restore the caret there.
    const state = useDocumentStore.getState()
    const block = state.document.blocks.find(b => b.id === blockId)
    if (!block) return
    const rowIdx = block.rows.findIndex(r => r.id === row.id)
    if (rowIdx <= 0) return
    const prevRow = block.rows[rowIdx - 1]
    const prevLaneTextLength = prevRow[lane].text.length

    mergeRowWithPrev(blockId, row.id)

    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `.lane-editor[data-block-id="${blockId}"][data-row-id="${prevRow.id}"][data-lane="${lane}"]`
      )
      if (!el) return
      el.focus()
      // Place caret at the original end of the previous lane's text (before append)
      const sel = window.getSelection()
      const node = el.firstChild
      if (node && sel) {
        const range = document.createRange()
        const offset = Math.min(prevLaneTextLength, node.textContent?.length ?? 0)
        range.setStart(node, offset)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    })
  }, [blockId, row.id, mergeRowWithPrev])

  // Multi-line paste — distribute lines across consecutive rows
  const handleMultiLinePaste = useCallback((
    lane: 'tibetan' | 'phonetic' | 'translation',
    cursorOffset: number,
    lines: string[]
  ) => {
    const lastRowId = insertRowsAfterFromLines(blockId, row.id, lane, cursorOffset, lines)

    // Focus the last created row's matching lane
    requestAnimationFrame(() => {
      if (!lastRowId) return
      const state = useDocumentStore.getState()
      const block = state.document.blocks.find(b => b.id === blockId)
      if (!block) return
      const lastRow = block.rows.find(r => r.id === lastRowId)
      if (!lastRow) return
      focusLane(blockId, lastRowId, lane, true)
      setFocusedLane({ blockId, rowId: lastRowId, lane })
    })
  }, [blockId, row.id, insertRowsAfterFromLines, setFocusedLane])

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
        onNavigateRow={(dir) => handleNavigateRow('tibetan', dir)}
        onMergeWithPrev={() => handleMergeWithPrev('tibetan')}
        onMultiLinePaste={(offset, lines) => handleMultiLinePaste('tibetan', offset, lines)}
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
        onNavigateRow={(dir) => handleNavigateRow('phonetic', dir)}
        onMergeWithPrev={() => handleMergeWithPrev('phonetic')}
        onMultiLinePaste={(offset, lines) => handleMultiLinePaste('phonetic', offset, lines)}
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
        onNavigateRow={(dir) => handleNavigateRow('translation', dir)}
        onMergeWithPrev={() => handleMergeWithPrev('translation')}
        onMultiLinePaste={(offset, lines) => handleMultiLinePaste('translation', offset, lines)}
      />
    </div>
  )
})
