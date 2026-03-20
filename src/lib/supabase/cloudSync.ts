/**
 * cloudSync — sincronización de documentos con Supabase.
 *
 * Operaciones:
 * - saveDocument      : crea o actualiza un documento en la nube
 * - loadDocument      : carga el contenido completo de un documento
 * - listDocuments     : lista todos los documentos accesibles del usuario
 * - deleteDocument    : elimina un documento (solo el dueño)
 * - shareDocument     : invita a un colaborador por email
 * - removeCollaborator: quita acceso a un colaborador
 * - listCollaborators : lista colaboradores de un documento
 *
 * La estrategia es "last-write-wins": si dos personas editan simultáneamente
 * y las dos guardan, la última escritura prevalece. Para uso colaborativo
 * se recomienda comunicarse sobre quién está editando (Fase 3: Yjs CRDT).
 */

import { supabase } from './client'
import type { TibetanDocument } from '../../types/document'
import type { AccessibleDocument, DbCollaborator } from './client'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface CloudResult<T = void> {
  data?: T
  error?: string
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Guardar o actualizar un documento en la nube.
 *
 * Si el documento ya tiene un ID que existe en la DB → UPDATE.
 * Si no existe → INSERT (el ID del documento se preserva para mantener
 * consistencia con el archivo JSON local).
 */
export async function saveDocumentToCloud(
  doc: TibetanDocument
): Promise<CloudResult<{ cloudId: string; savedAt: string }>> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const payload = {
    id: doc.id,
    owner_id: user.id,
    title: doc.title,
    content: doc as unknown as Record<string, unknown>,
  }

  const { data, error } = await supabase
    .from('documents')
    .upsert(payload, { onConflict: 'id' })
    .select('id, updated_at')
    .single()

  if (error) return { error: error.message }

  return { data: { cloudId: data.id, savedAt: data.updated_at } }
}

/**
 * Cargar el contenido completo de un documento desde la nube.
 */
export async function loadDocumentFromCloud(
  documentId: string
): Promise<CloudResult<TibetanDocument>> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const { data, error } = await supabase
    .from('documents')
    .select('content')
    .eq('id', documentId)
    .single()

  if (error) return { error: error.message }

  return { data: data.content as TibetanDocument }
}

/**
 * Listar todos los documentos accesibles del usuario actual
 * (propios + compartidos).
 */
export async function listCloudDocuments(): Promise<CloudResult<AccessibleDocument[]>> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  // Usamos la vista accessible_documents que une propios + colaboraciones
  const { data, error } = await supabase
    .from('accessible_documents')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    // Fallback si la vista no existe: consulta directa solo propios
    const { data: fallback, error: fallbackError } = await supabase
      .from('documents')
      .select('id, title, owner_id, created_at, updated_at')
      .order('updated_at', { ascending: false })

    if (fallbackError) return { error: fallbackError.message }

    return {
      data: (fallback ?? []).map(d => ({
        ...d,
        access_role: 'owner' as const,
        collaborator_count: 0,
      })),
    }
  }

  return { data: data ?? [] }
}

/**
 * Eliminar un documento de la nube (solo el dueño puede hacerlo).
 */
export async function deleteCloudDocument(documentId: string): Promise<CloudResult> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) return { error: error.message }
  return {}
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

/**
 * Invitar a un colaborador por email.
 * Requiere que el invitado ya tenga una cuenta en Supabase Auth.
 */
export async function shareDocument(
  documentId: string,
  collaboratorEmail: string,
  role: 'viewer' | 'editor' = 'editor'
): Promise<CloudResult> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  // Buscar el user_id del colaborador por su email
  // Nota: Supabase no expone auth.users directamente en el cliente.
  // Workaround: usar una función RPC que busque por email en el servidor.
  const { data: collaboratorData, error: lookupError } = await supabase
    .rpc('get_user_id_by_email', { email_input: collaboratorEmail })

  if (lookupError || !collaboratorData) {
    return {
      error: collaboratorData === null
        ? `No se encontró ningún usuario con el email ${collaboratorEmail}. El usuario debe registrarse primero.`
        : lookupError?.message ?? 'Error al buscar el usuario.',
    }
  }

  const { error } = await supabase
    .from('document_collaborators')
    .upsert({
      document_id: documentId,
      user_id: collaboratorData,
      role,
      invited_by: user.id,
    }, { onConflict: 'document_id,user_id' })

  if (error) return { error: error.message }
  return {}
}

/**
 * Quitar acceso a un colaborador.
 */
export async function removeCollaborator(
  documentId: string,
  collaboratorUserId: string
): Promise<CloudResult> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const { error } = await supabase
    .from('document_collaborators')
    .delete()
    .eq('document_id', documentId)
    .eq('user_id', collaboratorUserId)

  if (error) return { error: error.message }
  return {}
}

/**
 * Listar colaboradores de un documento.
 */
export async function listCollaborators(
  documentId: string
): Promise<CloudResult<DbCollaborator[]>> {
  if (!supabase) return { error: 'Supabase no configurado.' }

  const { data, error } = await supabase
    .from('document_collaborators')
    .select('*')
    .eq('document_id', documentId)

  if (error) return { error: error.message }
  return { data: data ?? [] }
}
