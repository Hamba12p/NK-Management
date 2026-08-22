'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { archiveAndDeleteContent } from '@/lib/content-deletion'

type Activity = { id: string; activity_name: string; personal_data: string; purpose: string; storage_location: string }
const blank = { activity_name: '', personal_data: '', purpose: '', storage_location: '' }

export default function ProcessingRegisterPage() {
  const supabase = createClient(); const [items, setItems] = useState<Activity[]>([]); const [form, setForm] = useState(blank); const [error, setError] = useState('')
  const load = async () => { const { data, error } = await supabase.from('processing_activities').select('*').order('created_at', { ascending: false }); if (error) setError(error.message); else setItems(data || []) }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { error } = await supabase.from('processing_activities').insert({ ...form, created_by: user.id }); if (error) setError(error.message); else { setForm(blank); await logActivity('dpo.processing_activity.create', 'processing_activity', undefined, { title: form.activity_name }); load() } }
  const remove = async (id: string) => { if (!confirm('Remove this processing activity? It will be retained in the administrator archive.')) return; try { await archiveAndDeleteContent(supabase, 'processing_activity', id); load() } catch (err) { setError(err instanceof Error ? err.message : 'Unable to remove the processing activity') } }
  return <div><PageHeader title="Processing Register" description="Record of Processing Activities for personal data handled by the organisation." />
    {error && <p className="mb-4 rounded-lg border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    <form onSubmit={submit} className="card mb-6 grid gap-4 md:grid-cols-2"><input required value={form.activity_name} onChange={e => setForm({ ...form, activity_name: e.target.value })} placeholder="Activity, e.g. Volunteer applications" className="rounded-lg border border-border px-3 py-2" /><input required value={form.personal_data} onChange={e => setForm({ ...form, personal_data: e.target.value })} placeholder="Personal data collected" className="rounded-lg border border-border px-3 py-2" /><input required value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="Why it is processed" className="rounded-lg border border-border px-3 py-2" /><input required value={form.storage_location} onChange={e => setForm({ ...form, storage_location: e.target.value })} placeholder="Where it is stored" className="rounded-lg border border-border px-3 py-2" /><button className="btn-primary w-fit">Add activity</button></form>
    <div className="table-surface"><table className="w-full text-left text-sm"><thead><tr><th className="p-4">Activity</th><th className="p-4">Personal data</th><th className="p-4">Purpose</th><th className="p-4">Storage</th><th className="p-4" /></tr></thead><tbody>{items.map(item => <tr key={item.id}><td className="p-4 font-semibold text-ink">{item.activity_name}</td><td className="p-4">{item.personal_data}</td><td className="p-4">{item.purpose}</td><td className="p-4">{item.storage_location}</td><td className="p-4"><button onClick={() => remove(item.id)} className="text-sm text-rust">Remove</button></td></tr>)}</tbody></table></div>
  </div>
}
