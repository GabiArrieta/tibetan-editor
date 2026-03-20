/**
 * fontCloudStorage — almacenamiento de fuentes custom en Supabase Storage.
 *
 * ADVERTENCIA DE LICENCIA:
 * Las fuentes comerciales tienen restricciones de distribución.
 * Al subir una fuente a la nube, sos responsable de cumplir con su licencia.
 * Esta funcionalidad es OPT-IN: el usuario debe aceptar explícitamente
 * que tiene derecho a compartir el archivo antes de subirlo.
 *
 * Estructura en Supabase Storage:
 *   bucket: "fonts"
 *   ruta:   {user_id}/{font_storage_key}.{format}
 *
 * Cada usuario tiene su propio "folder" aislado por RLS.
 * Los colaboradores acceden a las fuentes del dueño del documento
 * a través de signed URLs generadas on-demand.
 */

import { supabase } from './client'
import type { FontEntry } from '../../types/document'

const BUCKET = 'fonts'
const SIGNED_URL_EXPIRY = 3600  // 1 hora

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Subir una fuente a Supabase Storage.
 * Solo se ejecuta si el usuario acepta explícitamente el aviso de licencia.
 */
export async function uploadFontToCloud(
  buffer: ArrayBuffer,
  entry: FontEntry,
  userId: string
): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const path = `${userId}/${entry.storageKey}.${entry.format}`
  const mimeType = fontMime(entry.format)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) return { error: error.message }
  return { url: path }
}

/**
 * Obtener una signed URL temporal para acceder a una fuente.
 * Los colaboradores usan esto para descargar fuentes del dueño del documento.
 */
export async function getFontSignedUrl(
  ownerUserId: string,
  storageKey: string,
  format: string
): Promise<{ signedUrl?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const path = `${ownerUserId}/${storageKey}.${format}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl }
}

/**
 * Descargar una fuente de Supabase Storage como ArrayBuffer.
 * Útil para inyectarla en CSS o en el motor PDF.
 */
export async function downloadFontFromCloud(
  ownerUserId: string,
  entry: FontEntry
): Promise<{ buffer?: ArrayBuffer; error?: string }> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const path = `${ownerUserId}/${entry.storageKey}.${entry.format}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path)

  if (error) return { error: error.message }

  const buffer = await data.arrayBuffer()
  return { buffer }
}

/**
 * Eliminar una fuente de Supabase Storage.
 */
export async function deleteFontFromCloud(
  userId: string,
  storageKey: string,
  format: string
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const path = `${userId}/${storageKey}.${format}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  if (error) return { error: error.message }
  return {}
}

/**
 * Comprobar si una fuente existe en Supabase Storage.
 */
export async function fontExistsInCloud(
  userId: string,
  storageKey: string,
  format: string
): Promise<boolean> {
  if (!supabase) return false

  const path = `${userId}/${storageKey}.${format}`
  const { data } = await supabase.storage.from(BUCKET).list(userId, {
    search: `${storageKey}.${format}`,
  })

  return (data ?? []).some(f => f.name === `${storageKey}.${format}`)
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fontMime(format: string): string {
  const map: Record<string, string> = {
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
  }
  return map[format] ?? 'application/octet-stream'
}
