'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, Lock, Moon, Settings, Sun, User } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'

type Preferences = { notifications_enabled: boolean; dark_mode: boolean; email_digest: boolean }
const preferenceKey = 'nk-udada-preferences'
const defaultPreferences: Preferences = { notifications_enabled: true, dark_mode: false, email_digest: false }

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export default function SettingsPage() {
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const stored = window.localStorage.getItem(preferenceKey)
      const savedPreferences = stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences
      setPreferences(savedPreferences)
      applyTheme(savedPreferences.dark_mode)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Your session has ended. Please sign in again.'); setLoading(false); return }
      setEmail(user.email || '')
      const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      if (profileError) setError('Unable to load your profile settings.')
      if (profile) { setFullName(profile.full_name); setRole(profile.role) }
      setLoading(false)
    }
    load()
  }, [])

  const updatePreferences = (next: Preferences) => {
    setPreferences(next)
    window.localStorage.setItem(preferenceKey, JSON.stringify(next))
    applyTheme(next.dark_mode)
    setMessage('Preferences saved on this device.')
    setError('')
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Your session has ended. Please sign in again.'); return }
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    if (updateError) { setError(updateError.message); return }
    setMessage('Profile updated successfully.')
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setError('')
    if (newPassword.length < 8) { setError('Use at least 8 characters for your password.'); return }
    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
    if (passwordError) { setError(passwordError.message); return }
    setNewPassword(''); setMessage('Password updated successfully.')
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading your settings…</div>

  return <div className="mx-auto max-w-3xl"><PageHeader title="Settings" description="Manage your profile, appearance, and account security." />
    {(message || error) && <div className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rust/30 bg-rust/10 text-rust' : 'border-green/30 bg-green/10 text-green'}`}>{!error && <Check size={16} />}{error || message}</div>}
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="card"><div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-warm p-2 text-gold"><User size={19} /></span><div><h2 className="font-bold text-ink">Profile</h2><p className="text-sm text-muted">Your staff identity in the Hub.</p></div></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-muted">Full name<input value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={120} className="mt-2 w-full px-3 py-2.5" /></label><label className="text-sm font-semibold text-muted">Email<input value={email} disabled className="mt-2 w-full bg-warm px-3 py-2.5 text-muted" /></label></div><div className="mt-4"><label className="text-sm font-semibold text-muted">Role<input value={role.replaceAll('_', ' ')} disabled className="mt-2 w-full bg-warm px-3 py-2.5 capitalize text-muted" /></label></div><button className="btn-primary mt-6">Save profile</button></form>
      <section className="card"><div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-warm p-2 text-gold"><Settings size={19} /></span><div><h2 className="font-bold text-ink">Preferences</h2><p className="text-sm text-muted">Saved locally for this browser and device.</p></div></div><div className="divide-y divide-border"><PreferenceRow icon={Bell} title="Notifications" description="Show in-app alerts for updates." checked={preferences.notifications_enabled} onChange={checked => updatePreferences({ ...preferences, notifications_enabled: checked })} /><PreferenceRow icon={preferences.dark_mode ? Moon : Sun} title="Dark mode" description="Use the darker workspace appearance." checked={preferences.dark_mode} onChange={checked => updatePreferences({ ...preferences, dark_mode: checked })} /><PreferenceRow icon={Bell} title="Weekly email digest" description="Keep this preference ready for the organisation’s email workflow." checked={preferences.email_digest} onChange={checked => updatePreferences({ ...preferences, email_digest: checked })} /></div></section>
      <form onSubmit={changePassword} className="card"><div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-warm p-2 text-gold"><Lock size={19} /></span><div><h2 className="font-bold text-ink">Password</h2><p className="text-sm text-muted">Choose a new password whenever you need to.</p></div></div><label className="block max-w-md text-sm font-semibold text-muted">New password<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 w-full px-3 py-2.5" /></label><button className="btn-secondary mt-5">Update password</button></form>
    </div>
  </div>
}

function PreferenceRow({ icon: Icon, title, description, checked, onChange }: { icon: typeof Bell; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="flex gap-3"><span className="mt-0.5 text-gold"><Icon size={18} /></span><div><p className="font-semibold text-ink">{title}</p><p className="mt-0.5 text-sm text-muted">{description}</p></div></div><button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-purple' : 'bg-border'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
}
