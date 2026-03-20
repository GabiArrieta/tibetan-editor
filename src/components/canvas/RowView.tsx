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

import React, { useCallback, useRef } from 'react'
import type { Row } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { LaneEditor } from './LaneEditor'

interface RowViewProps {
  blockId: string
  row: Row
  isSelected: boolean
}

const PT_TO_PX = 1.3333 // 1pt ≈ 1.333px at 96dpi

export const RowView = React.memo(function RowView({ blockId, row, isSelected }: RowViewProps) {
  const splitRow = useDocumentStore(s => s.splitRow)
  const setFocusedLane = useEditorStore(s => s.setFocusedLane)

  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
    // After split, the new row is added below; focus moves there
    requestAnimationFrame(() => {
      const nextRowEl = document.querySelector(`[data-block-id="${blockId}"] [data-row-id]`) as HTMLElement | null
      // Better: focus the first lane of the newly created row
    })
  }, [blockId, row.id, splitRow])

  const handleNavigate = useCallback((lane: 'tibetan' | 'phonetic' | 'translation', direction: 'next' | 'prev') => {
    const order: Array<'tibetan' | 'phonetic' | 'translation'> = ['tibetan', 'phonetic', 'translation']
    const idx = order.indexOf(lane)
    const targetIdx = direction === 'next' ? idx + 1 : idx - 1

    if (targetIdx >= 0 && targetIdx < order.length) {
      const targetLane = order[targetIdx]
      const targetEl = document.querySelector(
        `[data-block-id="${blockId}"][data-row-id="${row.id}"] .lane-editor[data-lane="${targetLane}"]`
      ) as HTMLElement | null
      targetEl?.focus()
      setFocusedLane({ blockId, rowId: row.id, lane: targetLane })
    }
  }, [blockId, row.id, setFocusedLane])

  return (
    <div
      id={`row-${blockId}-${row.id}`}
      data-block-id={blockId}
      data-row-id={row.id}
      className={[
        'row-view relative',
        isSelected ? 'ring-1 ring-indigo-400/60 rounded-sm' : '',
      ].join(' ')}
      style={rowStyle}
    >
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
