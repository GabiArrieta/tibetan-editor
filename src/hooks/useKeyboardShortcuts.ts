/**
 * useKeyboardShortcuts — global keyboard shortcut handler.
 *
 * Binds document-level keyboard shortcuts for editor operations.
 * Lane-level shortcuts (Enter, Tab) are handled within LaneEditor.
 *
 * Shortcuts:
 *   Ctrl+S         Save project to file
 *   Ctrl+P         Export PDF
 *   Ctrl+I         Open import assistant
 *   Ctrl+D         Duplicate selected row
 *   Ctrl+Delete    Delete selected row
 *   Alt+↑          Move selected row up
 *   Alt+↓          Move selected row down
 *   Ctrl++         Zoom in
 *   Ctrl+-         Zoom out
 *   Ctrl+0         Reset zoom
 */

import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useDocumentStore } from '../store/documentStore'
import { saveProjectToFile } from '../lib/persistence/projectIO'
import { exportToPdf } from '../lib/pdf/pdfExport'
import { exportToDocx } from '../lib/docx/docxExport'

interface ShortcutOptions {
  onSaveComplete?: () => void
  onExportStart?: () => void
  onExportComplete?: () => void
  onError?: (err: Error) => void
}

export function useKeyboardShortcuts(options: ShortcutOptions = {}) {
  const doc = useDocumentStore(s => s.document)
  const selectedRow = useEditorStore(s => s.selectedRow)
  const duplicateRow = useDocumentStore(s => s.duplicateRow)
  const removeRow = useDocumentStore(s => s.removeRow)
  const moveRow = useDocumentStore(s => s.moveRow)
  const setImportAssistantOpen = useEditorStore(s => s.setImportAssistantOpen)
  const setZoom = useEditorStore(s => s.setZoom)
  const zoom = useEditorStore(s => s.zoom)
  const setDirty = useEditorStore(s => s.setDirty)

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+S — save
      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        saveProjectToFile(doc)
        setDirty(false)
        options.onSaveComplete?.()
        return
      }

      // Ctrl+P — export PDF
      if (ctrl && e.key === 'p') {
        e.preventDefault()
        options.onExportStart?.()
        try {
          await exportToPdf(doc, {
            onProgress: (stage) => console.log('[PDF]', stage),
          })
          options.onExportComplete?.()
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
        return
      }

      // Ctrl+I — import assistant
      if (ctrl && e.key === 'i') {
        e.preventDefault()
        setImportAssistantOpen(true)
        return
      }

      // Row-level shortcuts require a selected row
      if (!selectedRow) return
      const { blockId, rowId } = selectedRow

      // Ctrl+D — duplicate row
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        duplicateRow(blockId, rowId)
        return
      }

      // Ctrl+Delete — delete row
      if (ctrl && e.key === 'Delete') {
        e.preventDefault()
        removeRow(blockId, rowId)
        return
      }

      // Alt+↑ — move row up
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        moveRow(blockId, rowId, 'up')
        return
      }

      // Alt+↓ — move row down
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        moveRow(blockId, rowId, 'down')
        return
      }

      // Ctrl++ or Ctrl+= — zoom in
      if (ctrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setZoom(zoom + 0.1)
        return
      }

      // Ctrl+- — zoom out
      if (ctrl && e.key === '-') {
        e.preventDefault()
        setZoom(zoom - 0.1)
        return
      }

      // Ctrl+0 — reset zoom
      if (ctrl && e.key === '0') {
        e.preventDefault()
        setZoom(1.0)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doc, selectedRow, zoom, duplicateRow, removeRow, moveRow, setImportAssistantOpen, setZoom, setDirty, options])
}
