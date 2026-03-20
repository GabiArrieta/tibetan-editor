/**
 * LoginPage — pantalla de acceso de la aplicación.
 *
 * Se muestra cuando:
 * - Supabase está configurado Y
 * - El usuario no está autenticado
 *
 * Flujo principal: magic link (sin contraseña).
 * Flujo secundario: email + contraseña.
 *
 * Si Supabase no está configurado, la app funciona en modo local sin esta pantalla.
 */

import React, { useState, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'

type Mode = 'magic' | 'password'

const ERROR_LABELS: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Tu email no fue confirmado. Revisá tu bandeja de entrada.',
  'User already registered': 'Ya existe una cuenta con ese email. Probá iniciando sesión.',
  'Email rate limit exceeded': 'Demasiados intentos. Esperá unos minutos antes de reintentar.',
  'over_email_send_rate_limit': 'Demasiados envíos de email. Esperá antes de reintentar.',
  'signup_disabled': 'Los registros están temporalmente deshabilitados.',
}

function humanizeError(raw: string): string {
  // Check exact match
  if (ERROR_LABELS[raw]) return ERROR_LABELS[raw]
  // Check partial match
  for (const [key, label] of Object.entries(ERROR_LABELS)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return label
  }
  // Fallback — avoid leaking raw Supabase internals in production
  return 'Ocurrió un error. Intentá de nuevo o contactá soporte.'
}

export function LoginPage() {
  const signInWithMagicLink = useAuthStore(s => s.signInWithMagicLink)
  const signInWithEmail = useAuthStore(s => s.signInWithEmail)
  const signUpWithEmail = useAuthStore(s => s.signUpWithEmail)
  const storeError = useAuthStore(s => s.error)
  const clearError = useAuthStore(s => s.clearError)

  const [mode, setMode] = useState<Mode>('magic')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [signUpPending, setSignUpPending] = useState(false)

  const switchMode = useCallback((next: Mode) => {
    setMode(next)
    setIsSignUp(false)
    clearError()
  }, [clearError])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    clearError()

    if (mode === 'magic') {
      const { sent } = await signInWithMagicLink(email.trim())
      if (sent) setMagicSent(true)
    } else if (isSignUp) {
      await signUpWithEmail(email.trim(), password)
      // If no error, show confirmation pending state
      if (!useAuthStore.getState().error) {
        setSignUpPending(true)
      }
    } else {
      await signInWithEmail(email.trim(), password)
    }

    setLoading(false)
  }, [mode, isSignUp, email, password, signInWithMagicLink, signInWithEmail, signUpWithEmail, clearError])

  const rawError = storeError
  const displayError = rawError ? humanizeError(rawError) : null

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-block w-12 h-12 bg-indigo-600 rounded-xl mb-4 flex items-center justify-center">
            <span className="text-white text-xl font-bold">ཏི</span>
          </div>
          <h1 className="text-white text-xl font-semibold">Tibetan Editor</h1>
          <p className="text-slate-500 text-sm mt-1">Editor de textos tibetano · fonética · traducción</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">

          {/* Magic link: sent confirmation */}
          {magicSent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="text-white font-semibold mb-2">¡Revisá tu email!</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enviamos un enlace de acceso a{' '}
                <span className="text-indigo-400 font-medium">{email}</span>.
                Hacé clic en él para entrar.
              </p>
              <p className="text-slate-500 text-xs mt-3">
                No lo ves? Revisá spam o pedí otro enlace.
              </p>
              <button
                className="mt-4 text-xs text-slate-400 hover:text-indigo-400 transition-colors underline underline-offset-2"
                onClick={() => { setMagicSent(false); setEmail('') }}
              >
                Usar otro email
              </button>
            </div>
          ) : signUpPending ? (
            /* Sign up: email confirmation pending */
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✉️</div>
              <h2 className="text-white font-semibold mb-2">Confirmá tu email</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enviamos un email de confirmación a{' '}
                <span className="text-indigo-400 font-medium">{email}</span>.
                Confirmalo para activar tu cuenta.
              </p>
              <button
                className="mt-4 text-xs text-slate-400 hover:text-indigo-400 transition-colors underline underline-offset-2"
                onClick={() => { setSignUpPending(false); setMode('magic'); clearError() }}
              >
                Volver al inicio
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex gap-1 mb-5 bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => switchMode('magic')}
                  className={[
                    'flex-1 text-xs py-1.5 rounded-md transition-colors font-medium',
                    mode === 'magic'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                >
                  Magic link
                </button>
                <button
                  onClick={() => switchMode('password')}
                  className={[
                    'flex-1 text-xs py-1.5 rounded-md transition-colors font-medium',
                    mode === 'password'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                >
                  Contraseña
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 border border-slate-600 focus:border-indigo-500 outline-none transition-colors placeholder-slate-500"
                  />
                </div>

                {/* Password (only in password mode) */}
                {mode === 'password' && (
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      placeholder="mínimo 6 caracteres"
                      minLength={6}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 border border-slate-600 focus:border-indigo-500 outline-none transition-colors placeholder-slate-500"
                    />
                  </div>
                )}

                {/* Error */}
                {displayError && (
                  <div className="flex items-start gap-2 text-red-400 text-xs bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{displayError}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando…
                    </span>
                  ) : mode === 'magic' ? 'Enviar enlace de acceso'
                    : isSignUp ? 'Crear cuenta'
                    : 'Iniciar sesión'}
                </button>

                {/* Mode hint (magic link) */}
                {mode === 'magic' && (
                  <p className="text-[11px] text-slate-500 text-center">
                    Recibirás un enlace por email. Sin contraseña necesaria.
                  </p>
                )}

                {/* Sign in / Sign up toggle (password mode) */}
                {mode === 'password' && (
                  <button
                    type="button"
                    className="w-full text-xs text-slate-400 hover:text-indigo-400 transition-colors pt-1"
                    onClick={() => { setIsSignUp(v => !v); clearError() }}
                  >
                    {isSignUp ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Crear una'}
                  </button>
                )}
              </form>
            </>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-slate-600 mt-5">
          Tus proyectos se guardan en tu cuenta personal.
        </p>
      </div>
    </div>
  )
}
