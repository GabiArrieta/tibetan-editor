/**
 * PdfDocument — @react-pdf/renderer component tree.
 *
 * Renders a TibetanDocument to a PDF using @react-pdf/renderer's own
 * layout engine (yoga). This is completely independent of the DOM.
 *
 * Font registration must happen BEFORE rendering:
 * - For custom fonts: use ObjectURLs retrieved from IndexedDB
 * - Fallback: system serif fonts
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'

// Style type from @react-pdf/renderer Styles map value
type PdfStyle = Parameters<typeof StyleSheet.create>[0][string]
import type { TibetanDocument, Row, TextStyle } from '../../types/document'

// ---------------------------------------------------------------------------
// Font registration
// ---------------------------------------------------------------------------

/**
 * Register custom fonts from their ObjectURLs for PDF export.
 * Call before creating the PDF element.
 */
export function registerPdfFonts(fonts: { family: string; objectUrl: string }[]): void {
  fonts.forEach(({ family, objectUrl }) => {
    try {
      Font.register({ family, src: objectUrl })
    } catch (e) {
      console.warn(`Failed to register PDF font "${family}":`, e)
    }
  })
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function mmToPt(mm: number): number {
  return mm * 2.8346456693
}

function textStyleToPdf(style: TextStyle): PdfStyle {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing ?? 0,
    color: style.color ?? '#111111',
    textAlign: (style.textAlign ?? 'left') as PdfStyle['textAlign'],
    fontWeight: style.fontWeight ?? 400,
    fontStyle: (style.fontStyle ?? 'normal') as PdfStyle['fontStyle'],
  }
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function PdfRowView({ row }: { row: Row }) {
  const { layout } = row

  return (
    <View
      style={{
        marginTop: layout.marginTopPt,
        marginBottom: layout.marginBottomPt,
        paddingLeft: layout.paddingLeftPt + layout.indentationPt,
        paddingRight: layout.paddingRightPt,
      }}
      wrap={!layout.keepTogether}
    >
      {row.tibetan.text ? (
        <Text style={textStyleToPdf(row.tibetan.style)}>
          {row.tibetan.text}
        </Text>
      ) : null}

      {layout.gapAfterTibetanPt > 0 ? (
        <View style={{ height: layout.gapAfterTibetanPt }} />
      ) : null}

      {row.phonetic.text ? (
        <Text style={textStyleToPdf(row.phonetic.style)}>
          {row.phonetic.text}
        </Text>
      ) : null}

      {layout.gapAfterPhoneticPt > 0 ? (
        <View style={{ height: layout.gapAfterPhoneticPt }} />
      ) : null}

      {row.translation.text ? (
        <Text style={textStyleToPdf(row.translation.style)}>
          {row.translation.text}
        </Text>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main PDF document
// ---------------------------------------------------------------------------

interface TibetanPdfDocumentProps {
  doc: TibetanDocument
}

export function TibetanPdfDocument({ doc }: TibetanPdfDocumentProps) {
  const { pageSettings, blocks } = doc

  const pageSize = {
    width: mmToPt(pageSettings.widthMm),
    height: mmToPt(pageSettings.heightMm),
  }

  return (
    <Document title={doc.title} author="Tibetan Editor">
      <Page
        size={pageSize}
        style={{
          paddingTop: mmToPt(pageSettings.marginTopMm),
          paddingRight: mmToPt(pageSettings.marginRightMm),
          paddingBottom: mmToPt(pageSettings.marginBottomMm),
          paddingLeft: mmToPt(pageSettings.marginLeftMm),
          backgroundColor: '#ffffff',
        }}
      >
        {blocks.map(block => (
          <View
            key={block.id}
            style={{
              marginTop: block.layout.marginTopPt,
              marginBottom: block.layout.marginBottomPt,
              paddingLeft: block.layout.paddingLeftPt,
              paddingRight: block.layout.paddingRightPt,
            }}
          >
            {block.rows.map(row => (
              <PdfRowView key={row.id} row={row} />
            ))}
          </View>
        ))}

        {pageSettings.showPageNumbers ? (
          <Text
            style={{
              position: 'absolute',
              bottom: mmToPt(pageSettings.marginBottomMm * 0.5),
              left: 0,
              right: 0,
              textAlign: pageSettings.pageNumberPosition === 'bottom-left' ? 'left'
                : pageSettings.pageNumberPosition === 'bottom-right' ? 'right'
                : 'center',
              fontSize: 9,
              color: '#999999',
              paddingLeft: mmToPt(pageSettings.marginLeftMm),
              paddingRight: mmToPt(pageSettings.marginRightMm),
            }}
            render={({ pageNumber }) => `${pageNumber}`}
            fixed
          />
        ) : null}
      </Page>
    </Document>
  )
}
