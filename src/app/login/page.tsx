'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import Image from 'next/image'

const emailSchema = z.string().email('Please enter a valid email address')

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [volunteerPrompt, setVolunteerPrompt] = useState(false)
  const [volunteerName, setVolunteerName] = useState('')
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const result = emailSchema.safeParse(email.trim().toLowerCase())
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Invalid email address')
      return
    }

    setLoading(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: result.data, password })
    setLoading(false)
    if (signInError) {
      setError('Email or password is incorrect. Please try again.')
      return
    }

    if (data.user?.email?.toLowerCase() === 'volunteers@the-nkfoundation.org') {
      setVolunteerPrompt(true)
    } else {
      window.location.assign('/dashboard')
    }
  }

  function continueAsVolunteer(e: React.FormEvent) {
    e.preventDefault()
    const name = volunteerName.trim()
    if (!name) return
    // No Max-Age means this browser cookie expires with the browser session.
    document.cookie = `nk_volunteer_name=${encodeURIComponent(name)}; Path=/; SameSite=Lax`
    window.location.assign('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm via-cream to-cream px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute w-96 h-96 bg-gold rounded-full blur-3xl -top-48 -left-48" />
        <div className="absolute w-96 h-96 bg-purple rounded-full blur-3xl -bottom-48 -right-48" />
      </div>
      <form onSubmit={handleLogin} className="bg-cream rounded-3xl border border-border shadow-xl p-10 w-full max-w-sm relative z-10">
        <div className="mb-8 flex justify-center"><div className="h-20 w-20 overflow-hidden rounded-full border-2 border-gold bg-white p-1 shadow-sm"><Image src="/logo.jpeg" alt="NK Udada Foundation logo" width={80} height={80} className="h-full w-full rounded-full object-cover" priority /></div></div>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-ink serif-display mb-2">NK Udada</h1>
          <p className="text-muted text-sm font-medium uppercase tracking-wider">Staff Hub</p>
          <p className="text-muted text-sm mt-3">Empower & Equip Together</p>
        </div>
        <div className="space-y-5">
          <label className="block text-sm font-semibold text-ink">Email address
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-3 w-full border border-border rounded-xl px-5 py-3 text-ink placeholder-muted focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition bg-warm/30" placeholder="staff@the-nkfoundation.org" required disabled={loading} autoComplete="email" />
          </label>
          <label className="block text-sm font-semibold text-ink">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-3 w-full border border-border rounded-xl px-5 py-3 text-ink focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition bg-warm/30" required minLength={8} disabled={loading} autoComplete="current-password" />
          </label>
          {error && <div className="bg-rust/10 border border-rust/30 rounded-xl p-4 text-sm text-rust font-medium">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-purple hover:bg-purple-lt text-white py-3 rounded-xl font-semibold transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">{loading ? 'Signing in…' : 'Sign in'}</button>
        </div>
        <p className="text-center text-xs text-muted mt-6 font-medium">Only registered staff can access the Hub</p>
      </form>
      {volunteerPrompt && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/55 px-4">
          <form onSubmit={continueAsVolunteer} className="w-full max-w-sm rounded-2xl bg-cream p-7 shadow-2xl">
            <h2 className="serif-display text-2xl text-ink">Who’s working right now?</h2>
            <p className="mt-2 text-sm text-muted">This is recorded with the volunteer team’s activity for this browser session.</p>
            <input value={volunteerName} onChange={(e) => setVolunteerName(e.target.value)} className="mt-5 w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-gold" placeholder="Your name" autoFocus required maxLength={100} />
            <button className="mt-4 w-full rounded-xl bg-purple py-3 font-semibold text-white hover:bg-purple-lt">Continue to the Hub</button>
          </form>
        </div>
      )}
    </div>
  )
}
