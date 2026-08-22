'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, Lock, Moon, Settings, Sun, User } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import CreatorTag from '@/components/CreatorTag'

type Preferences = { notifications_enabled: boolean; dark_mode: boolean; email_digest: boolean }
const defaults: Preferences = { notifications_enabled: true, dark_mode: false, email_digest: false }

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [displayTag, setDisplayTag] = useState('')
  const [displayColor, setDisplayColor] = useState('burgundy')
  const [preferences, setPreferences] = useState<Preferences>(defaults)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Your session has ended. Please sign in again.'); setLoading(false); return }
      setUserId(user.id); setEmail(user.email || '')
      const [profileResult, preferenceResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_preferences').select('notifications_enabled, dark_mode, email_digest').eq('profile_id', user.id).maybeSingle(),
      ])
      if (profileResult.error) setError('Unable to load your profile settings.')
      if (profileResult.data) { setFullName(profileResult.data.full_name); setRole(profileResult.data.role); setEmail(profileResult.data.email || user.email || ''); setDisplayTag(profileResult.data.display_tag || ''); setDisplayColor(profileResult.data.display_color || 'burgundy') }
      const saved = preferenceResult.data || defaults
      if (!preferenceResult.data) await supabase.from('user_preferences').upsert({ profile_id: user.id, ...defaults }, { onConflict: 'profile_id' })
      setPreferences(saved); applyTheme(saved.dark_mode); setLoading(false)
    }
    load()
  }, [supabase])

  const updatePreferences = async (next: Preferences) => {
    setPreferences(next); applyTheme(next.dark_mode); setMessage(''); setError('')
    const { error: updateError } = await supabase.from('user_preferences').upsert({ profile_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
    if (updateError) { setError(updateError.message); return }
    setMessage('Preferences saved to your account.')
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setError('')
    const normalizedTag = displayTag.trim().toUpperCase()
    if (!/^[A-Z0-9]{2,4}$/.test(normalizedTag)) { setError('Your creator tag must be 2–4 letters or numbers.'); return }
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName.trim(), display_tag: normalizedTag, display_color: displayColor, updated_at: new Date().toISOString() }).eq('id', userId)
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

  return <div className="mx-auto max-w-3xl"><PageHeader title="Settings" description="Manage your profile, account preferences, and security." />
    {(message || error) && <div className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rust/30 bg-rust/10 text-rust' : 'border-green/30 bg-green/10 text-green'}`}>{!error && <Check size={16} />}{error || message}</div>}
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="card"><SectionTitle icon={User} title="Profile" description="Your staff identity and creator tag across the Hub." /><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-muted">Full name<input value={fullName} onChange={event => setFullName(event.target.value)} required maxLength={120} className="mt-2 w-full px-3 py-2.5" /></label><label className="text-sm font-semibold text-muted">Email<input value={email} disabled className="mt-2 w-full bg-warm px-3 py-2.5 text-muted" /></label></div><label className="mt-4 block text-sm font-semibold text-muted">Role<input value={role.replaceAll('_', ' ')} disabled className="mt-2 w-full bg-warm px-3 py-2.5 capitalize text-muted" /></label><div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold text-muted">Creator tag<input value={displayTag} onChange={event => setDisplayTag(event.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase())} required minLength={2} maxLength={4} className="mt-2 w-full px-3 py-2.5 uppercase" aria-describedby="creator-tag-help" /></label><label className="text-sm font-semibold text-muted">Tag colour<select value={displayColor} onChange={event => setDisplayColor(event.target.value)} className="mt-2 w-full px-3 py-2.5"><option value="burgundy">Deep burgundy</option><option value="soft-burgundy">Soft burgundy</option><option value="magenta">Accent magenta</option><option value="rust">Rust</option><option value="ink">Warm ink</option></select></label><div className="self-end pb-3"><CreatorTag profile={{ full_name: fullName, display_tag: displayTag || null, display_color: displayColor }} showName /></div></div><p id="creator-tag-help" className="mt-1 text-xs text-muted">Use 2–4 letters or numbers. This quiet marker appears beside content you create.</p><button className="btn-primary mt-6">Save profile</button></form>
      <section className="card"><SectionTitle icon={Settings} title="Preferences" description="Saved securely to your Hub account across devices." /><div className="divide-y divide-border"><PreferenceRow icon={Bell} title="Notifications" description="Show in-app alerts for updates." checked={preferences.notifications_enabled} onChange={checked => updatePreferences({ ...preferences, notifications_enabled: checked })} /><PreferenceRow icon={preferences.dark_mode ? Moon : Sun} title="Dark mode" description="Use the darker workspace appearance." checked={preferences.dark_mode} onChange={checked => updatePreferences({ ...preferences, dark_mode: checked })} /><PreferenceRow icon={Bell} title="Weekly email digest" description="Preference only — email delivery is coming soon." checked={preferences.email_digest} onChange={checked => updatePreferences({ ...preferences, email_digest: checked })} /></div></section>
      <form onSubmit={changePassword} className="card"><SectionTitle icon={Lock} title="Password" description="Choose a new password whenever you need to." /><label className="block max-w-md text-sm font-semibold text-muted">New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 w-full px-3 py-2.5" /></label><button className="btn-secondary mt-5">Update password</button></form>
    </div>
  </div>
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof User; title: string; description: string }) { return <div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-warm p-2 text-purple"><Icon size={19} /></span><div><h2 className="font-bold text-ink">{title}</h2><p className="text-sm text-muted">{description}</p></div></div> }
function PreferenceRow({ icon: Icon, title, description, checked, onChange }: { icon: typeof Bell; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="flex gap-3"><span className="mt-0.5 text-purple"><Icon size={18} /></span><div><p className="font-semibold text-ink">{title}</p><p className="mt-0.5 text-sm text-muted">{description}</p></div></div><button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-purple' : 'bg-border'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-cream transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button></div> }
