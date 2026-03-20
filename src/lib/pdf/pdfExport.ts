/**
 * pdfExport — exports a TibetanDocument to a PDF file.
 *
 * Steps:
 * 1. Gather loaded font ObjectURLs from fontStore
 * 2. Register them with @react-pdf/renderer via Font.register()
 * 3. Render the TibetanPdfDocument component to a Blob
 * 4. Trigger a browser download
 *
 * Known limitation: @react-pdf/renderer only supports TTF and WOFF reliably.
 * OTF fonts may not render correctly. This is documented in the UI.
 */

import React from 'react'
import { pdf } from '@react-pdf/renderer'
import type { TibetanDocument } from '../../types/document'
import { useFontStore } from '../../store/fontStore'
import { TibetanPdfDocument, registerPdfFonts } from './PdfDocument'

export interface PdfExportOptions {
  onProgress?: (stage: string) => void
  onError?: (error: Error) => void
}

export async function exportToPdf(
  doc: TibetanDocument,
  options: PdfExportOptions = {}
): Promise<void> {
  const { onProgress, onError } = options

  try {
    onProgress?.('Preparando fuentes…')

    const { loadedFonts } = useFontStore.getState()
    const fontsToRegister = Object.values(loadedFonts)
      .filter(f => f.injected && f.objectUrl)
      .map(f => ({ family: f.family, objectUrl: f.objectUrl }))

    registerPdfFonts(fontsToRegister)

    onProgress?.('Generando PDF…')

    // pdf() expects a ReactElement<DocumentProps>; TibetanPdfDocument renders
    // a <Document> which satisfies this. The cast is necessary because TypeScript
    // cannot narrow the component's return type to DocumentProps.
    const element = React.createElement(TibetanPdfDocument, { doc })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(element as any).toBlob()

    onProgress?.('Descargando…')

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title.replace(/[^\w\s-]/g, '').trim() || 'documento'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)

    onProgress?.('Completado')
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    onError?.(error)
    console.error('PDF export failed:', error)
    throw error
  }
}
