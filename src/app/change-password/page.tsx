'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 12) return setError('Use at least 12 characters for your new password.')
    if (password !== confirm) return setError('The passwords do not match.')
    setSaving(true)
    try {
      const response = await fetch('/api/intern/password-change', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your password could not be changed.')
      router.replace('/dashboard')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your password could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="page-container mx-auto max-w-lg px-4 py-16">
    <section className="card">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-purple">Account security</p>
      <h1 className="serif-display mt-2 text-3xl text-ink">Choose a new password</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Change your temporary password before opening the staff hub.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-ink">New password
          <input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border border-border bg-cream px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold text-ink">Confirm new password
          <input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded border border-border bg-cream px-3 py-2" />
        </label>
        {error && <p role="alert" className="rounded border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p>}
        <button className="btn-primary" disabled={saving}>{saving ? 'Updating password…' : 'Update password'}</button>
      </form>
    </section>
  </main>
}
