'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import MEFrame, { Empty, Field, fieldClass } from './MEFrame'
import EvidencePanel from './EvidencePanel'
import { checkResults, saveRecord, softDelete, useME } from '@/lib/me/client'
import { volunteerContributor } from '@/lib/creator'
import { logActivity } from '@/lib/activity'
import type { Finding, Risk, Program, Profile } from '@/lib/me/types'

const blank = { title: '', description: '', program_id: '', status: 'open', category: 'monitoring', severity: 'medium', source_meeting_id: '', finding_id: '', likelihood: 'medium', impact: 'medium', mitigation_plan: '', owner_id: '' }
export default function RecordList({ kind }: { kind: 'findings' | 'risks' }) {
  const finding = kind === 'findings'
  const query = useCallback(async (client: SupabaseClient) => {
    const [records, programs, profiles, meetings, findings, tasks] = await Promise.all([
      client.from(kind).select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      client.from('programs').select('*').is('deleted_at', null).order('name'),
      client.from('profiles').select('id,full_name,role').order('full_name'),
      client.from('meetings').select('id,title').is('deleted_at', null).order('scheduled_at', { ascending: false }),
      client.from('findings').select('*').is('deleted_at', null).order('title'),
      client.from('tasks').select('id,source_finding_id,source_risk_id').is('deleted_at', null).not(finding ? 'source_finding_id' : 'source_risk_id', 'is', null),
    ])
    checkResults(records, programs, profiles, meetings, findings, tasks)
    return { records: records.data as (Finding & Risk)[], programs: programs.data as Program[], profiles: profiles.data as Profile[], meetings: meetings.data!, findings: findings.data as Finding[], tasks: tasks.data! }
  }, [kind, finding])
  const me = useME(query)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string>()
  const [filter, setFilter] = useState({ program: '', level: '', status: '' })
  const [actionSource, setActionSource] = useState<(Finding & Risk) | null>(null)
  const [action, setAction] = useState({ title: '', due_date: '', assignee_id: '' })
  const [evidenceSource, setEvidenceSource] = useState<(Finding & Risk) | null>(null)
  const statuses = finding ? ['open', 'under_review', 'resolved', 'closed'] : ['open', 'mitigating', 'closed']
  const levels = finding ? ['low', 'medium', 'high', 'critical'] : ['low', 'medium', 'high']
  const change = (key: keyof typeof blank, value: string) => setForm(current => ({ ...current, [key]: value }))
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      const values = { title: form.title.trim(), description: form.description.trim(), program_id: form.program_id || null, status: form.status,
        ...(finding ? { category: form.category, severity: form.severity, source_meeting_id: form.source_meeting_id || null } : { finding_id: form.finding_id || null, likelihood: form.likelihood, impact: form.impact, mitigation_plan: form.mitigation_plan || null, owner_id: form.owner_id || null }),
        ...(!editing ? volunteerContributor() : {}) }
      await saveRecord(me.supabase, kind, me.profile!.id, values, editing)
      setEditing(undefined); setForm(blank)
    })
  }
  const convert = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      if (!actionSource) return
      const result = await me.supabase.from('tasks').insert({ title: action.title.trim(), due_date: action.due_date || null, assignee_id: action.assignee_id || me.profile!.id,
        created_by: me.profile!.id, source_program_id: actionSource.program_id, [finding ? 'source_finding_id' : 'source_risk_id']: actionSource.id, ...volunteerContributor() }).select('id').single()
      if (result.error?.code === '23505') throw new Error('This record already has an active action.')
      checkResults(result)
      await logActivity(finding ? 'task.create_from_finding' : 'task.create_from_risk', 'task', result.data!.id, { source_id: actionSource.id }, { client: me.supabase, actorId: me.profile!.id })
      setActionSource(null); setAction({ title: '', due_date: '', assignee_id: '' })
    }, 'Action created in the shared Workspace.')
  }
  const visible = me.data?.records.filter(r => (!filter.program || (r.program_id || 'none') === filter.program) && (!filter.level || r[finding ? 'severity' : 'impact'] === filter.level) && (!filter.status || r.status === filter.status)) || []
  return <MEFrame title={finding ? 'Findings' : 'Risks'} description={finding ? 'Record evidence-based findings and turn recommendations into accountable actions.' : 'Assess programme risks and track mitigation work.'} {...me}>
    {me.data && <>
      <form onSubmit={save} className="card mb-6"><h2 className="mb-4 font-bold">{editing ? 'Edit' : 'Create'} {finding ? 'finding' : 'risk'}</h2>
        <fieldset disabled={me.busy} className="grid gap-4 md:grid-cols-2">
          <Field label="Title"><input className={fieldClass} value={form.title} required maxLength={200} onChange={e => change('title', e.target.value)} /></Field>
          <Field label="Programme"><select className={fieldClass} value={form.program_id} onChange={e => change('program_id', e.target.value)}><option value="">Cross-programme</option>{me.data.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Description"><textarea className={fieldClass} required value={form.description} onChange={e => change('description', e.target.value)} /></Field>
          <Field label="Status"><select className={fieldClass} value={form.status} onChange={e => change('status', e.target.value)}>{statuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></Field>
          <Field label={finding ? 'Severity' : 'Impact'}><select className={fieldClass} value={finding ? form.severity : form.impact} onChange={e => change(finding ? 'severity' : 'impact', e.target.value)}>{levels.map(l => <option key={l}>{l}</option>)}</select></Field>
          {finding ? <>
            <Field label="Category"><select className={fieldClass} value={form.category} onChange={e => change('category', e.target.value)}>{['monitoring', 'evaluation', 'feedback', 'audit', 'other'].map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Source meeting"><select className={fieldClass} value={form.source_meeting_id} onChange={e => change('source_meeting_id', e.target.value)}><option value="">None</option>{me.data.meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></Field>
          </> : <>
            <Field label="Likelihood"><select className={fieldClass} value={form.likelihood} onChange={e => change('likelihood', e.target.value)}>{['low', 'medium', 'high'].map(l => <option key={l}>{l}</option>)}</select></Field>
            <Field label="Source finding"><select className={fieldClass} value={form.finding_id} onChange={e => change('finding_id', e.target.value)}><option value="">None</option>{me.data.findings.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select></Field>
            <Field label="Owner"><select className={fieldClass} value={form.owner_id} onChange={e => change('owner_id', e.target.value)}><option value="">Unassigned</option>{me.data.profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
            <Field label="Mitigation plan"><textarea className={fieldClass} value={form.mitigation_plan} onChange={e => change('mitigation_plan', e.target.value)} /></Field>
          </>}
          <div className="flex gap-3"><button className="btn-primary">{me.busy ? 'Saving…' : 'Save record'}</button>{editing && <button type="button" onClick={() => { setEditing(undefined); setForm(blank) }}>Cancel</button>}</div>
        </fieldset>
      </form>
      <div className="card mb-6 grid gap-4 md:grid-cols-3">
        <Field label="Filter programme"><select className={fieldClass} value={filter.program} onChange={e => setFilter({ ...filter, program: e.target.value })}><option value="">All programmes</option><option value="none">Cross-programme</option>{me.data.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label={finding ? 'Filter severity' : 'Filter impact'}><select className={fieldClass} value={filter.level} onChange={e => setFilter({ ...filter, level: e.target.value })}><option value="">All levels</option>{levels.map(l => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Filter status"><select className={fieldClass} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></Field>
      </div>
      {actionSource && <form onSubmit={convert} className="card mb-6"><h2 className="font-bold">Create action</h2><p className="my-3 text-sm text-muted">Tasks are visible to all staff in Workspace. Use a task title suitable for the shared workspace; the private description is not copied.</p><fieldset disabled={me.busy} className="grid gap-4 md:grid-cols-3"><Field label="Shared task title"><input className={fieldClass} required maxLength={200} value={action.title} onChange={e => setAction({ ...action, title: e.target.value })} /></Field><Field label="Due date"><input type="date" className={fieldClass} value={action.due_date} onChange={e => setAction({ ...action, due_date: e.target.value })} /></Field><Field label="Assignee"><select className={fieldClass} value={action.assignee_id} onChange={e => setAction({ ...action, assignee_id: e.target.value })}><option value="">Me</option>{me.data.profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field><button className="btn-primary">Create shared action</button><button type="button" onClick={() => setActionSource(null)}>Cancel</button></fieldset></form>}
      <div className="space-y-4">{visible.map(record => <article key={record.id} className="card">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-ink">{record.title}</h2><p className="mt-1 text-sm text-purple">{me.data!.programs.find(p => p.id === record.program_id)?.name || 'Cross-programme'} · {record[finding ? 'severity' : 'impact']} · {record.status.replaceAll('_', ' ')}</p></div><div className="flex flex-wrap gap-3 text-sm">
          <button className="text-purple underline" disabled={me.busy} onClick={() => { setEditing(record.id); setForm({ ...blank, ...Object.fromEntries(Object.keys(blank).map(key => [key, record[key as keyof typeof record] ?? blank[key as keyof typeof blank]])) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button>
          <button className="text-purple underline" onClick={() => setEvidenceSource(record)}>Evidence</button>
          {me.data!.tasks.some(t => t[finding ? 'source_finding_id' : 'source_risk_id'] === record.id) ? <Link className="text-purple underline" href="/dashboard/workspace">View action</Link> : <button className="text-purple underline" disabled={me.busy} onClick={() => { setActionSource(record); setAction({ title: '', due_date: '', assignee_id: '' }) }}>Convert to action</button>}
          <button className="text-rust underline" disabled={me.busy} onClick={() => { if (confirm('Archive this record? It will be retained.')) void me.run(() => softDelete(me.supabase, kind, record.id, me.profile!.id), 'Record archived.') }}>Archive</button>
        </div></div><p className="mt-4 whitespace-pre-wrap text-sm text-muted">{record.description}</p>{!finding && <p className="mt-3 text-sm text-muted">Likelihood: {record.likelihood}. Mitigation: {record.mitigation_plan || 'Not recorded'}</p>}
      </article>)}{!visible.length && <Empty>No records match these filters.</Empty>}</div>
      {evidenceSource && <section className="card mt-6"><div className="flex justify-between gap-4"><h2 className="font-bold">Evidence for {evidenceSource.title}</h2><button className="text-purple underline" onClick={() => setEvidenceSource(null)}>Close evidence</button></div><EvidencePanel key={evidenceSource.id} target={finding ? { finding_id: evidenceSource.id } : { risk_id: evidenceSource.id }} /></section>}
    </>}
  </MEFrame>
}
