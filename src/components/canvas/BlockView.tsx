/**
 * BlockView — renders a Block (a logical group of rows).
 *
 * Provides context menu and inline controls for block-level operations
 * (add row, remove block, move block).
 */

import React, { useCallback } from 'react'
import type { Block } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { RowView } from './RowView'

interface BlockViewProps {
  block: Block
  /** Index within document.blocks, used for visual ordering */
  blockIndex: number
  commentCountForRow?: (rowId: string) => number
  onAddComment?: (rowId: string) => void
}

const PT_TO_PX = 1.3333

export const BlockView = React.memo(function BlockView({
  block,
  blockIndex,
  commentCountForRow,
  onAddComment,
}: BlockViewProps) {
  const addRowToBlock = useDocumentStore(s => s.addRowToBlock)
  const selectedRow = useEditorStore(s => s.selectedRow)

  const { layout } = block

  const blockStyle: React.CSSProperties = {
    marginTop: `${layout.marginTopPt * PT_TO_PX}px`,
    marginBottom: `${layout.marginBottomPt * PT_TO_PX}px`,
    paddingLeft: `${layout.paddingLeftPt * PT_TO_PX}px`,
    paddingRight: `${layout.paddingRightPt * PT_TO_PX}px`,
    width: layout.widthOverridePt ? `${layout.widthOverridePt * PT_TO_PX}px` : undefined,
  }

  return (
    <div
      className="block-view relative"
      data-block-id={block.id}
      data-block-index={blockIndex}
      style={blockStyle}
    >
      {block.rows.map((row) => (
        <RowView
          key={row.id}
          blockId={block.id}
          row={row}
          isSelected={selectedRow?.rowId === row.id && selectedRow.blockId === block.id}
          commentCount={commentCountForRow?.(row.id) ?? 0}
          onAddComment={onAddComment}
        />
      ))}

      {/* Add row button at block end */}
      <button
        onClick={() => addRowToBlock(block.id)}
        className="mt-1 text-[10px] text-slate-400 hover:text-indigo-400 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100 focus:opacity-100 px-1"
        aria-label="Agregar fila a este bloque"
      >
        + fila
      </button>
    </div>
  )
})
