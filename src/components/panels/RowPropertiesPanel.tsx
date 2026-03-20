/**
 * RowPropertiesPanel — right panel tab for editing the selected row's layout and style.
 */

import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useDocumentStore } from '../../store/documentStore'
import { NumberInput } from '../shared/NumberInput'
import { Button } from '../shared/Button'
import type { LaneKey } from '../../types/document'

const LANES: { key: LaneKey; label: string }[] = [
  { key: 'tibetan', label: 'Tibetano' },
  { key: 'phonetic', label: 'Fonética' },
  { key: 'translation', label: 'Traducción' },
]

export function RowPropertiesPanel() {
  const selectedRow = useEditorStore(s => s.selectedRow)
  const doc = useDocumentStore(s => s.document)
  const updateRowLayout = useDocumentStore(s => s.updateRowLayout)
  const updateLaneStyle = useDocumentStore(s => s.updateLaneStyle)
  const duplicateRow = useDocumentStore(s => s.duplicateRow)
  const removeRow = useDocumentStore(s => s.removeRow)
  const moveRow = useDocumentStore(s => s.moveRow)
  const splitRow = useDocumentStore(s => s.splitRow)

  if (!selectedRow) {
    return (
      <div className="p-4 text-slate-500 text-sm text-center mt-8">
        Seleccioná una fila para ver sus propiedades.
      </div>
    )
  }

  const { blockId, rowId } = selectedRow
  const block = doc.blocks.find(b => b.id === blockId)
  const row = block?.rows.find(r => r.id === rowId)

  if (!row) return null

  const { layout } = row

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto custom-scrollbar">
      {/* Row actions */}
      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Acciones</h3>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => duplicateRow(blockId, rowId)}>
            Duplicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => moveRow(blockId, rowId, 'up')}>
            ↑ Subir
          </Button>
          <Button size="sm" variant="ghost" onClick={() => moveRow(blockId, rowId, 'down')}>
            ↓ Bajar
          </Button>
          <Button size="sm" variant="danger" onClick={() => removeRow(blockId, rowId)}>
            Eliminar
          </Button>
        </div>
      </section>

      {/* Layout */}
      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Layout de fila</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Gap tibetano"
            value={layout.gapAfterTibetanPt}
            onChange={v => updateRowLayout(blockId, rowId, { gapAfterTibetanPt: v })}
            min={0} step={0.5} unit="pt"
          />
          <NumberInput
            label="Gap fonética"
            value={layout.gapAfterPhoneticPt}
            onChange={v => updateRowLayout(blockId, rowId, { gapAfterPhoneticPt: v })}
            min={0} step={0.5} unit="pt"
          />
          <NumberInput
            label="Margen superior"
            value={layout.marginTopPt}
            onChange={v => updateRowLayout(blockId, rowId, { marginTopPt: v })}
            min={0} step={0.5} unit="pt"
          />
          <NumberInput
            label="Margen inferior"
            value={layout.marginBottomPt}
            onChange={v => updateRowLayout(blockId, rowId, { marginBottomPt: v })}
            min={0} step={0.5} unit="pt"
          />
          <NumberInput
            label="Padding izq."
            value={layout.paddingLeftPt}
            onChange={v => updateRowLayout(blockId, rowId, { paddingLeftPt: v })}
            min={0} step={0.5} unit="pt"
          />
          <NumberInput
            label="Sangría"
            value={layout.indentationPt}
            onChange={v => updateRowLayout(blockId, rowId, { indentationPt: v })}
            min={0} step={0.5} unit="pt"
          />
          <NumberInput
            label="Offset X"
            value={layout.offsetXPt}
            onChange={v => updateRowLayout(blockId, rowId, { offsetXPt: v })}
            step={0.5} unit="pt"
          />
          <NumberInput
            label="Offset Y"
            value={layout.offsetYPt}
            onChange={v => updateRowLayout(blockId, rowId, { offsetYPt: v })}
            step={0.5} unit="pt"
          />
        </div>

        <label className="flex items-center gap-2 mt-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={layout.keepTogether}
            onChange={e => updateRowLayout(blockId, rowId, { keepTogether: e.target.checked })}
            className="accent-indigo-500"
          />
          Mantener unido (evitar corte de página)
        </label>
      </section>

      {/* Per-lane typography */}
      {LANES.map(({ key, label }) => (
        <section key={key}>
          <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">{label}</h3>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Tamaño"
              value={row[key].style.fontSize}
              onChange={v => updateLaneStyle(blockId, rowId, key, { fontSize: v })}
              min={4} max={120} step={0.5} unit="pt"
            />
            <NumberInput
              label="Interlineado"
              value={row[key].style.lineHeight}
              onChange={v => updateLaneStyle(blockId, rowId, key, { lineHeight: v })}
              min={0.8} max={4} step={0.05}
            />
            <NumberInput
              label="Espaciado letras"
              value={row[key].style.letterSpacing ?? 0}
              onChange={v => updateLaneStyle(blockId, rowId, key, { letterSpacing: v })}
              step={0.1} unit="pt"
            />
          </div>
          <label className="flex flex-col gap-0.5 mt-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Fuente</span>
            <input
              type="text"
              value={row[key].style.fontFamily}
              onChange={e => updateLaneStyle(blockId, rowId, key, { fontFamily: e.target.value })}
              className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-400 outline-none"
              placeholder="font-family"
            />
          </label>
        </section>
      ))}
    </div>
  )
}
