'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import MEFrame, { Field, Empty, fieldClass } from '@/components/me/MEFrame'
import EvidencePanel from '@/components/me/EvidencePanel'
import { checkResults, saveRecord, softDelete, useME } from '@/lib/me/client'
import { logActivity } from '@/lib/activity'
import { latestMeasurements, isOverdue, today, type Program, type Kpi, type Measurement, type Finding, type Risk, type Action } from '@/lib/me/types'

const blankKpi = { name: '', description: '', unit: 'count', baseline_value: '', target_value: '', frequency: 'monthly' }
export default function ProgramPage() {
  const { id } = useParams<{ id: string }>()
  const query = useCallback(async (client: SupabaseClient) => {
    const [program, kpis, findings, risks, tasks] = await Promise.all([
      client.from('programs').select('*').eq('id', id).is('deleted_at', null).single(),
      client.from('program_kpis').select('*').eq('program_id', id).is('deleted_at', null).order('name'),
      client.from('findings').select('*').eq('program_id', id).is('deleted_at', null),
      client.from('risks').select('*').eq('program_id', id).is('deleted_at', null),
      client.from('tasks').select('*').eq('source_program_id', id).is('deleted_at', null),
    ])
    checkResults(program, kpis, findings, risks, tasks)
    const measurements = kpis.data!.length ? await client.from('kpi_measurements').select('*').in('kpi_id', kpis.data!.map(k => k.id)).is('deleted_at', null).order('period_end', { ascending: false }) : { data: [], error: null }
    checkResults(measurements)
    return { program: program.data as Program, kpis: kpis.data as Kpi[], findings: findings.data as Finding[], risks: risks.data as Risk[], tasks: tasks.data as Action[], measurements: measurements.data as Measurement[] }
  }, [id])
  const me = useME(query)
  const [kpiForm, setKpiForm] = useState(blankKpi)
  const [editingKpi, setEditingKpi] = useState<string>()
  const [measurement, setMeasurement] = useState({ kpi_id: '', value: '', period_start: today(), period_end: today(), notes: '' })
  const [editingMeasurement, setEditingMeasurement] = useState<string>()
  const saveKpi = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      await saveRecord(me.supabase, 'program_kpis', me.profile!.id, { ...kpiForm, program_id: id, baseline_value: kpiForm.baseline_value === '' ? null : Number(kpiForm.baseline_value), target_value: kpiForm.target_value === '' ? null : Number(kpiForm.target_value) }, editingKpi)
      setKpiForm(blankKpi); setEditingKpi(undefined)
    })
  }
  const saveMeasurement = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      const values = { ...measurement, value: Number(measurement.value), recorded_by: me.profile!.id }
      const result = editingMeasurement
        ? await me.supabase.from('kpi_measurements').update(values).eq('id', editingMeasurement).is('deleted_at', null).select('id').single()
        : await me.supabase.from('kpi_measurements').insert(values).select('id').single()
      checkResults(result)
      await logActivity(editingMeasurement ? 'update' : 'create', 'kpi_measurement', result.data!.id, {}, { client: me.supabase, actorId: me.profile!.id })
      setMeasurement(m => ({ ...m, value: '', notes: '' })); setEditingMeasurement(undefined)
    })
  }
  return <MEFrame title={me.data?.program.name || 'Programme detail'} description={me.data?.program.description || 'KPIs, findings, risks, actions and evidence for this programme.'} {...me}>
    {me.data && <>
      <p className="mb-6 text-sm text-purple">{me.data.program.status} · {me.data.program.start_date || 'No start date'} — {me.data.program.end_date || 'Ongoing'}</p>
      <section className="table-surface mb-6 overflow-x-auto"><h2 className="p-4 font-bold">Programme KPIs</h2><table className="w-full text-left text-sm"><thead><tr>{['KPI', 'Baseline', 'Target', 'Latest', 'Trend', 'Manage'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{me.data.kpis.map(k => {
        const [latest, previous] = latestMeasurements(me.data!.measurements, k.id)
        const delta = latest && previous ? Number(latest.value) - Number(previous.value) : null
        return <tr key={k.id}><td className="p-4 font-semibold">{k.name}<p className="text-xs font-normal text-muted">{k.frequency} · {k.unit}</p></td><td className="p-4">{k.baseline_value ?? '—'}</td><td className="p-4">{k.target_value ?? '—'}</td><td className="p-4">{latest ? `${latest.value} (${latest.period_end})` : 'Not measured'}</td><td className="p-4">{delta === null ? 'Needs 2 readings' : `${delta > 0 ? '+' : ''}${delta} ${k.unit}`}</td><td className="p-4"><div className="flex gap-3"><button className="text-purple underline" disabled={me.busy} onClick={() => { setEditingKpi(k.id); setKpiForm({ name: k.name, description: k.description || '', unit: k.unit, baseline_value: k.baseline_value?.toString() ?? '', target_value: k.target_value?.toString() ?? '', frequency: k.frequency }) }}>Edit</button><button className="text-rust underline" disabled={me.busy} onClick={() => { if (confirm('Archive this KPI? Measurements will be retained.')) void me.run(() => softDelete(me.supabase, 'program_kpis', k.id, me.profile!.id)) }}>Archive</button></div></td></tr>
      })}</tbody></table>{!me.data.kpis.length && <Empty>No KPIs yet.</Empty>}</section>
      <form onSubmit={saveKpi} className="card mb-6"><h2 className="mb-4 font-bold">{editingKpi ? 'Edit KPI' : 'Add KPI'}</h2><fieldset disabled={me.busy} className="grid gap-4 md:grid-cols-3">
        {(['name', 'description', 'unit', 'baseline_value', 'target_value'] as const).map(key => <Field key={key} label={key.replaceAll('_', ' ')}><input className={fieldClass} type={key.endsWith('value') ? 'number' : 'text'} step="any" required={key === 'name' || key === 'unit'} value={kpiForm[key]} onChange={e => setKpiForm({ ...kpiForm, [key]: e.target.value })} /></Field>)}
        <Field label="Frequency"><select className={fieldClass} value={kpiForm.frequency} onChange={e => setKpiForm({ ...kpiForm, frequency: e.target.value })}>{['weekly', 'monthly', 'quarterly', 'annual', 'one_off'].map(f => <option key={f}>{f}</option>)}</select></Field><button className="btn-primary w-fit">Save KPI</button>{editingKpi && <button type="button" onClick={() => { setEditingKpi(undefined); setKpiForm(blankKpi) }}>Cancel</button>}
      </fieldset></form>
      <form onSubmit={saveMeasurement} className="card mb-6"><h2 className="mb-4 font-bold">{editingMeasurement ? 'Edit measurement' : 'Record measurement'}</h2><fieldset disabled={me.busy || !me.data.kpis.length} className="grid gap-4 md:grid-cols-3">
        <Field label="KPI"><select className={fieldClass} required value={measurement.kpi_id} onChange={e => setMeasurement({ ...measurement, kpi_id: e.target.value })}><option value="">Choose KPI</option>{me.data.kpis.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
        <Field label="Value"><input className={fieldClass} type="number" step="any" required value={measurement.value} onChange={e => setMeasurement({ ...measurement, value: e.target.value })} /></Field>
        <Field label="Period start"><input className={fieldClass} type="date" required value={measurement.period_start} onChange={e => setMeasurement({ ...measurement, period_start: e.target.value })} /></Field>
        <Field label="Period end"><input className={fieldClass} type="date" required min={measurement.period_start} value={measurement.period_end} onChange={e => setMeasurement({ ...measurement, period_end: e.target.value })} /></Field>
        <Field label="Notes"><textarea className={fieldClass} value={measurement.notes} onChange={e => setMeasurement({ ...measurement, notes: e.target.value })} /></Field><div className="flex items-end gap-3"><button className="btn-primary">Save measurement</button>{editingMeasurement && <button type="button" onClick={() => { setEditingMeasurement(undefined); setMeasurement(m => ({ ...m, value: '', notes: '' })) }}>Cancel</button>}</div>
      </fieldset></form>
      <section className="card mb-6"><h2 className="font-bold">Measurement history</h2><ul className="divide-y divide-purple/10">{me.data.measurements.map(m => <li key={m.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{me.data!.kpis.find(k => k.id === m.kpi_id)?.name}: {m.value} · {m.period_start} — {m.period_end}{m.notes && <span className="block text-muted">{m.notes}</span>}</span><div className="flex gap-3"><button className="text-purple underline" disabled={me.busy} onClick={() => { setEditingMeasurement(m.id); setMeasurement({ kpi_id: m.kpi_id, value: String(m.value), period_start: m.period_start, period_end: m.period_end, notes: m.notes || '' }) }}>Edit</button><button className="text-rust underline" disabled={me.busy} onClick={() => { if (confirm('Archive this measurement?')) void me.run(() => softDelete(me.supabase, 'kpi_measurements', m.id, me.profile!.id)) }}>Archive</button></div></li>)}</ul>{!me.data.measurements.length && <Empty>No measurements yet.</Empty>}</section>
      <div className="mb-6 grid gap-6 md:grid-cols-2">{(['findings', 'risks'] as const).map(kind => <section key={kind} className="card"><h2 className="font-bold capitalize">{kind}</h2><ul>{me.data![kind].map(r => <li key={r.id} className="py-2 text-sm">{r.title} · {r.status}</li>)}</ul>{!me.data![kind].length && <Empty>No {kind} linked.</Empty>}<Link className="text-sm text-purple underline" href={`/dashboard/me/${kind}`}>Manage {kind}</Link></section>)}</div>
      <section className="card mb-6"><h2 className="font-bold">Linked actions</h2><ul>{me.data.tasks.map(t => <li key={t.id} className="py-2 text-sm">{t.title} · {t.status.replaceAll('_', ' ')} · {t.due_date || 'No due date'} {isOverdue(t) && <span className="text-rust">Overdue</span>}</li>)}</ul>{!me.data.tasks.length && <Empty>No linked actions.</Empty>}<Link href="/dashboard/workspace" className="text-sm text-purple underline">Open shared Workspace</Link></section>
      <section className="card"><h2 className="font-bold">Programme evidence</h2><EvidencePanel target={{ program_id: id }} /></section>
    </>}
  </MEFrame>
}
