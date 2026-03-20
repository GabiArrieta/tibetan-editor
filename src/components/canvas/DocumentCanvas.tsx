/**
 * DocumentCanvas — the central editing area.
 *
 * Renders A4 pages in a scrollable dark background. The pagination engine
 * runs on content changes to determine where page breaks fall.
 *
 * Block rendering strategy:
 *   - 'cover'   blocks → CoverPageView (full-page, before content)
 *   - 'content' blocks → PageView (grouped, supports pagination)
 *   - 'back'    blocks → BackPageView (full-page, after content)
 *   - 'section-heading' / 'index' → rendered inline within a PageView
 */

import React, { useRef, useEffect, useCallback } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { useCommentStore } from '../../store/commentStore'
import { PageView } from './PageView'
import { CoverPageView } from './CoverPageView'
import { BackPageView } from './BackPageView'
import { calculatePageBreaks, buildRowRefs } from '../../lib/pagination/paginationEngine'
import type { Block } from '../../types/document'

export function DocumentCanvas() {
  const doc = useDocumentStore(s => s.document)
  const zoom = useEditorStore(s => s.zoom)
  const setPagination = useEditorStore(s => s.setPagination)
  const openCountForRow = useCommentStore(s => s.openCountForRow)
  const setPanelOpen = useCommentStore(s => s.setPanelOpen)
  const contentRef = useRef<HTMLDivElement>(null)

  // Run pagination engine after renders settle
  const runPagination = useCallback(() => {
    if (!contentRef.current) return
    const refs = buildRowRefs(doc)
    const result = calculatePageBreaks(doc, refs, contentRef.current)
    setPagination(result)
  }, [doc, setPagination])

  useEffect(() => {
    if (!contentRef.current) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(runPagination)
    })
    ro.observe(contentRef.current)
    runPagination()
    return () => ro.disconnect()
  }, [runPagination])

  const { pageSettings } = doc
  const specialProps = {
    widthMm: pageSettings.widthMm,
    heightMm: pageSettings.heightMm,
    marginTopMm: pageSettings.marginTopMm,
    marginRightMm: pageSettings.marginRightMm,
    marginBottomMm: pageSettings.marginBottomMm,
    marginLeftMm: pageSettings.marginLeftMm,
  }

  // Separate blocks by type for rendering
  // Blocks without blockType default to 'content' (backward compatibility)
  const coverBlocks = doc.blocks.filter(b => b.blockType === 'cover')
  const contentBlocks = doc.blocks.filter(b => b.blockType !== 'cover' && b.blockType !== 'back')
  const backBlocks = doc.blocks.filter(b => b.blockType === 'back')
  // Note: undefined blockType falls through to contentBlocks (the !== comparisons above)

  // Page numbering
  const skipCover = pageSettings.pageNumberSkipCover
  const startAt = pageSettings.pageNumberStartAt ?? 1
  let pageNum = startAt

  const scaleStyle: React.CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
  }

  return (
    <div
      className="document-canvas-wrapper flex-1 overflow-auto bg-slate-800 flex flex-col items-center py-8 gap-8 min-h-0"
      aria-label="Área de edición"
    >
      <div
        ref={contentRef}
        className="canvas-content flex flex-col items-center gap-8"
        style={scaleStyle}
      >
        {/* Cover pages */}
        {coverBlocks.map(block => (
          <div key={block.id}>
            <CoverPageView block={block} {...specialProps} />
            {pageSettings.showPageNumbers && !skipCover && (
              <div className="text-center text-xs text-slate-500 mt-1">{pageNum++}</div>
            )}
            {pageSettings.showPageNumbers && skipCover && (
              /* cover is counted in pagination even if not displayed */
              void 0
            )}
          </div>
        ))}

        {/* Main content — all non-special blocks in a single PageView for now */}
        {contentBlocks.length > 0 && (
          <PageView
            doc={doc}
            pageBlocks={contentBlocks as Block[]}
            pageNumber={skipCover ? pageNum : pageNum}
            zoom={1}
            commentCountForRow={(rowId) => openCountForRow(doc.id, rowId)}
            onAddComment={(rowId) => {
              useCommentStore.getState().setPanelOpen(true)
              // The actual add comment dialog is handled by AppShell via addCommentRowId state
              useDocumentStore.getState() // no-op to stabilize closure
              window.dispatchEvent(new CustomEvent('te:add-comment', { detail: { rowId, documentId: doc.id } }))
            }}
          />
        )}

        {/* Back pages */}
        {backBlocks.map(block => (
          <BackPageView key={block.id} block={block} {...specialProps} />
        ))}
      </div>
    </div>
  )
}
