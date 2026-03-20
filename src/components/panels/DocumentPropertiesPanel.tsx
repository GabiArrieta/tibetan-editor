/**
 * DocumentPropertiesPanel — right panel tab for page settings and document metadata.
 */

import React from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { NumberInput } from '../shared/NumberInput'

export function DocumentPropertiesPanel() {
  const doc = useDocumentStore(s => s.document)
  const setTitle = useDocumentStore(s => s.setTitle)
  const setPageSettings = useDocumentStore(s => s.setPageSettings)

  const { pageSettings } = doc

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto custom-scrollbar">
      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Documento</h3>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Título</span>
          <input
            type="text"
            value={doc.title}
            onChange={e => setTitle(e.target.value)}
            className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-400 outline-none"
          />
        </label>
      </section>

      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Página</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Ancho"
            value={pageSettings.widthMm}
            onChange={v => setPageSettings({ widthMm: v })}
            min={50} step={1} unit="mm"
          />
          <NumberInput
            label="Alto"
            value={pageSettings.heightMm}
            onChange={v => setPageSettings({ heightMm: v })}
            min={50} step={1} unit="mm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <NumberInput
            label="Margen sup."
            value={pageSettings.marginTopMm}
            onChange={v => setPageSettings({ marginTopMm: v })}
            min={0} step={1} unit="mm"
          />
          <NumberInput
            label="Margen inf."
            value={pageSettings.marginBottomMm}
            onChange={v => setPageSettings({ marginBottomMm: v })}
            min={0} step={1} unit="mm"
          />
          <NumberInput
            label="Margen izq."
            value={pageSettings.marginLeftMm}
            onChange={v => setPageSettings({ marginLeftMm: v })}
            min={0} step={1} unit="mm"
          />
          <NumberInput
            label="Margen der."
            value={pageSettings.marginRightMm}
            onChange={v => setPageSettings({ marginRightMm: v })}
            min={0} step={1} unit="mm"
          />
        </div>
      </section>

      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Numeración</h3>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={pageSettings.showPageNumbers}
            onChange={e => setPageSettings({ showPageNumbers: e.target.checked })}
            className="accent-indigo-500"
          />
          Mostrar número de página
        </label>
        {pageSettings.showPageNumbers && (
          <select
            value={pageSettings.pageNumberPosition}
            onChange={e => setPageSettings({ pageNumberPosition: e.target.value as typeof pageSettings.pageNumberPosition })}
            className="mt-2 w-full bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-400 outline-none"
          >
            <option value="bottom-center">Centro inferior</option>
            <option value="bottom-left">Izquierda inferior</option>
            <option value="bottom-right">Derecha inferior</option>
          </select>
        )}
      </section>

      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Presets de tamaño</h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'A4', w: 210, h: 297 },
            { label: 'Letter', w: 216, h: 279 },
            { label: 'A5', w: 148, h: 210 },
          ].map(({ label, w, h }) => (
            <button
              key={label}
              onClick={() => setPageSettings({ widthMm: w, heightMm: h })}
              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
