/**
 * AuthModal — login / registro con Supabase.
 *
 * Modos:
 * - "signin"     : email + contraseña
 * - "signup"     : crear cuenta
 * - "magic"      : magic link (sin contraseña, recibe email)
 *
 * Solo se muestra si Supabase está configurado.
 */

import React, { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { Button } from '../shared/Button'

type AuthMode = 'signin' | 'signup' | 'magic'

interface AuthModalProps {
  onClose(): void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const signInWithEmail = useAuthStore(s => s.signInWithEmail)
  const signUpWithEmail = useAuthStore(s => s.signUpWithEmail)
  const signInWithMagicLink = useAuthStore(s => s.signInWithMagicLink)
  const error = useAuthStore(s => s.error)
  const clearError = useAuthStore(s => s.clearError)

  if (!isSupabaseConfigured) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    clearError()

    if (mode === 'magic') {
      const { sent } = await signInWithMagicLink(email)
      setMagicSent(sent)
    } else if (mode === 'signup') {
      await signUpWithEmail(email, password)
    } else {
      await signInWithEmail(email, password)
    }

    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-[400px] max-w-[95vw] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">
            {mode === 'signup' ? 'Crear cuenta' : mode === 'magic' ? 'Entrar sin contraseña' : 'Iniciar sesión'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {magicSent ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-3">📬</p>
            <p className="text-white font-medium mb-1">¡Revisá tu email!</p>
            <p className="text-slate-400 text-sm">
              Te enviamos un enlace de acceso a <strong>{email}</strong>.
              Hacé clic en él para entrar.
            </p>
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setMagicSent(false)}>
              Usar otro email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="tu@email.com"
                className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:border-indigo-400 outline-none"
              />
            </div>

            {mode !== 'magic' && (
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="mínimo 6 caracteres"
                  className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:border-indigo-400 outline-none"
                />
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded px-2 py-1.5">
                {error}
              </p>
            )}

            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              className="w-full justify-center"
            >
              {loading ? 'Procesando…' :
                mode === 'signup' ? 'Crear cuenta' :
                mode === 'magic' ? 'Enviar enlace de acceso' :
                'Iniciar sesión'}
            </Button>

            {/* Mode switcher */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-700">
              {mode !== 'magic' && (
                <button
                  type="button"
                  onClick={() => { setMode('magic'); clearError() }}
                  className="text-xs text-slate-400 hover:text-indigo-400 transition-colors text-left"
                >
                  Prefiero entrar sin contraseña (magic link)
                </button>
              )}
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('signup'); clearError() }}
                  className="text-xs text-slate-400 hover:text-indigo-400 transition-colors text-left"
                >
                  No tengo cuenta — crear una
                </button>
              )}
              {(mode === 'signup' || mode === 'magic') && (
                <button
                  type="button"
                  onClick={() => { setMode('signin'); clearError() }}
                  className="text-xs text-slate-400 hover:text-indigo-400 transition-colors text-left"
                >
                  Ya tengo cuenta — iniciar sesión
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
