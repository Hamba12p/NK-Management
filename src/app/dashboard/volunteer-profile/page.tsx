'use client'

import { useEffect, useMemo, useState } from 'react'
import { Award, Clock, FileText } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { formatRole } from '@/lib/utils'

type VolunteerDetails = {
  profile_id: string
  tier: 'volunteer' | 'volunteer_senior' | 'volunteer_lead'
  department: string
  status: 'active' | 'inactive' | 'onboarding'
  join_date: string
  hours_total: number
}

type Profile = { id: string; full_name: string; role: string; email: string; volunteer: VolunteerDetails }

export default function VolunteerProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('General')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Your session has ended.'); setLoading(false); return }
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, full_name, role, volunteer_profiles(profile_id, tier, department, status, join_date, hours_total)')
        .eq('id', user.id)
        .single()
      if (queryError || !data) { setError(queryError?.message || 'Unable to load your volunteer profile.'); setLoading(false); return }
      const relation = data.volunteer_profiles
      const volunteer = (Array.isArray(relation) ? relation[0] : relation) as VolunteerDetails | undefined
      if (!volunteer) { setError('Your volunteer record has not been provisioned yet.'); setLoading(false); return }
      const next = { id: data.id, full_name: data.full_name, role: data.role, email: user.email || '', volunteer }
      setProfile(next); setName(next.full_name); setDepartment(volunteer.department); setLoading(false)
    }
    load()
  }, [supabase])

  const save = async () => {
    if (!profile) return
    setError(''); setMessage('')
    const [profileResult, volunteerResult] = await Promise.all([
      supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id),
      supabase.from('volunteer_profiles').update({ department: department.trim() || 'General', updated_at: new Date().toISOString() }).eq('profile_id', profile.id),
    ])
    const saveError = profileResult.error || volunteerResult.error
    if (saveError) { setError(saveError.message); return }
    setProfile({ ...profile, full_name: name.trim(), volunteer: { ...profile.volunteer, department: department.trim() || 'General' } })
    setEditing(false); setMessage('Profile saved successfully.')
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading your profile…</div>
  if (!profile) return <div><PageHeader title="My Profile" description="Your volunteer information" /><p className="rounded-lg bg-rust/10 p-4 text-rust">{error}</p></div>

  return <div><PageHeader title="My Profile" description="Your verified identity and volunteer assignment." />
    {message && <p className="mb-5 rounded-lg border border-green/30 bg-green/10 p-3 text-sm text-green">{message}</p>}
    {error && <p className="mb-5 rounded-lg border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    <div className="card mb-6">
      <div className="mb-7 flex items-center gap-5 border-b border-border pb-7"><div className="grid h-16 w-16 place-items-center rounded-full bg-purple/10 text-2xl font-bold text-purple">{profile.full_name[0] || '?'}</div><div><p className="text-sm text-muted">Volunteer status</p><p className="serif-display text-2xl text-ink">{formatRole(profile.volunteer.tier)}</p><p className="mt-1 text-sm text-muted">Member since {new Date(profile.volunteer.join_date).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })}</p></div></div>
      {editing ? <div className="space-y-4"><label className="block text-sm font-semibold text-ink">Full name<input value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full px-4 py-2" /></label><label className="block text-sm font-semibold text-ink">Department<input value={department} onChange={event => setDepartment(event.target.value)} className="mt-2 w-full px-4 py-2" /></label><div className="flex gap-3"><button onClick={save} className="btn-primary">Save changes</button><button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button></div></div> : <div className="space-y-3"><Row label="Full name" value={profile.full_name} /><Row label="Department" value={profile.volunteer.department} /><Row label="Email" value={profile.email} /><button onClick={() => setEditing(true)} className="btn-secondary mt-3">Edit profile</button></div>}
    </div>
    <div className="grid gap-4 md:grid-cols-3"><Metric icon={Clock} label="Approved hours" value={Number(profile.volunteer.hours_total).toFixed(1)} /><Metric icon={Award} label="Tier" value={formatRole(profile.volunteer.tier)} /><Metric icon={FileText} label="Status" value={profile.volunteer.status} /></div>
  </div>
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0"><span className="text-sm text-muted">{label}</span><span className="text-sm font-semibold text-ink">{value || 'Not specified'}</span></div> }
function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) { return <div className="card"><div className="flex items-center justify-between"><div><p className="text-sm text-muted">{label}</p><p className="mt-2 text-lg font-bold capitalize text-ink">{value}</p></div><Icon className="text-purple/35" size={32} /></div></div> }
