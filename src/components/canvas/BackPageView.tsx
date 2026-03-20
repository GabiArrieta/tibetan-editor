/**
 * BackPageView — página final / colofón del documento.
 *
 * Renderiza un bloque de tipo 'back' como una página A4 con el texto
 * posicionado cerca del pie (estilo colofón editorial).
 */

import React, { useCallback } from 'react'
import type { Block } from '../../types/document'
import type { BackPageData } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'

interface BackPageViewProps {
  block: Block
  widthMm: number
  heightMm: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
}

const MM_TO_PX = 3.7795

export function BackPageView({
  block,
  widthMm,
  heightMm,
  marginTopMm,
  marginRightMm,
  marginBottomMm,
  marginLeftMm,
}: BackPageViewProps) {
  const updateSpecialData = useDocumentStore(s => s.updateSpecialData)

  const backData = block.special?.type === 'back' ? block.special.back : null
  if (!backData) return null

  const patch = useCallback((field: keyof BackPageData, value: string) => {
    if (!backData) return
    updateSpecialData(block.id, {
      type: 'back',
      back: { ...backData, [field]: value },
    })
  }, [block.id, backData, updateSpecialData])

  const pageStyle: React.CSSProperties = {
    width: `${widthMm * MM_TO_PX}px`,
    minHeight: `${heightMm * MM_TO_PX}px`,
    paddingTop: `${marginTopMm * MM_TO_PX}px`,
    paddingRight: `${marginRightMm * MM_TO_PX}px`,
    paddingBottom: `${marginBottomMm * MM_TO_PX}px`,
    paddingLeft: `${marginLeftMm * MM_TO_PX}px`,
    boxSizing: 'border-box',
  }

  return (
    <div
      className="relative bg-white shadow-xl mx-auto flex flex-col"
      style={pageStyle}
    >
      {/* Type badge */}
      <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded select-none pointer-events-none">
        COLOFÓN
      </div>

      {/* Content pushed to the bottom — colophon style */}
      <div className="flex-1" />

      <div className="border-t border-slate-100 pt-6 space-y-3">
        <textarea
          className="w-full bg-transparent text-sm text-slate-700 resize-none outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-300 transition-colors placeholder-slate-300 leading-relaxed"
          rows={5}
          placeholder="Texto del colofón, créditos, información editorial…"
          value={backData.text}
          onChange={e => patch('text', e.target.value)}
        />

        {/* Secondary text (optional) */}
        <textarea
          className="w-full bg-transparent text-xs text-slate-400 resize-none outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-300 transition-colors placeholder-slate-300 leading-relaxed"
          rows={2}
          placeholder="Nota adicional (opcional)…"
          value={backData.secondaryText ?? ''}
          onChange={e => patch('secondaryText', e.target.value)}
        />
      </div>
    </div>
  )
}
