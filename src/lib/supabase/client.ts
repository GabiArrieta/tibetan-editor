/**
 * Supabase client singleton.
 *
 * Reads credentials from Vite env variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * The client is safe to import anywhere — it creates a single shared instance.
 *
 * If env vars are not set, the client is null and cloud features are disabled
 * gracefully (no crash, just "offline" mode).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseUrl !== 'https://TU_PROJECT_ID.supabase.co'

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null

if (!isSupabaseConfigured) {
  console.info(
    '[Tibetan Editor] Supabase no configurado. La app funciona en modo local. ' +
    'Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local para activar la nube.'
  )
}

// ---------------------------------------------------------------------------
// Database types (Row types para TypeScript)
// ---------------------------------------------------------------------------

export interface DbDocument {
  id: string
  owner_id: string
  title: string
  content: Record<string, unknown>   // TibetanDocument serializado como JSONB
  created_at: string
  updated_at: string
}

export interface DbCollaborator {
  document_id: string
  user_id: string
  role: 'viewer' | 'editor'
  invited_by: string | null
  created_at: string
}

export interface AccessibleDocument {
  id: string
  title: string
  owner_id: string
  created_at: string
  updated_at: string
  access_role: 'owner' | 'viewer' | 'editor'
  collaborator_count: number
}
