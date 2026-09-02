'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, ShieldCheck, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type HubClass = { id: string; name: string }
type Enrolment = { id: string; class_id: string; enrolled_on: string; status: string; hub_classes: HubClass | HubClass[] | null }
type Guardian = { guardian_contact: string }
type Learner = { id: string; full_name: string; created_at: string; learner_enrolments: Enrolment[]; learner_guardian_contacts: Guardian | Guardian[] | null }

const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value
const fieldClass = 'mt-2 w-full px-3 py-2.5'

export default function LearnersPage() {
  const supabase = useMemo(() => createClient(), [])
  const [learners, setLearners] = useState<Learner[]>([])
  const [classes, setClasses] = useState<HubClass[]>([])
  const [role, setRole] = useState('')
  const [form, setForm] = useState({ full_name: '', class_id: '', enrolled_on: new Date().toISOString().slice(0, 10), guardian_contact: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [profileResult, classResult, learnerResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('hub_classes').select('id, name').eq('status', 'active').order('name'),
      supabase.from('learners').select('id, full_name, created_at, learner_enrolments(id, class_id, enrolled_on, status, hub_classes(id, name)), learner_guardian_contacts(guardian_contact)').order('full_name'),
    ])
    const queryError = profileResult.error || classResult.error || learnerResult.error
    if (queryError) setError(queryError.message)
    setRole(profileResult.data?.role || '')
    setClasses((classResult.data || []) as HubClass[])
    setLearners((learnerResult.data || []) as Learner[])
    setForm(current => ({ ...current, class_id: current.class_id || classResult.data?.[0]?.id || '' }))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // Initial remote hydration intentionally populates the directory.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const enrol = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const { data, error: rpcError } = await supabase.rpc('enrol_hub_learner', { p_full_name: form.full_name.trim(), p_class_id: form.class_id, p_enrolled_on: form.enrolled_on, p_guardian_contact: form.guardian_contact.trim() || null })
    if (rpcError) { setError(rpcError.message); return }
    await logActivity('hub.learner.enrol', 'learner', data, { class_id: form.class_id })
    setForm(current => ({ ...current, full_name: '', guardian_contact: '' })); setMessage('Learner enrolled. Guardian contact remains restricted to leadership and the DPO.'); await load()
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading learner directory…</div>
  const canManage = role === 'admin' || role === 'manager'
  const activeCount = learners.filter(item => item.learner_enrolments.some(enrolment => enrolment.status === 'active')).length

  return <div>
    <PageHeader title="Learner Directory" description="A minimal enrolment record for teaching operations. Guardian contact is kept in a separately protected record." />
    {error ? <p className="mb-5 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p> : null}
    {message ? <p className="mb-5 rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p> : null}
    <div className="mb-6 grid gap-4 md:grid-cols-3"><Stat icon={Users} label="Learners" value={learners.length} /><Stat icon={BookOpen} label="Active enrolments" value={activeCount} /><Stat icon={ShieldCheck} label="Private contacts" value={learners.filter(item => Boolean(one(item.learner_guardian_contacts)?.guardian_contact)).length} /></div>
    {canManage ? <form onSubmit={enrol} className="card mb-6"><h2 className="font-bold text-ink">Enrol learner</h2><p className="mt-1 text-sm text-muted">Record only what the Hub needs for class delivery.</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold text-muted">Full name<input className={fieldClass} value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} required maxLength={120} /></label><label className="text-sm font-semibold text-muted">Class<select className={fieldClass} value={form.class_id} onChange={event => setForm({ ...form, class_id: event.target.value })} required>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold text-muted">Enrolment date<input type="date" className={fieldClass} value={form.enrolled_on} onChange={event => setForm({ ...form, enrolled_on: event.target.value })} required /></label><label className="text-sm font-semibold text-muted">Guardian contact (optional)<input className={fieldClass} value={form.guardian_contact} onChange={event => setForm({ ...form, guardian_contact: event.target.value })} maxLength={200} /></label></div><button className="btn-primary mt-4"><Plus size={16} />Enrol learner</button></form> : <div className="card mb-6 text-sm text-muted"><ShieldCheck className="mb-2 text-purple" size={22} />DPO access is read-only. Changes remain limited to administrators and managers.</div>}
    <div className="table-surface"><table className="w-full text-left text-sm"><thead><tr><th className="p-4">Learner</th><th className="p-4">Class</th><th className="p-4">Enrolled</th><th className="p-4">Status</th><th className="p-4">Guardian contact</th></tr></thead><tbody>{learners.map(item => { const enrolment = item.learner_enrolments[0]; return <tr key={item.id}><td className="p-4 font-semibold text-ink">{item.full_name}</td><td className="p-4 text-muted">{one(enrolment?.hub_classes)?.name || 'Not assigned'}</td><td className="p-4 text-muted">{enrolment?.enrolled_on ? new Date(`${enrolment.enrolled_on}T00:00:00`).toLocaleDateString('en-UG') : '—'}</td><td className="p-4 capitalize text-muted">{enrolment?.status || '—'}</td><td className="p-4 text-muted">{one(item.learner_guardian_contacts)?.guardian_contact || 'Not recorded'}</td></tr>})}</tbody></table>{!learners.length ? <div className="p-12 text-center text-muted">No learners have been enrolled yet.</div> : null}</div>
  </div>
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <div className="card flex items-center justify-between"><div><p className="text-sm text-muted">{label}</p><p className="serif-display mt-2 text-3xl text-ink">{value}</p></div><Icon size={32} className="text-purple/35" /></div>
}
