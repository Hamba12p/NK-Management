'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import MEFrame, { Empty, Field, fieldClass } from '@/components/me/MEFrame'
import { checkResults, saveRecord, softDelete, useME } from '@/lib/me/client'
import { volunteerContributor } from '@/lib/creator'
import type { Profile, Program } from '@/lib/me/types'

async function query(client: SupabaseClient) {
  const [programs, profiles] = await Promise.all([
    client.from('programs').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    client.from('profiles').select('id,full_name,role').order('full_name'),
  ])
  checkResults(programs, profiles)
  return { programs: programs.data as Program[], profiles: profiles.data as Profile[] }
}
const blank = { name: '', description: '', status: 'active', start_date: '', end_date: '', owner_id: '' }
export default function ProgramsPage() {
  const me = useME(query)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string>()
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      await saveRecord(me.supabase, 'programs', me.profile!.id, { ...form, name: form.name.trim(), start_date: form.start_date || null, end_date: form.end_date || null, owner_id: form.owner_id || null, ...(!editing ? volunteerContributor() : {}) }, editing)
      setForm(blank); setEditing(undefined)
    })
  }
  return <MEFrame title="Programmes" description="Plan programme work and track its outcomes, evidence and actions." {...me}>
    {me.data && <>
      <form onSubmit={save} className="card mb-6">
        <h2 className="mb-4 font-bold text-ink">{editing ? 'Edit programme' : 'Create programme'}</h2>
        <fieldset disabled={me.busy} className="grid gap-4 md:grid-cols-2">
          <Field label="Name"><input className={fieldClass} required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Owner"><select className={fieldClass} value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}><option value="">Unassigned</option>{me.data.profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
          <Field label="Description"><textarea className={fieldClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Status"><select className={fieldClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{['active', 'completed', 'paused', 'cancelled'].map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Start date"><input type="date" className={fieldClass} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="End date"><input type="date" min={form.start_date} className={fieldClass} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field>
          <div className="flex gap-3"><button className="btn-primary">{me.busy ? 'Saving…' : 'Save programme'}</button>{editing && <button type="button" onClick={() => { setEditing(undefined); setForm(blank) }}>Cancel</button>}</div>
        </fieldset>
      </form>
      <div className="table-surface overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Programme', 'Status', 'Owner', 'Dates', 'Manage'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{me.data.programs.map(p => <tr key={p.id}>
        <td className="p-4"><Link className="font-semibold text-purple underline" href={`/dashboard/me/programs/${p.id}`}>{p.name}</Link><p className="mt-1 text-muted">{p.description}</p></td><td className="p-4">{p.status}</td><td className="p-4">{me.data!.profiles.find(owner => owner.id === p.owner_id)?.full_name || 'Unassigned'}</td><td className="p-4">{p.start_date || 'No start'} — {p.end_date || 'Ongoing'}</td>
        <td className="p-4"><div className="flex gap-3"><button disabled={me.busy} className="text-purple underline" onClick={() => { setEditing(p.id); setForm({ name: p.name, description: p.description || '', status: p.status, start_date: p.start_date || '', end_date: p.end_date || '', owner_id: p.owner_id || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button><button disabled={me.busy} className="text-rust underline" onClick={() => { if (confirm('Archive this programme? Its records will be retained.')) void me.run(() => softDelete(me.supabase, 'programs', p.id, me.profile!.id), 'Programme archived.') }}>Archive</button></div></td>
      </tr>)}</tbody></table>{!me.data.programs.length && <Empty>No programmes yet. Create the first programme above.</Empty>}</div>
    </>}
  </MEFrame>
}
