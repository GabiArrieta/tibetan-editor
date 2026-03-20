/**
 * TopBar — barra de herramientas principal.
 *
 * Incluye: archivo local, nube, exportación, importación, zoom,
 * indicador de usuario autenticado y estado de sync.
 */

import React, { useState, useCallback } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { useAuthStore } from '../../store/authStore'
import { useCloudStore } from '../../store/cloudStore'
import { saveProjectToFile, loadProjectFromFile } from '../../lib/persistence/projectIO'
import { exportToPdf } from '../../lib/pdf/pdfExport'
import { exportToDocx } from '../../lib/docx/docxExport'
import { loadFontsForDocument } from '../../lib/fonts/fontLoader'
import { saveDocumentToCloud } from '../../lib/supabase/cloudSync'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { Button } from '../shared/Button'

export function TopBar() {
  const doc = useDocumentStore(s => s.document)
  const loadDocument = useDocumentStore(s => s.loadDocument)
  const newDocument = useDocumentStore(s => s.newDocument)

  const isDirty = useEditorStore(s => s.isDirty)
  const setDirty = useEditorStore(s => s.setDirty)
  const setImportAssistantOpen = useEditorStore(s => s.setImportAssistantOpen)
  const zoom = useEditorStore(s => s.zoom)
  const setZoom = useEditorStore(s => s.setZoom)
  const setRightPanelTab = useEditorStore(s => s.setRightPanelTab)

  const user = useAuthStore(s => s.user)
  const status = useAuthStore(s => s.status)
  const signOut = useAuthStore(s => s.signOut)

  const syncStatus = useCloudStore(s => s.syncStatus)
  const lastCloudSave = useCloudStore(s => s.lastCloudSave)
  const setSyncStatus = useCloudStore(s => s.setSyncStatus)
  const setLastCloudSave = useCloudStore(s => s.setLastCloudSave)
  const setAuthModalOpen = useCloudStore(s => s.setAuthModalOpen)
  const setDocumentBrowserOpen = useCloudStore(s => s.setDocumentBrowserOpen)

  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // ── Local file actions ───────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    saveProjectToFile(doc)
    setDirty(false)
  }, [doc, setDirty])

  const handleLoad = useCallback(async () => {
    try {
      const loaded = await loadProjectFromFile()
      loadDocument(loaded)
      await loadFontsForDocument()
      setDirty(false)
    } catch (err) {
      alert('No se pudo cargar el archivo.')
    }
  }, [loadDocument, setDirty])

  const handleNewDocument = useCallback(() => {
    if (isDirty && !confirm('Hay cambios sin guardar. ¿Crear nuevo documento?')) return
    newDocument()
    setDirty(false)
  }, [isDirty, newDocument, setDirty])

  // ── Cloud actions ────────────────────────────────────────────────────────

  const handleCloudSave = useCallback(async () => {
    if (!user) { setAuthModalOpen(true); return }
    setSyncStatus('saving')
    const result = await saveDocumentToCloud(doc)
    if (result.error) {
      setSyncStatus('error')
      alert(`Error al guardar en nube: ${result.error}`)
    } else {
      setLastCloudSave(result.data!.savedAt, result.data!.cloudId)
      setDirty(false)
    }
  }, [doc, user, setSyncStatus, setLastCloudSave, setAuthModalOpen, setDirty])

  const handleOpenBrowser = useCallback(() => {
    if (!user) { setAuthModalOpen(true); return }
    setDocumentBrowserOpen(true)
  }, [user, setAuthModalOpen, setDocumentBrowserOpen])

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true)
    setExportStatus('Generando PDF…')
    try {
      await exportToPdf(doc, { onProgress: setExportStatus })
      setExportStatus('PDF exportado')
      setTimeout(() => setExportStatus(null), 3000)
    } catch {
      setExportStatus('Error en exportación')
      setTimeout(() => setExportStatus(null), 4000)
    } finally {
      setIsExporting(false)
    }
  }, [doc])

  const handleExportDocx = useCallback(async () => {
    setIsExporting(true)
    setExportStatus('Generando DOCX…')
    try {
      await exportToDocx(doc)
      setExportStatus('DOCX exportado')
      setTimeout(() => setExportStatus(null), 3000)
    } catch {
      setExportStatus('Error en exportación')
      setTimeout(() => setExportStatus(null), 4000)
    } finally {
      setIsExporting(false)
    }
  }, [doc])

  // ── Sync status indicator ────────────────────────────────────────────────

  const syncLabel = syncStatus === 'saving' ? '☁ Guardando…'
    : syncStatus === 'saved' ? `☁ Guardado ${lastCloudSave ? new Date(lastCloudSave).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}`
    : syncStatus === 'error' ? '☁ Error'
    : null

  return (
    <header className="h-11 bg-slate-900 border-b border-slate-700/50 flex items-center px-3 gap-1.5 shrink-0 z-10 overflow-x-auto">

      {/* Brand */}
      <span className="text-indigo-400 font-semibold text-sm shrink-0 mr-1">Tibetan Editor</span>

      {/* ── Local file ── */}
      <Button size="sm" variant="ghost" onClick={handleNewDocument}>Nuevo</Button>
      <Button size="sm" variant="ghost" onClick={handleLoad}>Abrir</Button>
      <Button size="sm" variant="ghost" onClick={handleSave}>
        Guardar{isDirty ? ' *' : ''}
      </Button>

      <div className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />

      {/* ── Nube ── */}
      {isSupabaseConfigured ? (
        <>
          <Button
            size="sm"
            variant={syncStatus === 'error' ? 'danger' : 'ghost'}
            onClick={handleCloudSave}
            disabled={syncStatus === 'saving'}
            title="Guardar en la nube"
          >
            {syncStatus === 'saving' ? '☁ …' : '☁ Guardar nube'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleOpenBrowser} title="Mis documentos en la nube">
            ☁ Mis docs
          </Button>
          {syncLabel && (
            <span className={`text-[11px] shrink-0 ${syncStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
              {syncLabel}
            </span>
          )}
          <div className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />
        </>
      ) : null}

      {/* ── Import ── */}
      <Button size="sm" variant="ghost" onClick={() => setImportAssistantOpen(true)}>
        Importar
      </Button>

      <div className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />

      {/* ── Export ── */}
      <Button size="sm" variant="secondary" onClick={handleExportPdf} disabled={isExporting}>PDF</Button>
      <Button size="sm" variant="secondary" onClick={handleExportDocx} disabled={isExporting}>DOCX</Button>
      {exportStatus && <span className="text-xs text-slate-400 shrink-0">{exportStatus}</span>}

      <div className="flex-1" />

      {/* ── Document title ── */}
      <span className="text-sm text-slate-300 truncate max-w-[180px] shrink-0" title={doc.title}>
        {doc.title}{isDirty ? ' ●' : ''}
      </span>

      <div className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />

      {/* ── Fonts ── */}
      <Button size="sm" variant="ghost" onClick={() => setRightPanelTab('fonts')}>Fuentes</Button>

      <div className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />

      {/* ── Zoom ── */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={() => setZoom(zoom - 0.1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">−</button>
        <button onClick={() => setZoom(1.0)} className="text-xs text-slate-400 hover:text-white min-w-[44px] text-center">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(zoom + 0.1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">+</button>
      </div>

      {/* ── Usuario ── */}
      {isSupabaseConfigured && (
        <>
          <div className="w-px h-5 bg-slate-700 mx-0.5 shrink-0" />
          {status === 'authenticated' && user ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                {user.email}
              </span>
              <Button size="sm" variant="ghost" onClick={signOut}>Salir</Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAuthModalOpen(true)}
            >
              Iniciar sesión
            </Button>
          )}
        </>
      )}
    </header>
  )
}
