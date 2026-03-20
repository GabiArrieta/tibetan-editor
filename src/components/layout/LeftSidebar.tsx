/**
 * LeftSidebar — document structure tree.
 *
 * Shows a hierarchical list: Document → Blocks → Rows
 * Allows selecting, adding, removing and moving blocks.
 */

import React, { useState } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { Button } from '../shared/Button'

export function LeftSidebar() {
  const doc = useDocumentStore(s => s.document)
  const addBlock = useDocumentStore(s => s.addBlock)
  const removeBlock = useDocumentStore(s => s.removeBlock)
  const moveBlock = useDocumentStore(s => s.moveBlock)
  const addRowToBlock = useDocumentStore(s => s.addRowToBlock)
  const selectedRow = useEditorStore(s => s.selectedRow)
  const selectRow = useEditorStore(s => s.selectRow)

  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(
    new Set(doc.blocks.map(b => b.id))
  )

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      next.has(blockId) ? next.delete(blockId) : next.add(blockId)
      return next
    })
  }

  return (
    <aside className="w-52 bg-slate-900 border-r border-slate-700/50 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Estructura</span>
        <button
          onClick={() => addBlock()}
          className="text-slate-400 hover:text-indigo-400 transition-colors text-xs"
          title="Agregar bloque"
        >
          + bloque
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {doc.blocks.map((block, blockIdx) => (
          <div key={block.id} className="select-none">
            {/* Block header */}
            <div
              className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 group cursor-pointer"
              onClick={() => toggleBlock(block.id)}
            >
              <span className="text-slate-500 text-[10px] w-3 shrink-0">
                {expandedBlocks.has(block.id) ? '▾' : '▸'}
              </span>
              <span className="text-xs text-slate-300 flex-1 truncate">
                {block.label || `Bloque ${blockIdx + 1}`}
              </span>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); moveBlock(block.id, 'up') }}
                  className="text-slate-500 hover:text-white text-[10px] px-0.5"
                  title="Subir bloque"
                >↑</button>
                <button
                  onClick={e => { e.stopPropagation(); moveBlock(block.id, 'down') }}
                  className="text-slate-500 hover:text-white text-[10px] px-0.5"
                  title="Bajar bloque"
                >↓</button>
                <button
                  onClick={e => { e.stopPropagation(); removeBlock(block.id) }}
                  className="text-red-500 hover:text-red-400 text-[10px] px-0.5"
                  title="Eliminar bloque"
                >×</button>
              </div>
            </div>

            {/* Row list */}
            {expandedBlocks.has(block.id) && (
              <div className="pl-5">
                {block.rows.map((row, rowIdx) => {
                  const isSelected = selectedRow?.rowId === row.id && selectedRow.blockId === block.id
                  const preview = row.tibetan.text.slice(0, 20) || row.translation.text.slice(0, 20) || '(vacío)'
                  return (
                    <button
                      key={row.id}
                      onClick={() => selectRow({ blockId: block.id, rowId: row.id })}
                      className={[
                        'w-full text-left px-2 py-0.5 text-[11px] truncate transition-colors',
                        isSelected
                          ? 'bg-indigo-600/30 text-indigo-300'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                      ].join(' ')}
                    >
                      <span className="text-slate-600 mr-1">{rowIdx + 1}.</span>
                      {preview}
                    </button>
                  )
                })}

                <button
                  onClick={() => addRowToBlock(block.id)}
                  className="w-full text-left px-2 py-0.5 text-[10px] text-slate-600 hover:text-indigo-400 transition-colors"
                >
                  + fila
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="px-3 py-1.5 border-t border-slate-700/50">
        <p className="text-[10px] text-slate-600">
          {doc.blocks.length} bloque(s) · {doc.blocks.reduce((acc, b) => acc + b.rows.length, 0)} filas
        </p>
      </div>
    </aside>
  )
}
