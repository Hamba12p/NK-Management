'use client'

import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import MEFrame, { Empty } from '@/components/me/MEFrame'
import { checkResults, useME } from '@/lib/me/client'
import { isOverdue, type Action, type Finding, type Risk, type Measurement, type Kpi, type Program } from '@/lib/me/types'

async function query(client: SupabaseClient) {
  const [programs, findings, risks, tasks, measurements, kpis] = await Promise.all([
    client.from('programs').select('*').is('deleted_at', null),
    client.from('findings').select('*').is('deleted_at', null),
    client.from('risks').select('*').is('deleted_at', null),
    client.from('tasks').select('*').is('deleted_at', null).or('source_finding_id.not.is.null,source_risk_id.not.is.null'),
    client.from('kpi_measurements').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
    client.from('program_kpis').select('*').is('deleted_at', null),
  ])
  checkResults(programs, findings, risks, tasks, measurements, kpis)
  return { programs: programs.data as Program[], findings: findings.data as Finding[], risks: risks.data as Risk[], tasks: tasks.data as Action[], measurements: measurements.data as Measurement[], kpis: kpis.data as Kpi[] }
}
export default function MEPage() {
  const me = useME(query)
  const findings = me.data?.findings.filter(f => ['open', 'under_review'].includes(f.status)) || []
  const risks = me.data?.risks.filter(r => r.status !== 'closed') || []
  const overdue = me.data?.tasks.filter(t => isOverdue(t)) || []
  return <MEFrame title="M&E & Board" description="Monitor outcomes, review findings and risks, and prepare evidence-led board briefs." {...me}>
    {me.data && <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Active programmes" value={me.data.programs.filter(p => p.status === 'active').length} /><Stat label="Open findings" value={findings.length} /><Stat label="Open risks" value={risks.length} /><Stat label="Overdue actions" value={overdue.length} /></div>
      <div className="mb-6 grid gap-6 md:grid-cols-2"><section className="card"><h2 className="mb-4 font-bold">Open findings by severity</h2><dl className="space-y-3">{['critical', 'high', 'medium', 'low'].map(level => <div key={level} className="flex justify-between text-sm"><dt className="capitalize">{level}</dt><dd className="font-bold text-purple">{findings.filter(f => f.severity === level).length}</dd></div>)}</dl><Link className="mt-4 inline-block text-sm text-purple underline" href="/dashboard/me/findings">Review findings</Link></section>
        <section className="card"><h2 className="mb-4 font-bold">Open risks by impact</h2><dl className="space-y-3">{['high', 'medium', 'low'].map(level => <div key={level} className="flex justify-between text-sm"><dt className="capitalize">{level}</dt><dd className="font-bold text-purple">{risks.filter(r => r.impact === level).length}</dd></div>)}</dl><Link className="mt-4 inline-block text-sm text-purple underline" href="/dashboard/me/risks">Review risks</Link></section></div>
      <section className="card mb-6"><h2 className="font-bold">Overdue actions</h2><ul className="divide-y divide-purple/10">{overdue.map(t => <li key={t.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><Link href="/dashboard/workspace" className="text-purple underline">{t.title}</Link><span className="text-rust">Due {t.due_date}</span></li>)}</ul>{!overdue.length && <Empty>No overdue M&E actions.</Empty>}</section>
      <section className="table-surface overflow-x-auto"><h2 className="p-4 font-bold">Recent KPI measurements</h2><table className="w-full text-left text-sm"><thead><tr>{['KPI', 'Value', 'Period', 'Recorded'].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{me.data.measurements.map(m => { const kpi = me.data!.kpis.find(k => k.id === m.kpi_id); return <tr key={m.id}><td className="p-4">{kpi ? <Link className="text-purple underline" href={`/dashboard/me/programs/${kpi.program_id}`}>{kpi.name}</Link> : 'Archived KPI'}</td><td className="p-4">{m.value} {kpi?.unit}</td><td className="p-4">{m.period_start} — {m.period_end}</td><td className="p-4">{m.created_at.slice(0, 10)}</td></tr> })}</tbody></table>{!me.data.measurements.length && <Empty>No measurements recorded yet.</Empty>}</section>
    </>}
  </MEFrame>
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="card"><p className="text-sm text-muted">{label}</p><p className="serif-display mt-2 text-3xl text-ink">{value}</p></div> }
