/**
 * paginationEngine — calculates page breaks for the A4 canvas.
 *
 * This engine measures the real rendered height of each row element via
 * getBoundingClientRect and determines where page breaks should fall,
 * respecting each row's keepTogether constraint.
 *
 * The result is stored in editorStore (not in the document) because it is
 * a derived/computed value that changes whenever content or layout changes.
 */

import type { TibetanDocument } from '../../types/document'
import type { PaginationResult, PageBreak } from '../../types/editor'

/** CSS pixels per mm at 96dpi */
const PX_PER_MM = 3.7795275591

/**
 * Calculate the usable content height of a page in pixels,
 * given the page settings.
 */
export function contentHeightPx(doc: TibetanDocument): number {
  const { heightMm, marginTopMm, marginBottomMm } = doc.pageSettings
  return (heightMm - marginTopMm - marginBottomMm) * PX_PER_MM
}

export interface RowRef {
  blockIdx: number
  rowIdx: number
  /** DOM element ID for the row */
  elementId: string
}

/**
 * Build a flat list of RowRef objects from the document structure.
 * Used to correlate DOM measurements back to document positions.
 */
export function buildRowRefs(doc: TibetanDocument): RowRef[] {
  const refs: RowRef[] = []
  doc.blocks.forEach((block, blockIdx) => {
    block.rows.forEach((_row, rowIdx) => {
      refs.push({
        blockIdx,
        rowIdx,
        elementId: `row-${block.id}-${_row.id}`,
      })
    })
  })
  return refs
}

/**
 * Run the pagination algorithm.
 *
 * @param doc         The current document
 * @param rowRefs     Flat list of RowRef (from buildRowRefs)
 * @param container   The DOM element that contains all rows (the canvas content div)
 * @returns           PaginationResult with page count and break positions
 */
export function calculatePageBreaks(
  doc: TibetanDocument,
  rowRefs: RowRef[],
  container: HTMLElement
): PaginationResult {
  const maxPageHeight = contentHeightPx(doc)
  const pageBreaks: PageBreak[] = []
  let currentPageUsed = 0
  let pageCount = 1

  for (const ref of rowRefs) {
    const el = container.querySelector(`#${ref.elementId}`)
    if (!el) continue

    const rowHeight = el.getBoundingClientRect().height
    const row = doc.blocks[ref.blockIdx]?.rows[ref.rowIdx]
    const keepTogether = row?.layout.keepTogether ?? true

    if (currentPageUsed + rowHeight > maxPageHeight) {
      // This row does not fit on the current page
      pageBreaks.push({ blockIdx: ref.blockIdx, rowIdx: ref.rowIdx })
      currentPageUsed = rowHeight
      pageCount++
    } else {
      currentPageUsed += rowHeight
    }

    // If keepTogether and the row overflows into the next page, move the
    // break before this row (handled above already)
    void keepTogether
  }

  return { pageCount, pageBreaks }
}

/**
 * Determine which page a given (blockIdx, rowIdx) belongs to,
 * given a set of page breaks.
 */
export function getPageForRow(
  blockIdx: number,
  rowIdx: number,
  pageBreaks: PageBreak[]
): number {
  let page = 0
  for (const pb of pageBreaks) {
    if (blockIdx > pb.blockIdx || (blockIdx === pb.blockIdx && rowIdx >= pb.rowIdx)) {
      page++
    } else {
      break
    }
  }
  return page
}
