/**
 * DocumentCanvas — the central editing area.
 *
 * Renders A4 pages in a scrollable dark background. The pagination engine
 * runs on content changes to determine where page breaks fall.
 *
 * For MVP, all blocks are rendered on a single continuous page.
 * Multi-page splitting is enabled once paginationEngine is wired to DOM refs.
 */

import React, { useRef, useEffect, useCallback } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { PageView } from './PageView'
import { calculatePageBreaks, buildRowRefs } from '../../lib/pagination/paginationEngine'
import type { Block } from '../../types/document'

export function DocumentCanvas() {
  const doc = useDocumentStore(s => s.document)
  const zoom = useEditorStore(s => s.zoom)
  const setPagination = useEditorStore(s => s.setPagination)
  const contentRef = useRef<HTMLDivElement>(null)

  // Run pagination engine after renders settle
  const runPagination = useCallback(() => {
    if (!contentRef.current) return
    const refs = buildRowRefs(doc)
    const result = calculatePageBreaks(doc, refs, contentRef.current)
    setPagination(result)
  }, [doc, setPagination])

  useEffect(() => {
    // Use ResizeObserver to re-paginate when content height changes
    if (!contentRef.current) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(runPagination)
    })
    ro.observe(contentRef.current)
    runPagination()
    return () => ro.disconnect()
  }, [runPagination])

  // For MVP: render all blocks as a single continuous page
  // Future: split into multiple PageViews based on paginationEngine results
  const allBlocks: Block[] = doc.blocks

  // Scale the wrapper so the page doesn't overflow, accounting for zoom
  const pageWidthMm = doc.pageSettings.widthMm
  const containerStyle: React.CSSProperties = {
    // Allow horizontal centering with zoom applied
    width: `${pageWidthMm}mm`,
  }

  return (
    <div
      className="document-canvas-wrapper flex-1 overflow-auto bg-slate-800 flex flex-col items-center py-8 gap-8 min-h-0"
      aria-label="Área de edición"
    >
      <div
        ref={contentRef}
        className="canvas-content"
        style={containerStyle}
      >
        <PageView
          doc={doc}
          pageBlocks={allBlocks}
          pageNumber={1}
          zoom={zoom}
        />
      </div>
    </div>
  )
}
