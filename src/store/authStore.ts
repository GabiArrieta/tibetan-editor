/**
 * authStore — gestión de sesión de usuario con Supabase Auth.
 *
 * Suscribe al evento onAuthStateChange de Supabase para mantener
 * el estado de sesión sincronizado automáticamente.
 */

import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase/client'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthStore {
  user: User | null
  session: Session | null
  status: AuthStatus
  error: string | null

  // Actions
  signInWithEmail(email: string, password: string): Promise<void>
  signUpWithEmail(email: string, password: string): Promise<void>
  signInWithMagicLink(email: string): Promise<{ sent: boolean }>
  signOut(): Promise<void>
  clearError(): void
  initialize(): () => void   // returns unsubscribe function
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  status: isSupabaseConfigured ? 'loading' : 'unauthenticated',
  error: null,

  signInWithEmail: async (email, password) => {
    if (!supabase) return
    set({ error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) set({ error: error.message })
  },

  signUpWithEmail: async (email, password) => {
    if (!supabase) return
    set({ error: null })
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) set({ error: error.message })
  },

  signInWithMagicLink: async (email) => {
    if (!supabase) return { sent: false }
    set({ error: null })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (error) {
      set({ error: error.message })
      return { sent: false }
    }
    return { sent: true }
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    set({ user: null, session: null, status: 'unauthenticated' })
  },

  clearError: () => set({ error: null }),

  initialize: () => {
    if (!supabase) {
      set({ status: 'unauthenticated' })
      return () => {}
    }

    // Hydrate from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        user: session?.user ?? null,
        session,
        status: session ? 'authenticated' : 'unauthenticated',
      })
    })

    // Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({
          user: session?.user ?? null,
          session,
          status: session ? 'authenticated' : 'unauthenticated',
        })
      }
    )

    return () => subscription.unsubscribe()
  },
}))
