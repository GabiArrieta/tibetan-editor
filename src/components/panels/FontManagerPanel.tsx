/**
 * FontManagerPanel — right panel tab for managing custom fonts.
 *
 * Allows the user to:
 * - Upload font files (.ttf, .otf, .woff, .woff2)
 * - Assign a role (tibetan / phonetic / translation)
 * - Preview the font
 * - Delete a font
 * - See which fonts are missing from IndexedDB
 */

import React, { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useDocumentStore } from '../../store/documentStore'
import { useFontStore } from '../../store/fontStore'
import { handleFontUpload, unloadFont } from '../../lib/fonts/fontLoader'
import { deleteFontBinary } from '../../lib/fonts/fontStorage'
import { Button } from '../shared/Button'
import type { FontRole } from '../../types/document'

const ROLE_LABELS: Record<FontRole, string> = {
  tibetan: 'Tibetano',
  phonetic: 'Fonética',
  translation: 'Traducción',
  ui: 'Interfaz',
}

const TIBETAN_PREVIEW = 'བཀྲ་ཤིས་བདེ་ལེགས།'
const PHONETIC_PREVIEW = 'tashi delek'
const TRANSLATION_PREVIEW = 'Que haya auspicio y bienestar'

function previewText(role: FontRole): string {
  if (role === 'tibetan') return TIBETAN_PREVIEW
  if (role === 'phonetic') return PHONETIC_PREVIEW
  return TRANSLATION_PREVIEW
}

export function FontManagerPanel() {
  const doc = useDocumentStore(s => s.document)
  const addFont = useDocumentStore(s => s.addFont)
  const removeFont = useDocumentStore(s => s.removeFont)
  const loadedFonts = useFontStore(s => s.loadedFonts)
  const missingFontIds = useFontStore(s => s.missingFontIds)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedRole, setSelectedRole] = useState<FontRole>('tibetan')
  const [familyName, setFamilyName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleUploadClick = () => {
    setUploadError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)

    const result = await handleFontUpload(file, selectedRole, familyName || undefined)

    if ('error' in result) {
      setUploadError(result.error)
    } else {
      addFont(result.entry)
      setFamilyName('')
    }

    setUploading(false)
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteFont = async (fontId: string, storageKey: string) => {
    unloadFont(fontId)
    await deleteFontBinary(storageKey)
    removeFont(fontId)
  }

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto custom-scrollbar">
      {/* Upload section */}
      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Agregar fuente</h3>

        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wide block mb-0.5">Rol</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as FontRole)}
              className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-400 outline-none"
            >
              {(Object.keys(ROLE_LABELS) as FontRole[]).map(role => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wide block mb-0.5">
              Nombre de familia (opcional)
            </label>
            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="Se deduce del archivo si se deja vacío"
              className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 focus:border-indigo-400 outline-none"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleUploadClick}
            disabled={uploading}
            className="w-full justify-center"
          >
            {uploading ? 'Cargando…' : 'Seleccionar archivo .ttf/.otf/.woff'}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={handleFileChange}
          />

          {uploadError && (
            <p className="text-red-400 text-xs">{uploadError}</p>
          )}
        </div>

        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          Los archivos se guardan localmente en tu navegador (IndexedDB).
          No se redistribuyen ni se incluyen en el archivo JSON del proyecto.
        </p>
      </section>

      {/* Missing fonts warning */}
      {missingFontIds.length > 0 && (
        <section className="bg-amber-900/30 border border-amber-700/50 rounded p-2">
          <h3 className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Fuentes faltantes</h3>
          <p className="text-xs text-amber-300 leading-relaxed">
            {missingFontIds.length} fuente(s) del proyecto no se encontraron en el almacenamiento local.
            Reimportá los archivos para restaurarlas.
          </p>
          {missingFontIds.map(id => {
            const entry = doc.fontRegistry.find(f => f.id === id)
            return entry ? (
              <p key={id} className="text-xs text-amber-200 mt-1">— {entry.fileName} ({entry.family})</p>
            ) : null
          })}
        </section>
      )}

      {/* Registered fonts */}
      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">
          Fuentes registradas ({doc.fontRegistry.length})
        </h3>
        {doc.fontRegistry.length === 0 ? (
          <p className="text-xs text-slate-500">No hay fuentes registradas. Cargá un archivo arriba.</p>
        ) : (
          <div className="space-y-3">
            {doc.fontRegistry.map(entry => {
              const isLoaded = !!loadedFonts[entry.id]
              const isMissing = missingFontIds.includes(entry.id)
              return (
                <div
                  key={entry.id}
                  className="bg-slate-700/50 rounded p-2 border border-slate-600/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{entry.family}</p>
                      <p className="text-[10px] text-slate-400">{entry.fileName} · {entry.format.toUpperCase()} · {ROLE_LABELS[entry.role]}</p>
                      {isMissing && (
                        <p className="text-[10px] text-amber-400 mt-0.5">⚠ Archivo no encontrado en almacenamiento local</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteFont(entry.id, entry.storageKey)}
                      className="text-red-400 hover:text-red-300 text-[10px] shrink-0 transition-colors"
                      title="Eliminar fuente"
                    >
                      Eliminar
                    </button>
                  </div>

                  {/* Font preview */}
                  {isLoaded && (
                    <div
                      className="mt-2 text-sm text-slate-200 bg-white/5 rounded px-2 py-1.5 border border-white/10"
                      style={{ fontFamily: entry.family }}
                    >
                      {previewText(entry.role)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Notes on PDF export */}
      <section>
        <h3 className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Notas sobre exportación PDF</h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          El PDF embebe un subset de la fuente. Solo TTF y WOFF son soportados
          con plena fidelidad por el motor PDF. Los archivos OTF pueden tener
          compatibilidad reducida. Si usás una fuente OTF y el PDF no muestra
          los glifos correctamente, convertí la fuente a TTF primero.
        </p>
      </section>
    </div>
  )
}
