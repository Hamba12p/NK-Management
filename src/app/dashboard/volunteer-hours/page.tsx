'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock, Plus, TrendingUp } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type EventRecord = { id: string; name: string; starts_at: string; location: string | null; status: string }
type HourRecord = { id: string; hours: number; notes: string | null; logged_at: string; events: EventRecord | EventRecord[] | null }

const relatedEvent = (entry: HourRecord) => Array.isArray(entry.events) ? entry.events[0] : entry.events

export default function VolunteerHoursPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [events, setEvents] = useState<EventRecord[]>([])
  const [hours, setHours] = useState<HourRecord[]>([])
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ event_id: '', hours: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Your session has ended.'); setLoading(false); return }
    setUserId(user.id)
    const [eventResult, hoursResult, profileResult] = await Promise.all([
      supabase.from('events').select('id, name, starts_at, location, status').neq('status', 'cancelled').order('starts_at', { ascending: false }).limit(60),
      supabase.from('volunteer_hours').select('id, hours, notes, logged_at, events(id, name, starts_at, location, status)').eq('volunteer_id', user.id).order('logged_at', { ascending: false }),
      supabase.from('volunteer_profiles').select('hours_total').eq('profile_id', user.id).single(),
    ])
    const queryError = eventResult.error || hoursResult.error || profileResult.error
    if (queryError) setError(queryError.message)
    else {
      setEvents((eventResult.data || []) as EventRecord[])
      setHours((hoursResult.data || []) as HourRecord[])
      setTotal(Number(profileResult.data?.hours_total || 0))
    }
    setLoading(false)
  }, [supabase])

  // Loading remote state is the synchronization this effect owns.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const logHours = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const amount = Number(form.hours)
    if (!form.event_id || !Number.isFinite(amount) || amount <= 0 || amount > 24) { setError('Choose an event and enter between 0.25 and 24 hours.'); return }
    const { error: insertError } = await supabase.from('volunteer_hours').insert({ volunteer_id: userId, event_id: form.event_id, hours: amount, notes: form.notes.trim() || null })
    if (insertError) { setError(insertError.code === '23505' ? 'You already logged hours for this event. Edit support can be added if a correction is needed.' : insertError.message); return }
    const selected = events.find(item => item.id === form.event_id)
    await logActivity('volunteer.hours.log', 'event', form.event_id, { event: selected?.name, hours: amount })
    setForm({ event_id: '', hours: '', notes: '' }); setShowForm(false); setMessage('Hours logged against the event.'); await load()
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading your hours…</div>
  const monthTotal = hours.filter(entry => new Date(entry.logged_at).getMonth() === new Date().getMonth()).reduce((sum, entry) => sum + Number(entry.hours), 0)

  return <div><PageHeader title="Volunteer Hours" description="Log time against a verified NK Udada event so every total has an audit trail." action={<button onClick={() => setShowForm(value => !value)} className="btn-primary"><Plus size={16} />Log hours</button>} />
    {error && <p className="mb-5 rounded-lg border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    {message && <p className="mb-5 rounded-lg border border-green/30 bg-green/10 p-3 text-sm text-green">{message}</p>}
    <div className="mb-6 grid gap-4 md:grid-cols-2"><Summary icon={Clock} label="All-time hours" value={total.toFixed(1)} /><Summary icon={TrendingUp} label="Logged this month" value={monthTotal.toFixed(1)} /></div>
    {showForm && <form onSubmit={logHours} className="card mb-6 space-y-4"><h2 className="font-bold text-ink">Log event hours</h2><label className="block text-sm font-semibold text-muted">Event<select required value={form.event_id} onChange={event => setForm({ ...form, event_id: event.target.value })} className="mt-2 w-full px-3 py-2"><option value="">Choose an event</option>{events.map(item => <option key={item.id} value={item.id}>{item.name} — {new Date(item.starts_at).toLocaleDateString('en-UG')}</option>)}</select></label><label className="block text-sm font-semibold text-muted">Hours<input required type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={event => setForm({ ...form, hours: event.target.value })} className="mt-2 w-full px-3 py-2" /></label><label className="block text-sm font-semibold text-muted">Notes<textarea maxLength={1000} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-2 w-full px-3 py-2" placeholder="What did you work on?" /></label><div className="flex gap-3"><button className="btn-primary">Save hours</button><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button></div>{!events.length && <p className="text-sm text-rust">No eligible events exist yet. A manager must schedule a meeting or event first.</p>}</form>}
    <div className="space-y-3"><h2 className="serif-display text-2xl text-ink">Hours log</h2>{hours.map(entry => { const event = relatedEvent(entry); return <article key={entry.id} className="card flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-ink">{event?.name || 'Event'}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted"><CalendarDays size={15} />{event?.starts_at ? new Date(event.starts_at).toLocaleDateString('en-UG') : 'Date unavailable'}{event?.location ? ` · ${event.location}` : ''}</p>{entry.notes && <p className="mt-2 text-sm text-muted">{entry.notes}</p>}</div><p className="serif-display text-3xl text-purple">{Number(entry.hours).toFixed(1)}<span className="ml-1 font-sans text-xs text-muted">hours</span></p></article> })}{!hours.length && <div className="card py-12 text-center text-muted">No auditable hours have been logged yet.</div>}</div>
  </div>
}

function Summary({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) { return <div className="card"><div className="flex items-center justify-between"><div><p className="text-sm text-muted">{label}</p><p className="serif-display mt-2 text-4xl text-ink">{value}</p></div><Icon className="text-purple/35" size={36} /></div></div> }
