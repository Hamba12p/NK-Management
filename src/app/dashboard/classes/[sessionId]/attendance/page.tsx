'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, Clock3, UserX } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type Learner = { id: string; full_name: string }
type Enrolment = { learner_id: string; learners: Learner | Learner[] | null }
type Attendance = { learner_id: string; status: 'present' | 'absent' | 'late' }
type Session = { id: string; class_id: string; cycle_week: number; hub_classes: { name: string } | { name: string }[] | null; events: { starts_at: string } | { starts_at: string }[] | null }

const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value

export default function AttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [enrolments, setEnrolments] = useState<Enrolment[]>([])
  const [attendance, setAttendance] = useState<Record<string, Attendance['status']>>({})
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const sessionResult = await supabase.from('hub_class_sessions').select('id, class_id, cycle_week, hub_classes(name), events(starts_at)').eq('id', sessionId).single()
    if (sessionResult.error || !sessionResult.data) { setError(sessionResult.error?.message || 'Session not found.'); setLoading(false); return }
    const [enrolmentResult, attendanceResult] = await Promise.all([
      supabase.from('learner_enrolments').select('learner_id, learners(id, full_name)').eq('class_id', sessionResult.data.class_id).eq('status', 'active'),
      supabase.from('learner_attendance').select('learner_id, status').eq('session_id', sessionId),
    ])
    const queryError = enrolmentResult.error || attendanceResult.error
    if (queryError) setError(queryError.message)
    setSession(sessionResult.data as Session)
    setEnrolments((enrolmentResult.data || []) as Enrolment[])
    setAttendance(Object.fromEntries((attendanceResult.data || []).map(item => [item.learner_id, item.status])) as Record<string, Attendance['status']>)
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    // Initial remote hydration intentionally populates roll-call state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const mark = async (learnerId: string, status: Attendance['status']) => {
    setError(''); setMessage('')
    const { error: upsertError } = await supabase.from('learner_attendance').upsert({ session_id: sessionId, learner_id: learnerId, status, marked_by: userId, marked_at: new Date().toISOString() }, { onConflict: 'session_id,learner_id' })
    if (upsertError) { setError(upsertError.message); return }
    setAttendance(current => ({ ...current, [learnerId]: status }))
    await logActivity('hub.attendance.mark', 'hub_class_session', sessionId, { learner_id: learnerId, status })
  }

  const markAllPresent = async () => {
    for (const enrolment of enrolments) await mark(enrolment.learner_id, 'present')
    setMessage('Everyone in the current roster is marked present.')
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading roll-call…</div>
  const className = one(session?.hub_classes)?.name || 'Class'
  const startsAt = one(session?.events)?.starts_at
  const recorded = Object.keys(attendance).length

  return <div>
    <Link href="/dashboard/classes" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-purple"><ArrowLeft size={16} />Back to classes</Link>
    <PageHeader title={`${className} Roll-call`} description={`Week ${session?.cycle_week || '—'}${startsAt ? ` · ${new Date(startsAt).toLocaleString('en-UG')}` : ''}. Mark attendance in the first few minutes of class.`} action={<button onClick={() => void markAllPresent()} className="btn-secondary"><Check size={16} />Mark all present</button>} />
    {error ? <p className="mb-5 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p> : null}
    {message ? <p className="mb-5 rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p> : null}
    <div className="mb-4 flex items-center justify-between text-sm text-muted"><span>{enrolments.length} enrolled learners</span><span>{recorded} marked</span></div>
    <div className="space-y-3">{enrolments.map(enrolment => { const learner = one(enrolment.learners); const current = attendance[enrolment.learner_id]; return <article key={enrolment.learner_id} className="card flex flex-wrap items-center justify-between gap-4"><p className="font-semibold text-ink">{learner?.full_name || 'Learner'}</p><div className="flex flex-wrap gap-2"><StatusButton active={current === 'present'} label="Present" icon={Check} onClick={() => void mark(enrolment.learner_id, 'present')} /><StatusButton active={current === 'late'} label="Late" icon={Clock3} onClick={() => void mark(enrolment.learner_id, 'late')} /><StatusButton active={current === 'absent'} label="Absent" icon={UserX} onClick={() => void mark(enrolment.learner_id, 'absent')} /></div></article>})}{!enrolments.length ? <div className="card py-12 text-center text-muted">No active learners are enrolled in this class.</div> : null}</div>
  </div>
}

function StatusButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof Check; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={active} className={`${active ? 'btn-primary' : 'btn-secondary'} !min-h-0 !px-3 !py-2`}><Icon size={15} />{label}</button>
}
