/**
 * LeftSidebar — document structure tree + special page controls.
 *
 * Shows: project name, Document structure (Blocks → Rows).
 * Allows: selecting blocks/rows, adding/removing/moving blocks,
 * adding cover page and back page.
 */

import React, { useState } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useCommentStore } from '../../store/commentStore'

export function LeftSidebar() {
  const doc = useDocumentStore(s => s.document)
  const addBlock = useDocumentStore(s => s.addBlock)
  const addCoverBlock = useDocumentStore(s => s.addCoverBlock)
  const addBackBlock = useDocumentStore(s => s.addBackBlock)
  const removeBlock = useDocumentStore(s => s.removeBlock)
  const moveBlock = useDocumentStore(s => s.moveBlock)
  const addRowToBlock = useDocumentStore(s => s.addRowToBlock)
  const selectedRow = useEditorStore(s => s.selectedRow)
  const selectRow = useEditorStore(s => s.selectRow)
  const activeProject = useProjectStore(s => s.getActiveProject())
  const commentPanel = useCommentStore(s => s.panelOpen)
  const setPanelOpen = useCommentStore(s => s.setPanelOpen)
  const openCommentCount = useCommentStore(s => {
    const all = s.commentsByDoc[doc.id] ?? []
    return all.filter(c => c.status === 'open').length
  })

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

  const hasCover = doc.blocks.some(b => b.blockType === 'cover')
  const hasBack = doc.blocks.some(b => b.blockType === 'back')

  const BLOCK_TYPE_ICONS: Record<string, string> = {
    cover: '◱',
    back: '◳',
    content: '≡',
    'section-heading': '§',
    index: '☰',
  }

  return (
    <aside className="w-52 bg-slate-900 border-r border-slate-700/50 flex flex-col min-h-0">
      {/* Project name header */}
      {activeProject && (
        <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-1">
          <span className="text-[10px] text-indigo-400 font-medium truncate flex-1" title={activeProject.name}>
            {activeProject.name}
          </span>
        </div>
      )}

      {/* Estructura header */}
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Estructura</span>
        <div className="flex items-center gap-1">
          {!hasCover && (
            <button
              onClick={() => addCoverBlock()}
              className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px]"
              title="Agregar portada"
            >
              ◱
            </button>
          )}
          <button
            onClick={() => addBlock()}
            className="text-slate-400 hover:text-indigo-400 transition-colors text-xs"
            title="Agregar bloque de contenido"
          >
            +
          </button>
          {!hasBack && (
            <button
              onClick={() => addBackBlock()}
              className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px]"
              title="Agregar página final"
            >
              ◳
            </button>
          )}
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {doc.blocks.map((block, blockIdx) => {
          const effectiveType = block.blockType ?? 'content'
          const icon = BLOCK_TYPE_ICONS[effectiveType] ?? '≡'
          const isSpecial = effectiveType !== 'content'
          return (
            <div key={block.id} className="select-none">
              {/* Block header */}
              <div
                className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 group cursor-pointer"
                onClick={() => !isSpecial && toggleBlock(block.id)}
              >
                <span className="text-slate-500 text-[10px] w-3 shrink-0">
                  {isSpecial ? icon : expandedBlocks.has(block.id) ? '▾' : '▸'}
                </span>
                <span className={[
                  'text-xs flex-1 truncate',
                  isSpecial ? 'text-slate-400 italic' : 'text-slate-300',
                ].join(' ')}>
                  {block.label || `Bloque ${blockIdx + 1}`}
                </span>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                  {!isSpecial && (
                    <>
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
                    </>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeBlock(block.id) }}
                    className="text-red-500 hover:text-red-400 text-[10px] px-0.5"
                    title="Eliminar bloque"
                  >×</button>
                </div>
              </div>

              {/* Row list (content blocks only) */}
              {!isSpecial && expandedBlocks.has(block.id) && (
                <div className="pl-5">
                  {block.rows.map((row, rowIdx) => {
                    const isSel = selectedRow?.rowId === row.id && selectedRow.blockId === block.id
                    const preview = row.tibetan.text.slice(0, 20) || row.translation.text.slice(0, 20) || '(vacío)'
                    return (
                      <button
                        key={row.id}
                        onClick={() => selectRow({ blockId: block.id, rowId: row.id })}
                        className={[
                          'w-full text-left px-2 py-0.5 text-[11px] truncate transition-colors',
                          isSel
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
          )
        })}
      </div>

      {/* Footer: stats + comments toggle */}
      <div className="px-3 py-1.5 border-t border-slate-700/50 flex items-center justify-between">
        <p className="text-[10px] text-slate-600">
          {doc.blocks.filter(b => !b.blockType || b.blockType === 'content').length} bloque(s) · {doc.blocks.reduce((acc, b) => acc + b.rows.length, 0)} filas
        </p>
        <button
          onClick={() => setPanelOpen(!commentPanel)}
          className={[
            'text-[10px] px-1.5 py-0.5 rounded transition-colors',
            commentPanel ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400',
          ].join(' ')}
          title="Comentarios"
        >
          {openCommentCount > 0 ? `✎ ${openCommentCount}` : '✎'}
        </button>
      </div>
    </aside>
  )
}
