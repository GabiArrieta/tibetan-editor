import React, { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './components/auth/LoginPage'
import { useDocumentStore } from './store/documentStore'
import { useAuthStore } from './store/authStore'
import { exampleDocument } from './seed/exampleDocument'
import { isSupabaseConfigured } from './lib/supabase/client'

export default function App() {
  const loadDocument = useDocumentStore(s => s.loadDocument)
  const authStatus = useAuthStore(s => s.status)
  const initializeAuth = useAuthStore(s => s.initialize)

  // Initialize auth subscription once on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const unsubscribe = initializeAuth()
    return unsubscribe
  }, [])

  // Load example document on first run if no autosave exists
  useEffect(() => {
    const hasAutosave = !!localStorage.getItem('tibetan-editor:autosave')
    if (!hasAutosave) {
      loadDocument(exampleDocument)
    }
  }, [])

  // Auth gate: only applies when Supabase is configured
  if (isSupabaseConfigured) {
    if (authStatus === 'loading') {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Cargando sesión…</p>
          </div>
        </div>
      )
    }

    if (authStatus === 'unauthenticated') {
      return <LoginPage />
    }
  }

  return <AppShell />
}
