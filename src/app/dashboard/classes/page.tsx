'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, Plus, RefreshCw, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { volunteerContributor } from '@/lib/creator'

type HubClass = { id: string; name: string; description: string | null; status: string }
type Rotation = { id: string; class_id: string; volunteer_profile_id: string; volunteer_name: string; rotation_order: number; active: boolean }
type Assignment = { volunteer_profile_id: string; volunteer_name: string; rotation_id: string | null; is_override: boolean }
type EventRecord = { id: string; name: string; starts_at: string; ends_at: string; location: string | null; status: string }
type Session = { id: string; class_id: string; event_id: string; cycle_start: string; cycle_week: number; time_slot: string; status: string; events: EventRecord | EventRecord[]; hub_session_assignments: Assignment | Assignment[] | null }
type VolunteerProfile = { profile_id: string; profiles: { full_name: string } | { full_name: string }[] | null }

const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value
const eventFor = (session: Session) => one(session.events)
const assignmentFor = (session: Session) => one(session.hub_session_assignments)
const inputClass = 'mt-2 w-full px-3 py-2.5'

function volunteerNameFromCookie() {
  if (typeof document === 'undefined') return ''
  const raw = document.cookie.split('; ').find(item => item.startsWith('nk_volunteer_name='))?.split('=').slice(1).join('=')
  return raw ? decodeURIComponent(raw).trim() : ''
}

export default function ClassesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [classes, setClasses] = useState<HubClass[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [volunteerProfiles, setVolunteerProfiles] = useState<VolunteerProfile[]>([])
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [classForm, setClassForm] = useState({ name: '', description: '' })
  const [rotationForm, setRotationForm] = useState({ volunteer_profile_id: '', volunteer_name: '', rotation_order: '1' })
  const [scheduleForm, setScheduleForm] = useState({ start_at: '', duration: '120', time_slot: 'morning', location: 'NK Udada Youth Hub', announce_friday: true })

  const isLeader = role === 'admin' || role === 'manager'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [profileResult, classResult, rotationResult, sessionResult, volunteerResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('hub_classes').select('id, name, description, status').order('name'),
      supabase.from('hub_class_rotation').select('id, class_id, volunteer_profile_id, volunteer_name, rotation_order, active').order('rotation_order'),
      supabase.from('hub_class_sessions').select('id, class_id, event_id, cycle_start, cycle_week, time_slot, status, events(id, name, starts_at, ends_at, location, status), hub_session_assignments(volunteer_profile_id, volunteer_name, rotation_id, is_override)').order('cycle_start'),
      supabase.from('volunteer_profiles').select('profile_id, profiles!volunteer_profiles_profile_id_fkey(full_name)').eq('status', 'active'),
    ])
    const queryError = profileResult.error || classResult.error || rotationResult.error || sessionResult.error
    if (queryError) setError(queryError.message)
    setRole(profileResult.data?.role || '')
    setClasses((classResult.data || []) as HubClass[])
    setRotations((rotationResult.data || []) as Rotation[])
    setSessions((sessionResult.data || []) as Session[])
    setVolunteerProfiles((volunteerResult.data || []) as VolunteerProfile[])
    setSelectedClass(current => current || classResult.data?.[0]?.id || '')
    setRotationForm(current => ({ ...current, volunteer_profile_id: current.volunteer_profile_id || volunteerResult.data?.[0]?.profile_id || '' }))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // Initial remote hydration intentionally populates this client workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const createClass = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const { data, error: insertError } = await supabase.from('hub_classes').insert({ name: classForm.name.trim(), description: classForm.description.trim() || null, created_by: userId }).select('id, name').single()
    if (insertError || !data) { setError(insertError?.message || 'Unable to create class.'); return }
    await logActivity('hub.class.create', 'hub_class', data.id, { name: data.name })
    setClassForm({ name: '', description: '' }); setSelectedClass(data.id); setMessage('Class created. Add the teaching rotation next.'); await load()
  }

  const addRotation = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const payload = { class_id: selectedClass, volunteer_profile_id: rotationForm.volunteer_profile_id, volunteer_name: rotationForm.volunteer_name.trim(), rotation_order: Number(rotationForm.rotation_order), created_by: userId }
    const { data, error: insertError } = await supabase.from('hub_class_rotation').insert(payload).select('id').single()
    if (insertError || !data) { setError(insertError?.message || 'Unable to add volunteer.'); return }
    await logActivity('hub.rotation.add', 'hub_class', selectedClass, { volunteer_name: payload.volunteer_name, rotation_order: payload.rotation_order })
    setRotationForm(current => ({ ...current, volunteer_name: '', rotation_order: String(Math.min(5, Number(current.rotation_order) + 1)) })); setMessage('Volunteer added to the rotation.'); await load()
  }

  const generateRotation = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!scheduleForm.start_at) { setError('Choose the first session date and time.'); return }
    const { data, error: rpcError } = await supabase.rpc('generate_hub_rotation', { p_class_id: selectedClass, p_start_at: new Date(scheduleForm.start_at).toISOString(), p_duration_minutes: Number(scheduleForm.duration), p_time_slot: scheduleForm.time_slot, p_location: scheduleForm.location.trim() || null })
    if (rpcError) { setError(rpcError.message); return }
    const chosenClass = classes.find(item => item.id === selectedClass)
    if (scheduleForm.announce_friday && new Date(scheduleForm.start_at).getDay() === 5) {
      await supabase.from('announcements').insert({ title: `Friday session: ${chosenClass?.name || 'Hub class'}`, body: `A Friday ${scheduleForm.time_slot} session has been scheduled at ${scheduleForm.location || 'the Hub'}. Please check the class rotation for dates and assignments.`, author_id: userId, ...volunteerContributor() })
    }
    await logActivity('hub.rotation.generate', 'hub_class', selectedClass, { start_at: scheduleForm.start_at, sessions: Array.isArray(data) ? data.length : 5 })
    setMessage('Five-week teaching rotation generated.'); await load()
  }

  const reassign = async (session: Session, rotationId: string) => {
    const rotation = rotations.find(item => item.id === rotationId)
    if (!rotation) return
    const { error: updateError } = await supabase.from('hub_session_assignments').update({ volunteer_profile_id: rotation.volunteer_profile_id, volunteer_name: rotation.volunteer_name, rotation_id: rotation.id, assigned_by: userId, assigned_at: new Date().toISOString(), is_override: true }).eq('session_id', session.id)
    if (updateError) { setError(updateError.message); return }
    await logActivity('hub.session.reassign', 'hub_class_session', session.id, { volunteer_name: rotation.volunteer_name })
    setMessage('Session reassigned without changing the base rotation.'); await load()
  }

  const completeSession = async (session: Session) => {
    const { error: rpcError } = await supabase.rpc('complete_hub_class_session', { p_session_id: session.id })
    if (rpcError) { setError(rpcError.message); return }
    await logActivity('hub.session.complete', 'hub_class_session', session.id, { volunteer_name: assignmentFor(session)?.volunteer_name })
    setMessage('Session completed and its hours were recorded.'); await load()
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading class schedule…</div>

  const selected = classes.find(item => item.id === selectedClass)
  const classRotations = rotations.filter(item => item.class_id === selectedClass)
  const cookieName = volunteerNameFromCookie().toLowerCase()
  const visibleSessions = sessions.filter(session => session.class_id === selectedClass && (isLeader || (assignmentFor(session)?.volunteer_profile_id === userId && (!cookieName || assignmentFor(session)?.volunteer_name.toLowerCase() === cookieName))))

  return <div>
    <PageHeader title="Classes & Teaching Rotation" description="Plan the Hub timetable, keep the five-week rotation fair, and record completed teaching hours against verified events." />
    {error ? <p className="mb-5 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p> : null}
    {message ? <p className="mb-5 rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p> : null}

    {isLeader ? <section className="mb-6 grid gap-5 xl:grid-cols-3">
      <form onSubmit={createClass} className="card space-y-3"><h2 className="font-bold text-ink">1. Add a class</h2><label className="block text-sm font-semibold text-muted">Class name<input className={inputClass} value={classForm.name} onChange={event => setClassForm({ ...classForm, name: event.target.value })} required maxLength={120} placeholder="Entry Level" /></label><label className="block text-sm font-semibold text-muted">Description<textarea className={inputClass} value={classForm.description} onChange={event => setClassForm({ ...classForm, description: event.target.value })} maxLength={1200} rows={2} /></label><button className="btn-primary"><Plus size={16} />Create class</button></form>
      <form onSubmit={addRotation} className="card space-y-3"><h2 className="font-bold text-ink">2. Build rotation</h2><label className="block text-sm font-semibold text-muted">Verified login<select className={inputClass} value={rotationForm.volunteer_profile_id} onChange={event => setRotationForm({ ...rotationForm, volunteer_profile_id: event.target.value })} required>{volunteerProfiles.map(item => <option key={item.profile_id} value={item.profile_id}>{one(item.profiles)?.full_name || 'Volunteer account'}</option>)}</select></label><div className="grid grid-cols-[1fr_5rem] gap-2"><label className="block text-sm font-semibold text-muted">Volunteer name<input className={inputClass} value={rotationForm.volunteer_name} onChange={event => setRotationForm({ ...rotationForm, volunteer_name: event.target.value })} required maxLength={100} /></label><label className="block text-sm font-semibold text-muted">Week<select className={inputClass} value={rotationForm.rotation_order} onChange={event => setRotationForm({ ...rotationForm, rotation_order: event.target.value })}>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label></div><button className="btn-secondary"><Users size={16} />Add volunteer</button></form>
      <form onSubmit={generateRotation} className="card space-y-3"><h2 className="font-bold text-ink">3. Generate five weeks</h2><label className="block text-sm font-semibold text-muted">First session<input type="datetime-local" className={inputClass} value={scheduleForm.start_at} onChange={event => setScheduleForm({ ...scheduleForm, start_at: event.target.value })} required /></label><div className="grid grid-cols-2 gap-2"><label className="block text-sm font-semibold text-muted">Slot<select className={inputClass} value={scheduleForm.time_slot} onChange={event => setScheduleForm({ ...scheduleForm, time_slot: event.target.value })}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="other">Other</option></select></label><label className="block text-sm font-semibold text-muted">Minutes<input type="number" min="30" max="480" step="30" className={inputClass} value={scheduleForm.duration} onChange={event => setScheduleForm({ ...scheduleForm, duration: event.target.value })} /></label></div><label className="block text-sm font-semibold text-muted">Location<input className={inputClass} value={scheduleForm.location} onChange={event => setScheduleForm({ ...scheduleForm, location: event.target.value })} maxLength={300} /></label><label className="flex items-center gap-2 text-xs font-semibold text-muted"><input type="checkbox" checked={scheduleForm.announce_friday} onChange={event => setScheduleForm({ ...scheduleForm, announce_friday: event.target.checked })} />Announce if the first session is Friday</label><button className="btn-primary"><RefreshCw size={16} />Generate rotation</button></form>
    </section> : null}

    <div className="mb-6 flex flex-wrap gap-2">{classes.map(item => <button key={item.id} onClick={() => setSelectedClass(item.id)} className={item.id === selectedClass ? 'btn-primary' : 'btn-secondary'}>{item.name}</button>)}</div>
    {!classes.length ? <div className="card py-12 text-center text-muted">No Hub classes have been created yet.</div> : <>
      <section className="mb-6 grid gap-4 lg:grid-cols-[.7fr_1.3fr]"><div className="card"><p className="text-xs font-bold uppercase tracking-wide text-purple">Selected class</p><h2 className="serif-display mt-2 text-3xl text-ink">{selected?.name}</h2><p className="mt-3 text-sm leading-6 text-muted">{selected?.description || 'No description recorded.'}</p></div><div className="card"><h2 className="font-bold text-ink">Five-week teaching order</h2><div className="mt-4 grid gap-2 sm:grid-cols-5">{classRotations.map(item => <div key={item.id} className="rounded border border-border bg-warm/45 p-3"><p className="text-xs font-bold text-purple">Week {item.rotation_order}</p><p className="mt-1 text-sm font-semibold text-ink">{item.volunteer_name}</p></div>)}{!classRotations.length ? <p className="text-sm text-muted">Leadership has not configured this rotation yet.</p> : null}</div></div></section>
      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="serif-display text-2xl text-ink">Upcoming teaching grid</h2><span className="text-sm text-muted">{visibleSessions.length} session{visibleSessions.length === 1 ? '' : 's'}</span></div>{visibleSessions.map(session => { const sessionEvent = eventFor(session); const assignment = assignmentFor(session); return <article key={session.id} className="card flex flex-wrap items-center justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-purple/10 px-2 py-1 text-xs font-bold text-purple">Week {session.cycle_week}</span><span className="text-xs font-semibold capitalize text-muted">{session.time_slot}</span>{assignment?.is_override ? <span className="rounded bg-rust/10 px-2 py-1 text-xs font-semibold text-rust">Reassigned</span> : null}</div><h3 className="mt-2 font-bold text-ink">{assignment?.volunteer_name || 'Unassigned'}</h3><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted"><CalendarDays size={15} />{sessionEvent ? new Date(sessionEvent.starts_at).toLocaleString('en-UG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable'} <Clock size={15} />{sessionEvent ? `${Math.round((new Date(sessionEvent.ends_at).getTime() - new Date(sessionEvent.starts_at).getTime()) / 60000)} min` : '—'}{sessionEvent?.location ? ` · ${sessionEvent.location}` : ''}</p></div><div className="flex flex-wrap items-center gap-2"><Link href={`/dashboard/classes/${session.id}/attendance`} className="btn-secondary !min-h-0 !px-3 !py-2">Roll-call</Link>{isLeader ? <select aria-label={`Reassign week ${session.cycle_week}`} value={assignment?.rotation_id || ''} onChange={event => void reassign(session, event.target.value)} className="px-3 py-2 text-sm"><option value="">Reassign…</option>{classRotations.map(item => <option key={item.id} value={item.id}>{item.volunteer_name}</option>)}</select> : null}{session.status === 'completed' ? <span className="flex items-center gap-2 text-sm font-semibold text-green"><CheckCircle2 size={17} />Completed</span> : isLeader ? <button onClick={() => void completeSession(session)} className="btn-secondary !min-h-0 !px-3 !py-2"><CheckCircle2 size={16} />Complete</button> : <span className="text-xs font-semibold text-muted">Read-only schedule</span>}</div></article>})}{!visibleSessions.length ? <div className="card py-12 text-center text-muted">No sessions are assigned here yet.</div> : null}</section>
    </>}
  </div>
}
