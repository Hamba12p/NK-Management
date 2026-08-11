'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type Incident = { id: string; title: string; severity: string; description: string; containment_notes?: string; occurred_at: string; created_at: string }
export default function IncidentsPage() {
  const supabase = createClient(); const [items, setItems] = useState<Incident[]>([]); const [error, setError] = useState(''); const [form, setForm] = useState({ title: '', severity: 'low', description: '', containment_notes: '', occurred_at: new Date().toISOString().slice(0, 16) })
  const load = async () => { const { data, error } = await supabase.from('dpo_incidents').select('*').order('created_at', { ascending: false }); if (error) setError(error.message); else setItems(data || []) }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { error } = await supabase.from('dpo_incidents').insert({ ...form, occurred_at: new Date(form.occurred_at).toISOString(), reported_by: user.id }); if (error) setError(error.message); else { await logActivity('dpo.incident.append', 'dpo_incident', undefined, { title: form.title, severity: form.severity }); setForm({ ...form, title: '', description: '', containment_notes: '' }); load() } }
  return <div><PageHeader title="Incident Log" description="Append-only breach and privacy incident record." />{error && <p className="mb-4 rounded-lg bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    <form onSubmit={submit} className="card mb-6 grid gap-3 md:grid-cols-2"><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Incident title" className="rounded-lg border border-border px-3 py-2" /><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="rounded-lg border border-border px-3 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><input type="datetime-local" required value={form.occurred_at} onChange={e => setForm({ ...form, occurred_at: e.target.value })} className="rounded-lg border border-border px-3 py-2" /><input value={form.containment_notes} onChange={e => setForm({ ...form, containment_notes: e.target.value })} placeholder="Containment notes" className="rounded-lg border border-border px-3 py-2" /><textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What happened?" className="min-h-28 rounded-lg border border-border px-3 py-2 md:col-span-2" /><button className="btn-primary w-fit">Append incident</button></form>
    <div className="space-y-3">{items.map(item => <article key={item.id} className="card"><div className="flex items-center justify-between gap-4"><h2 className="font-semibold text-ink">{item.title}</h2><span className="rounded-full bg-rust/10 px-3 py-1 text-xs font-semibold uppercase text-rust">{item.severity}</span></div><p className="mt-2 text-sm text-muted">Occurred {new Date(item.occurred_at).toLocaleString('en-UG')}</p><p className="mt-3 text-sm">{item.description}</p>{item.containment_notes && <p className="mt-2 text-sm"><strong>Containment:</strong> {item.containment_notes}</p>}</article>)}</div>
  </div>
}
