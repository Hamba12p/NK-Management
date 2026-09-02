'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Clock, Laptop, Plus, TrendingUp } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type HubClass = { id: string; name: string }
type Enrolment = { class_id: string; status: string }
type Learner = { id: string; full_name: string; learner_enrolments: Enrolment[] }
type ClassSession = { id: string; class_id: string; cycle_week: number }
type Progress = { id: string; learner_id: string; class_id: string; week_number: number; status: string; learners: { full_name: string } | { full_name: string }[] | null; hub_classes: { name: string } | { name: string }[] | null }
type Curriculum = { id: string; class_id: string; week_number: number; workspace_doc_id: string; hub_classes: { name: string } | { name: string }[] | null; workspace_docs: { title: string } | { title: string }[] | null }
type WorkspaceDoc = { id: string; title: string }
type Equipment = { id: string; asset_tag: string; name: string; status: 'working' | 'in_repair' | 'newly_arrived'; notes: string | null }

const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value
const fieldClass = 'mt-2 w-full px-3 py-2.5'

export default function HubPage() {
  const supabase = useMemo(() => createClient(), [])
  const [classes, setClasses] = useState<HubClass[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [curriculum, setCurriculum] = useState<Curriculum[]>([])
  const [docs, setDocs] = useState<WorkspaceDoc[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [attendance, setAttendance] = useState<string[]>([])
  const [cycleHours, setCycleHours] = useState(0)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [progressForm, setProgressForm] = useState({ learner_id: '', class_id: '', last_session_id: '', week_number: '1', status: 'on_track' })
  const [curriculumForm, setCurriculumForm] = useState({ class_id: '', week_number: '1', workspace_doc_id: '' })
  const [equipmentForm, setEquipmentForm] = useState({ asset_tag: '', name: 'Computer', status: 'newly_arrived', notes: '' })

  const isLeader = role === 'admin' || role === 'manager'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const cycleStart = new Date(Date.now() - 35 * 86400000).toISOString()
    const [profileResult, classResult, learnerResult, sessionResult, progressResult, curriculumResult, docResult, equipmentResult, attendanceResult, hoursResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('hub_classes').select('id, name').eq('status', 'active').order('name'),
      supabase.from('learners').select('id, full_name, learner_enrolments(class_id, status)').order('full_name'),
      supabase.from('hub_class_sessions').select('id, class_id, cycle_week').order('cycle_week'),
      supabase.from('learner_progress').select('id, learner_id, class_id, week_number, status, learners(full_name), hub_classes(name)').order('updated_at', { ascending: false }),
      supabase.from('hub_curriculum').select('id, class_id, week_number, workspace_doc_id, hub_classes(name), workspace_docs(title)').order('week_number'),
      supabase.from('workspace_docs').select('id, title').is('deleted_at', null).order('title'),
      supabase.from('equipment').select('id, asset_tag, name, status, notes').order('asset_tag'),
      supabase.from('learner_attendance').select('status'),
      supabase.from('volunteer_hours').select('hours').gte('logged_at', cycleStart),
    ])
    const queryError = profileResult.error || classResult.error || learnerResult.error || sessionResult.error || progressResult.error || curriculumResult.error || equipmentResult.error
    if (queryError) setError(queryError.message)
    setRole(profileResult.data?.role || '')
    setClasses((classResult.data || []) as HubClass[])
    setLearners((learnerResult.data || []) as Learner[])
    setSessions((sessionResult.data || []) as ClassSession[])
    setProgress((progressResult.data || []) as Progress[])
    setCurriculum((curriculumResult.data || []) as Curriculum[])
    setDocs((docResult.data || []) as WorkspaceDoc[])
    setEquipment((equipmentResult.data || []) as Equipment[])
    setAttendance((attendanceResult.data || []).map(item => item.status))
    setCycleHours((hoursResult.data || []).reduce((sum, item) => sum + Number(item.hours), 0))
    const firstClass = classResult.data?.[0]?.id || ''
    const firstLearner = learnerResult.data?.[0]?.id || ''
    const firstDoc = docResult.data?.[0]?.id || ''
    setProgressForm(current => ({ ...current, learner_id: current.learner_id || firstLearner, class_id: current.class_id || firstClass }))
    setCurriculumForm(current => ({ ...current, class_id: current.class_id || firstClass, workspace_doc_id: current.workspace_doc_id || firstDoc }))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // Initial remote hydration intentionally populates the operational dashboard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const saveProgress = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const payload = { learner_id: progressForm.learner_id, class_id: progressForm.class_id, last_session_id: progressForm.last_session_id || null, week_number: Number(progressForm.week_number), status: progressForm.status, updated_by: userId, updated_at: new Date().toISOString() }
    const { data, error: upsertError } = await supabase.from('learner_progress').upsert(payload, { onConflict: 'learner_id,class_id' }).select('id').single()
    if (upsertError || !data) { setError(upsertError?.message || 'Unable to save progress.'); return }
    await logActivity('hub.progress.update', 'learner_progress', data.id, { week_number: payload.week_number, status: payload.status })
    setMessage('Learner progress saved without creating a grade or score.'); await load()
  }

  const linkCurriculum = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const payload = { class_id: curriculumForm.class_id, week_number: Number(curriculumForm.week_number), workspace_doc_id: curriculumForm.workspace_doc_id, created_by: userId }
    const { data, error: upsertError } = await supabase.from('hub_curriculum').upsert(payload, { onConflict: 'class_id,week_number' }).select('id').single()
    if (upsertError || !data) { setError(upsertError?.message || 'Unable to link lesson plan.'); return }
    await logActivity('hub.curriculum.link', 'hub_curriculum', data.id, { class_id: payload.class_id, week_number: payload.week_number })
    setMessage('Workspace lesson plan linked to the class week.'); await load()
  }

  const addEquipment = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const { data, error: insertError } = await supabase.from('equipment').insert({ asset_tag: equipmentForm.asset_tag.trim(), name: equipmentForm.name.trim(), status: equipmentForm.status, notes: equipmentForm.notes.trim() || null, updated_by: userId }).select('id').single()
    if (insertError || !data) { setError(insertError?.message || 'Unable to add equipment.'); return }
    await logActivity('hub.equipment.add', 'equipment', data.id, { asset_tag: equipmentForm.asset_tag, status: equipmentForm.status })
    setEquipmentForm({ asset_tag: '', name: 'Computer', status: 'newly_arrived', notes: '' }); setMessage('Equipment added.'); await load()
  }

  const setEquipmentStatus = async (item: Equipment, status: Equipment['status']) => {
    const { error: updateError } = await supabase.from('equipment').update({ status, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', item.id)
    if (updateError) { setError(updateError.message); return }
    await logActivity('hub.equipment.status', 'equipment', item.id, { asset_tag: item.asset_tag, status })
    setMessage(`${item.asset_tag} updated.`); await load()
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading Hub operations…</div>
  const attended = attendance.filter(status => status === 'present' || status === 'late').length
  const attendanceRate = attendance.length ? Math.round((attended / attendance.length) * 100) : 0
  const workingEquipment = equipment.filter(item => item.status === 'working').length

  return <div>
    <PageHeader title="Hub Operations" description="A live operational view derived from class, attendance, progress, volunteer-hours, curriculum, and equipment records." />
    {error ? <p className="mb-5 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p> : null}
    {message ? <p className="mb-5 rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p> : null}
    <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={TrendingUp} label="Attendance rate" value={`${attendanceRate}%`} /><Metric icon={CheckCircle2} label="Learners completed" value={progress.filter(item => item.status === 'completed').length} /><Metric icon={Clock} label="Volunteer hours · 5 weeks" value={cycleHours.toFixed(1)} /><Metric icon={Laptop} label="Computers working" value={workingEquipment} /></section>

    <section className="mb-7 card"><h2 className="serif-display text-2xl text-ink">Completion by class</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{classes.map(item => { const rows = progress.filter(entry => entry.class_id === item.id); const completed = rows.filter(entry => entry.status === 'completed').length; const rate = rows.length ? Math.round((completed / rows.length) * 100) : 0; return <div key={item.id} className="rounded border border-border bg-warm/40 p-4"><p className="font-semibold text-ink">{item.name}</p><p className="serif-display mt-2 text-3xl text-purple">{rate}%</p><p className="text-xs text-muted">{completed} of {rows.length} tracked learners</p></div>})}</div></section>

    <section className="mb-7 grid gap-6 xl:grid-cols-2"><form onSubmit={saveProgress} className="card space-y-3"><h2 className="font-bold text-ink">Update learner progress</h2><p className="text-sm text-muted">Track learning position and support needs—never grades.</p><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold text-muted">Learner<select className={fieldClass} value={progressForm.learner_id} onChange={event => setProgressForm({ ...progressForm, learner_id: event.target.value })} required>{learners.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label><label className="text-sm font-semibold text-muted">Class<select className={fieldClass} value={progressForm.class_id} onChange={event => setProgressForm({ ...progressForm, class_id: event.target.value, last_session_id: '' })} required>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold text-muted">Reached session (optional)<select className={fieldClass} value={progressForm.last_session_id} onChange={event => setProgressForm({ ...progressForm, last_session_id: event.target.value })}><option value="">Week only</option>{sessions.filter(item => item.class_id === progressForm.class_id).map(item => <option key={item.id} value={item.id}>Week {item.cycle_week}</option>)}</select></label><label className="text-sm font-semibold text-muted">Week<select className={fieldClass} value={progressForm.week_number} onChange={event => setProgressForm({ ...progressForm, week_number: event.target.value })}>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-muted">Status<select className={fieldClass} value={progressForm.status} onChange={event => setProgressForm({ ...progressForm, status: event.target.value })}><option value="on_track">On track</option><option value="needs_support">Needs support</option><option value="completed">Completed</option></select></label></div><button className="btn-primary">Save progress</button></form>
      <div className="card"><h2 className="font-bold text-ink">Current progress</h2><div className="mt-4 space-y-2">{progress.map(item => <div key={item.id} className="flex items-center justify-between rounded border border-border p-3 text-sm"><div><p className="font-semibold text-ink">{one(item.learners)?.full_name || 'Learner'}</p><p className="text-xs text-muted">{one(item.hub_classes)?.name || 'Class'} · Week {item.week_number}</p></div><span className="capitalize text-purple">{item.status.replace('_', ' ')}</span></div>)}{!progress.length ? <p className="text-sm text-muted">No progress records yet.</p> : null}</div></div></section>

    <section className="mb-7 grid gap-6 xl:grid-cols-2"><div className="card"><div className="flex items-center gap-2"><BookOpen size={20} className="text-purple" /><h2 className="font-bold text-ink">Curriculum library</h2></div>{isLeader ? <form onSubmit={linkCurriculum} className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold text-muted">Class<select className={fieldClass} value={curriculumForm.class_id} onChange={event => setCurriculumForm({ ...curriculumForm, class_id: event.target.value })} required>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold text-muted">Week<select className={fieldClass} value={curriculumForm.week_number} onChange={event => setCurriculumForm({ ...curriculumForm, week_number: event.target.value })}>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-muted">Workspace document<select className={fieldClass} value={curriculumForm.workspace_doc_id} onChange={event => setCurriculumForm({ ...curriculumForm, workspace_doc_id: event.target.value })} required>{docs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button className="btn-secondary sm:col-span-3"><Plus size={16} />Link lesson plan</button></form> : null}<div className="mt-4 space-y-2">{curriculum.map(item => <Link key={item.id} href="/dashboard/workspace" className="flex items-center justify-between rounded border border-border p-3 text-sm hover:bg-warm"><span><strong className="text-ink">{one(item.hub_classes)?.name}</strong><span className="ml-2 text-muted">Week {item.week_number}</span></span><span className="font-semibold text-purple">{one(item.workspace_docs)?.title}</span></Link>)}{!curriculum.length ? <p className="text-sm text-muted">No lesson plans are linked yet.</p> : null}</div></div>
      <div className="card"><h2 className="font-bold text-ink">Equipment log</h2>{isLeader ? <form onSubmit={addEquipment} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-muted">Asset tag<input className={fieldClass} value={equipmentForm.asset_tag} onChange={event => setEquipmentForm({ ...equipmentForm, asset_tag: event.target.value })} required maxLength={40} /></label><label className="text-sm font-semibold text-muted">Name<input className={fieldClass} value={equipmentForm.name} onChange={event => setEquipmentForm({ ...equipmentForm, name: event.target.value })} required maxLength={120} /></label><label className="text-sm font-semibold text-muted">Status<select className={fieldClass} value={equipmentForm.status} onChange={event => setEquipmentForm({ ...equipmentForm, status: event.target.value })}><option value="newly_arrived">Newly arrived</option><option value="working">Working</option><option value="in_repair">In repair</option></select></label><label className="text-sm font-semibold text-muted">Notes<input className={fieldClass} value={equipmentForm.notes} onChange={event => setEquipmentForm({ ...equipmentForm, notes: event.target.value })} maxLength={1000} /></label><button className="btn-secondary sm:col-span-2"><Plus size={16} />Add equipment</button></form> : null}<div className="mt-4 space-y-2">{equipment.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"><div><p className="font-semibold text-ink">{item.asset_tag} · {item.name}</p>{item.notes ? <p className="text-xs text-muted">{item.notes}</p> : null}</div>{isLeader ? <select aria-label={`Status for ${item.asset_tag}`} value={item.status} onChange={event => void setEquipmentStatus(item, event.target.value as Equipment['status'])} className="px-2 py-1 text-sm"><option value="newly_arrived">Newly arrived</option><option value="working">Working</option><option value="in_repair">In repair</option></select> : <span className="text-sm capitalize text-muted">{item.status.replace('_', ' ')}</span>}</div>)}{!equipment.length ? <p className="text-sm text-muted">No equipment has been recorded yet.</p> : null}</div></div></section>
  </div>
}

function Metric({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string | number }) {
  return <div className="card flex items-center justify-between"><div><p className="text-sm text-muted">{label}</p><p className="serif-display mt-2 text-3xl text-ink">{value}</p></div><Icon size={32} className="text-purple/35" /></div>
}
