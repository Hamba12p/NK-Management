'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type Request = { id: string; requester: string; request_type: string; received_at: string; status: string; resolution_notes?: string }
export default function DataRequestsPage() {
  const supabase = createClient(); const [items, setItems] = useState<Request[]>([]); const [error, setError] = useState(''); const [form, setForm] = useState({ requester: '', request_type: 'access', received_at: new Date().toISOString().slice(0, 10) })
  const load = async () => { const { data, error } = await supabase.from('data_subject_requests').select('*').order('received_at', { ascending: false }); if (error) setError(error.message); else setItems(data || []) }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { error } = await supabase.from('data_subject_requests').insert({ ...form, created_by: user.id }); if (error) setError(error.message); else { await logActivity('dpo.request.create', 'data_subject_request', undefined, { requester: form.requester, type: form.request_type }); setForm({ ...form, requester: '' }); load() } }
  const changeStatus = async (id: string, status: string) => { const { error } = await supabase.from('data_subject_requests').update({ status }).eq('id', id); if (error) setError(error.message); else load() }
  return <div><PageHeader title="Data Subject Requests" description="Track access, deletion, and correction requests under the Uganda Data Protection and Privacy Act." />{error && <p className="mb-4 rounded-lg bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    <form onSubmit={submit} className="card mb-6 flex flex-col gap-3 md:flex-row"><input required value={form.requester} onChange={e => setForm({ ...form, requester: e.target.value })} placeholder="Requester name or reference" className="flex-1 rounded-lg border border-border px-3 py-2" /><select value={form.request_type} onChange={e => setForm({ ...form, request_type: e.target.value })} className="rounded-lg border border-border px-3 py-2"><option value="access">Access</option><option value="deletion">Deletion</option><option value="correction">Correction</option></select><input type="date" value={form.received_at} onChange={e => setForm({ ...form, received_at: e.target.value })} className="rounded-lg border border-border px-3 py-2" /><button className="btn-primary">Log request</button></form>
    <div className="space-y-3">{items.map(item => <article key={item.id} className="card flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">{item.requester}</h2><p className="text-sm text-muted">{item.request_type} request · received {item.received_at}</p>{item.resolution_notes && <p className="mt-1 text-sm">{item.resolution_notes}</p>}</div><select value={item.status} onChange={e => changeStatus(item.id, e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></article>)}</div>
  </div>
}
