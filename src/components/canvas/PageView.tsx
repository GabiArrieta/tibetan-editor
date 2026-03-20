/**
 * PageView — renders one A4 page in the editor canvas.
 *
 * A page contains a slice of the document's blocks/rows as determined
 * by the paginationEngine. The outer div uses mm units to match real A4
 * dimensions; a CSS transform scales it by the editor zoom level.
 */

import React from 'react'
import type { TibetanDocument, Block } from '../../types/document'
import { BlockView } from './BlockView'

interface PageViewProps {
  doc: TibetanDocument
  /** Blocks (and their row slices) to render on this page */
  pageBlocks: Block[]
  /** 1-based page number */
  pageNumber: number
  zoom: number
  /** Returns the number of open comments for a row id */
  commentCountForRow?: (rowId: string) => number
  /** Called when user clicks the add-comment button on a row */
  onAddComment?: (rowId: string) => void
}

export const PageView = React.memo(function PageView({
  doc,
  pageBlocks,
  pageNumber,
  zoom,
  commentCountForRow,
  onAddComment,
}: PageViewProps) {
  const { pageSettings } = doc
  const { widthMm, heightMm, marginTopMm, marginRightMm, marginBottomMm, marginLeftMm } = pageSettings

  const pageStyle: React.CSSProperties = {
    width: `${widthMm}mm`,
    minHeight: `${heightMm}mm`,
    paddingTop: `${marginTopMm}mm`,
    paddingRight: `${marginRightMm}mm`,
    paddingBottom: `${marginBottomMm}mm`,
    paddingLeft: `${marginLeftMm}mm`,
    boxSizing: 'border-box',
    backgroundColor: 'white',
    color: '#111',
    position: 'relative',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    borderRadius: '1px',
    transformOrigin: 'top center',
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
  }

  return (
    <div className="page-view flex-shrink-0" data-page={pageNumber}>
      <div style={pageStyle} className="page-canvas">
        {pageBlocks.map((block, idx) => (
          <BlockView
            key={block.id}
            block={block}
            blockIndex={idx}
            commentCountForRow={commentCountForRow}
            onAddComment={onAddComment}
          />
        ))}

        {/* Page number */}
        {pageSettings.showPageNumbers && (
          <div
            className="absolute text-[9pt] text-gray-400 select-none"
            style={(() => {
              const pos = pageSettings.pageNumberPosition
              return {
                bottom: `${marginBottomMm * 0.4}mm`,
                left: pos === 'bottom-left' ? `${marginLeftMm}mm` : pos === 'bottom-center' ? '50%' : undefined,
                right: pos === 'bottom-right' ? `${marginRightMm}mm` : undefined,
                transform: pos === 'bottom-center' ? 'translateX(-50%)' : undefined,
              } as React.CSSProperties
            })()}
          >
            {pageNumber}
          </div>
        )}
      </div>
    </div>
  )
})
