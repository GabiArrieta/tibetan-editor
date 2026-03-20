/**
 * CoverPageView — portada editable del documento.
 *
 * Renderiza un bloque de tipo 'cover' como una página A4 entera con layout
 * centrado y campos editables en línea. No usa el modelo Row/Lane sino
 * campos estructurados del CoverPageData.
 */

import React, { useCallback } from 'react'
import type { Block } from '../../types/document'
import type { CoverPageData } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'

interface CoverPageViewProps {
  block: Block
  widthMm: number
  heightMm: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
}

const MM_TO_PX = 3.7795 // 1mm ≈ 3.7795px at 96dpi

export function CoverPageView({
  block,
  widthMm,
  heightMm,
  marginTopMm,
  marginRightMm,
  marginBottomMm,
  marginLeftMm,
}: CoverPageViewProps) {
  const updateSpecialData = useDocumentStore(s => s.updateSpecialData)

  const coverData = block.special?.type === 'cover' ? block.special.cover : null
  if (!coverData) return null

  const patch = useCallback((field: keyof CoverPageData, value: string) => {
    if (!coverData) return
    updateSpecialData(block.id, {
      type: 'cover',
      cover: { ...coverData, [field]: value },
    })
  }, [block.id, coverData, updateSpecialData])

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
      {/* Cover type badge */}
      <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded select-none pointer-events-none">
        PORTADA
      </div>

      {/* Content area — vertically centered */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">

        {/* Image placeholder */}
        {coverData.imageUrl ? (
          <img
            src={coverData.imageUrl}
            alt="Cover image"
            className="max-w-[60%] max-h-40 object-contain mb-4"
          />
        ) : (
          <div className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center mb-4 text-xs text-slate-300 cursor-pointer hover:border-indigo-300 hover:text-indigo-300 transition-colors">
            + imagen
          </div>
        )}

        {/* Title */}
        <EditableField
          value={coverData.title}
          onChange={v => patch('title', v)}
          placeholder="Título principal"
          className="text-2xl font-bold text-slate-900 w-full text-center"
        />

        {/* Subtitle */}
        <EditableField
          value={coverData.subtitle ?? ''}
          onChange={v => patch('subtitle', v)}
          placeholder="Subtítulo"
          className="text-lg text-slate-600 w-full text-center"
        />

        {/* Author */}
        <EditableField
          value={coverData.author ?? ''}
          onChange={v => patch('author', v)}
          placeholder="Autor / Compilador"
          className="text-sm text-slate-500 w-full text-center mt-2"
        />

        {/* Institution */}
        <EditableField
          value={coverData.institution ?? ''}
          onChange={v => patch('institution', v)}
          placeholder="Institución / Tradición"
          className="text-sm text-slate-400 w-full text-center"
        />

        {/* Additional text */}
        <EditableField
          value={coverData.additionalText ?? ''}
          onChange={v => patch('additionalText', v)}
          placeholder="Texto adicional…"
          className="text-xs text-slate-400 w-full text-center mt-4 max-w-xs"
          multiline
        />
      </div>

      {/* Footer text — fixed at bottom */}
      <div className="mt-auto pt-4 border-t border-slate-100">
        <EditableField
          value={coverData.footerText ?? ''}
          onChange={v => patch('footerText', v)}
          placeholder="Pie de página / año / lugar…"
          className="text-xs text-slate-400 w-full text-center"
        />
      </div>
    </div>
  )
}

// ─── Inline editable field ───────────────────────────────────────────────────

interface EditableFieldProps {
  value: string
  onChange(v: string): void
  placeholder: string
  className?: string
  multiline?: boolean
}

function EditableField({ value, onChange, placeholder, className = '', multiline = false }: EditableFieldProps) {
  const base = [
    'outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-300',
    'bg-transparent transition-colors placeholder-slate-300 resize-none',
    className,
  ].join(' ')

  if (multiline) {
    return (
      <textarea
        className={base}
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ minHeight: '2em' }}
      />
    )
  }

  return (
    <input
      type="text"
      className={base}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}
