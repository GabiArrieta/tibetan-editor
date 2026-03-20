/**
 * ImportAssistant — modal for bulk text import.
 *
 * The user pastes three text blocks (one per lane). The assistant:
 * 1. Splits each block by newlines
 * 2. Shows a preview table with imbalance warnings
 * 3. On confirm, inserts the rows into the document (new block or selected block)
 */

import React, { useState, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useDocumentStore } from '../../store/documentStore'
import { buildImportPreview, previewToRows } from '../../lib/operations/importParser'
import { Button } from '../shared/Button'
import { v4 as uuid } from 'uuid'
import type { Block } from '../../types/document'
import { DEFAULT_BLOCK_LAYOUT } from '../../types/document'

export function ImportAssistant() {
  const isOpen = useEditorStore(s => s.importAssistantOpen)
  const setOpen = useEditorStore(s => s.setImportAssistantOpen)
  const addBlock = useDocumentStore(s => s.addBlock)
  const doc = useDocumentStore(s => s.document)
  const loadDocument = useDocumentStore(s => s.loadDocument)

  const [tibetan, setTibetan] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [translation, setTranslation] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [targetMode, setTargetMode] = useState<'new-block' | 'append-last'>('new-block')

  const preview = showPreview ? buildImportPreview({ tibetan, phonetic, translation }) : null

  const handlePreview = useCallback(() => {
    if (!tibetan && !phonetic && !translation) return
    setShowPreview(true)
  }, [tibetan, phonetic, translation])

  const handleConfirm = useCallback(() => {
    if (!preview) return
    const rows = previewToRows(preview.rows)

    const updatedDoc = { ...doc }
    if (targetMode === 'new-block') {
      const newBlock: Block = {
        id: uuid(),
        rows,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
      }
      updatedDoc.blocks = [...doc.blocks, newBlock]
    } else {
      const blocks = [...doc.blocks]
      const lastBlock = { ...blocks[blocks.length - 1] }
      lastBlock.rows = [...lastBlock.rows, ...rows]
      blocks[blocks.length - 1] = lastBlock
      updatedDoc.blocks = blocks
    }

    loadDocument(updatedDoc)
    setOpen(false)
    setTibetan('')
    setPhonetic('')
    setTranslation('')
    setShowPreview(false)
  }, [preview, doc, loadDocument, targetMode, setOpen])

  const handleClose = () => {
    setOpen(false)
    setShowPreview(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[780px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <h2 className="text-white font-semibold text-base">Importar texto</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!showPreview ? (
            <>
              <p className="text-slate-400 text-sm">
                Pegá cada bloque de texto en su campo correspondiente. El sistema dividirá cada bloque
                por saltos de línea y creará una fila sincronizada por línea.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: 'Tibetano', value: tibetan, setter: setTibetan, hint: 'Texto tibetano unicode' },
                  { label: 'Fonética', value: phonetic, setter: setPhonetic, hint: 'Transliteración fonética' },
                  { label: 'Traducción', value: translation, setter: setTranslation, hint: 'Texto traducido' },
                ].map(({ label, value, setter, hint }) => (
                  <label key={label} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-300">{label}</span>
                    <textarea
                      value={value}
                      onChange={e => setter(e.target.value)}
                      placeholder={hint}
                      rows={10}
                      className="bg-slate-700 text-white text-sm rounded px-2 py-1.5 border border-slate-600 focus:border-indigo-400 outline-none resize-none font-mono leading-relaxed"
                      spellCheck={label !== 'Tibetano'}
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Destino:</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="radio" value="new-block" checked={targetMode === 'new-block'}
                    onChange={() => setTargetMode('new-block')} className="accent-indigo-500" />
                  Nuevo bloque
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="radio" value="append-last" checked={targetMode === 'append-last'}
                    onChange={() => setTargetMode('append-last')} className="accent-indigo-500" />
                  Agregar al último bloque
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Preview table */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium text-sm">
                    Vista previa — {preview!.rows.length} fila(s)
                  </h3>
                  {preview!.hasImbalance && (
                    <p className="text-amber-400 text-xs mt-0.5">
                      ⚠ Los bloques tienen distinto número de líneas. Las filas con faltantes se marcan en naranja.
                    </p>
                  )}
                  <p className="text-slate-500 text-xs mt-0.5">
                    Tibetano: {preview!.counts.tibetan} líneas · Fonética: {preview!.counts.phonetic} · Traducción: {preview!.counts.translation}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(false)}>
                  ← Editar
                </Button>
              </div>

              <div className="overflow-auto max-h-[45vh] rounded border border-slate-600">
                <table className="w-full text-xs">
                  <thead className="bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-slate-400 font-medium w-6">#</th>
                      <th className="px-2 py-1.5 text-left text-slate-400 font-medium">Tibetano</th>
                      <th className="px-2 py-1.5 text-left text-slate-400 font-medium">Fonética</th>
                      <th className="px-2 py-1.5 text-left text-slate-400 font-medium">Traducción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview!.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={[
                          'border-t border-slate-700',
                          row.hasImbalance ? 'bg-amber-900/20' : 'bg-slate-800 hover:bg-slate-750',
                        ].join(' ')}
                      >
                        <td className="px-2 py-1 text-slate-600">{i + 1}</td>
                        <td className="px-2 py-1 text-slate-200 font-mono max-w-[200px] truncate">{row.tibetan || <em className="text-slate-600">vacío</em>}</td>
                        <td className="px-2 py-1 text-slate-300 max-w-[200px] truncate">{row.phonetic || <em className="text-slate-600">vacío</em>}</td>
                        <td className="px-2 py-1 text-slate-300 max-w-[200px] truncate">{row.translation || <em className="text-slate-600">vacío</em>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          {!showPreview ? (
            <Button variant="primary" onClick={handlePreview} disabled={!tibetan && !phonetic && !translation}>
              Vista previa →
            </Button>
          ) : (
            <Button variant="primary" onClick={handleConfirm}>
              Confirmar importación ({preview?.rows.length} filas)
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
