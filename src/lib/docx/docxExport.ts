/**
 * docxExport — exports a TibetanDocument to a DOCX file using the docx library.
 *
 * DOCX cannot natively represent synchronized lanes in the same way as this editor.
 * Strategy: each Row produces three consecutive Paragraphs with distinct styles.
 *
 * Limitation: the pixel-perfect layout of the editor is not reproducible in DOCX.
 * The output is structurally faithful and readable, not a layout clone.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  convertMillimetersToTwip,
} from 'docx'
import type { TibetanDocument, TextStyle } from '../../types/document'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ptToHalfPt(pt: number): number {
  return Math.round(pt * 2)
}

function textAlignToDocx(align?: string): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (align === 'center') return AlignmentType.CENTER
  if (align === 'right') return AlignmentType.RIGHT
  return AlignmentType.LEFT
}

function makeParagraph(text: string, style: TextStyle, spacingAfterPt = 0): Paragraph {
  if (!text.trim()) {
    return new Paragraph({ text: '', spacing: { after: 20 } })
  }

  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: style.fontFamily,
        size: ptToHalfPt(style.fontSize),
        italics: style.fontStyle === 'italic',
        bold: (style.fontWeight ?? 400) >= 700,
        color: (style.color ?? '#111111').replace('#', ''),
        characterSpacing: style.letterSpacing ? Math.round(style.letterSpacing * 20) : undefined,
      }),
    ],
    alignment: textAlignToDocx(style.textAlign),
    spacing: {
      after: spacingAfterPt > 0 ? Math.round(spacingAfterPt * 20) : 40,
      line: Math.round(style.lineHeight * 240),
    },
  })
}

// ---------------------------------------------------------------------------
// Export function
// ---------------------------------------------------------------------------

export async function exportToDocx(doc: TibetanDocument): Promise<void> {
  const { pageSettings, blocks, title } = doc

  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    }),
  ]

  for (const block of blocks) {
    if (block.label) {
      paragraphs.push(
        new Paragraph({
          text: block.label,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      )
    }

    for (const row of block.rows) {
      const { tibetan, phonetic, translation, layout } = row

      paragraphs.push(makeParagraph(tibetan.text, tibetan.style, layout.gapAfterTibetanPt))
      paragraphs.push(makeParagraph(phonetic.text, phonetic.style, layout.gapAfterPhoneticPt))
      paragraphs.push(makeParagraph(translation.text, translation.style, layout.marginBottomPt))
      paragraphs.push(new Paragraph({ text: '', spacing: { after: 60 } }))
    }

    paragraphs.push(new Paragraph({ text: '', spacing: { after: 160 } }))
  }

  const wordDoc = new Document({
    title,
    description: 'Exportado desde Tibetan Editor',
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(pageSettings.widthMm),
              height: convertMillimetersToTwip(pageSettings.heightMm),
            },
            margin: {
              top: convertMillimetersToTwip(pageSettings.marginTopMm),
              right: convertMillimetersToTwip(pageSettings.marginRightMm),
              bottom: convertMillimetersToTwip(pageSettings.marginBottomMm),
              left: convertMillimetersToTwip(pageSettings.marginLeftMm),
            },
          },
        },
        children: paragraphs,
      },
    ],
  })

  const blob = await Packer.toBlob(wordDoc)
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${doc.title.replace(/[^\w\s-]/g, '').trim() || 'documento'}.docx`
  window.document.body.appendChild(anchor)
  anchor.click()
  window.document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
