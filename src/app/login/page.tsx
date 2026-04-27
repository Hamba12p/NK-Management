'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const emailSchema = z.string().email('Please enter a valid email address')

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validate before touching the database
    const result = emailSchema.safeParse(email.trim().toLowerCase())
    if (!result.success) {
      const firstError = result.error.issues[0]
      setError(firstError?.message || 'Invalid email address')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: result.data,
      options: {
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        shouldCreateUser: false, // SECURITY: only pre-existing staff can log in
      },
    })

    if (error) {
      // Generic message — don't leak whether email exists
      setError('Something went wrong. Please try again.')
      console.error('Login error:', error)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm via-cream to-cream">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📧</span>
          </div>
          <h1 className="text-3xl font-bold text-ink serif-display mb-3">Check your email</h1>
          <p className="text-muted text-base mb-6">
            We sent a login link to <strong className="text-ink">{email}</strong>.<br />It expires in 15 minutes.
          </p>
          <button
            onClick={() => setSent(false)}
            className="text-gold font-semibold text-sm hover:text-gold-lt transition-colors"
          >
            Try a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm via-cream to-cream px-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute w-96 h-96 bg-gold rounded-full blur-3xl -top-48 -left-48"></div>
        <div className="absolute w-96 h-96 bg-purple rounded-full blur-3xl -bottom-48 -right-48"></div>
      </div>

      <form onSubmit={handleLogin} className="bg-cream rounded-3xl border border-border shadow-xl p-10 w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-full bg-purple flex items-center justify-center text-white font-bold text-2xl serif-display">
            N
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-ink serif-display mb-2">NK Udada</h1>
          <p className="text-muted text-sm font-medium uppercase tracking-wider">Staff Hub</p>
          <p className="text-muted text-sm mt-3">Empower & Equip Together</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink mb-3">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-xl px-5 py-3 text-ink placeholder-muted focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition bg-warm/30"
              placeholder="staff@nk-foundation.org"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-rust/10 border border-rust/30 rounded-xl p-4 text-sm text-rust font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple hover:bg-purple-lt text-white py-3 rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
          >
            {loading ? 'Sending…' : 'Send Login Link'}
          </button>
        </div>

        <p className="text-center text-xs text-muted mt-6 font-medium">
          Only registered staff can access the Hub
        </p>
        <p className="text-center text-xs text-muted/60 mt-2">
          Empower · Equip · Collaborate
        </p>
      </form>
    </div>
  )
}
