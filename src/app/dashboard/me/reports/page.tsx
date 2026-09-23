'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Packer } from 'docx'
import type { SupabaseClient } from '@supabase/supabase-js'
import MEFrame, { Field, Empty, fieldClass } from '@/components/me/MEFrame'
import { checkResults, softDelete, uploadRestrictedDocument, useME } from '@/lib/me/client'
import { buildBoardBrief, loadReport, reportSnapshot, type ReportScope } from '@/lib/me/report'
import { logActivity } from '@/lib/activity'
import { today, type Program, type BoardReport } from '@/lib/me/types'

async function query(client: SupabaseClient) {
  const [programs, reports] = await Promise.all([
    client.from('programs').select('*').is('deleted_at', null).order('name'),
    client.from('board_reports').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
  ])
  checkResults(programs, reports)
  return { programs: programs.data as Program[], reports: reports.data as BoardReport[] }
}
type PendingReport = { id: string; documentId: string; scope: ReportScope; snapshot: ReturnType<typeof reportSnapshot> }
export default function ReportsPage() {
  const me = useME(query)
  const [scope, setScope] = useState<ReportScope>({ title: 'Board advisory brief', programId: '', start: today().slice(0, 8) + '01', end: today() })
  const [pending, setPending] = useState<PendingReport | null>(null)
  const [generated, setGenerated] = useState('')
  const persist = async (report: PendingReport) => {
    const result = await me.supabase.from('board_reports').upsert({ id: report.id, title: report.scope.title.trim(), period_start: report.scope.start, period_end: report.scope.end, program_id: report.scope.programId || null,
      document_id: report.documentId, summary_snapshot: report.snapshot, generated_by: me.profile!.id }, { onConflict: 'id' }).select('id').single()
    checkResults(result)
    await logActivity('generate', 'board_report', result.data!.id, { document_id: report.documentId }, { client: me.supabase, actorId: me.profile!.id })
    setGenerated(report.documentId); setPending(null)
  }
  const generate = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      const data = await loadReport(me.supabase, scope)
      const snapshot = reportSnapshot(data, scope)
      const blob = await Packer.toBlob(buildBoardBrief(data, scope, snapshot))
      const name = `${scope.title.replace(/[^a-z0-9]+/gi, '-') || 'board-brief'}-${scope.end}.docx`
      const file = new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const documentId = await uploadRestrictedDocument(me.supabase, me.profile!.id, file, 'report')
      const report = { id: crypto.randomUUID(), documentId, scope: { ...scope }, snapshot }
      setPending(report)
      await persist(report)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob); link.download = name; link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }, 'Board brief generated and stored as a restricted document.')
  }
  return <MEFrame title="Board briefs" description="Generate a structured Word brief from recorded programme evidence. Each brief retains the figures used at generation." {...me}>
    {me.data && <>
      <form onSubmit={generate} className="card mb-6"><fieldset disabled={me.busy || !!pending} className="grid gap-4 md:grid-cols-2">
        <Field label="Brief title"><input className={fieldClass} value={scope.title} required maxLength={200} onChange={e => setScope({ ...scope, title: e.target.value })} /></Field>
        <Field label="Programme scope"><select className={fieldClass} value={scope.programId} onChange={e => setScope({ ...scope, programId: e.target.value })}><option value="">All programmes</option>{me.data.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Period start"><input type="date" className={fieldClass} required value={scope.start} onChange={e => setScope({ ...scope, start: e.target.value })} /></Field>
        <Field label="Period end"><input type="date" className={fieldClass} required min={scope.start} value={scope.end} onChange={e => setScope({ ...scope, end: e.target.value })} /></Field>
        <p className="text-sm text-muted md:col-span-2">Dates use UTC. Includes measurements ending in the period, findings and risks recorded in the period, and currently open actions created by period end. Statuses reflect the time of generation.</p>
        <button className="btn-primary w-fit">{me.busy ? 'Generating…' : 'Generate board brief'}</button>
      </fieldset></form>
      {pending && <div className="card mb-6"><p className="mb-3 text-sm">The restricted file is saved. Retry saving its board report record without uploading another copy.</p><button className="btn-primary" disabled={me.busy} onClick={() => void me.run(() => persist(pending), 'Board report record saved.')}>Retry saving report</button><Link className="ml-3 text-purple underline" href={`/dashboard/me/documents/${pending.documentId}`}>Open saved file</Link></div>}
      {generated && <p className="mb-6"><Link className="font-semibold text-purple underline" href={`/dashboard/me/documents/${generated}`}>Preview generated brief</Link> · <Link className="text-purple underline" href="/dashboard/documents">Document repository</Link></p>}
      <div className="table-surface overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Brief', 'Period', 'Generated', 'Manage'].map(h => <th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{me.data.reports.map(r => <tr key={r.id}><td className="p-4">{r.document_id ? <Link className="text-purple underline" href={`/dashboard/me/documents/${r.document_id}`}>{r.title}</Link> : r.title}</td><td className="p-4">{r.period_start} — {r.period_end}</td><td className="p-4">{r.created_at.slice(0, 10)}</td><td className="p-4"><button className="text-rust underline" disabled={me.busy} onClick={() => { if (confirm('Archive this board report record? Its document and snapshot are retained.')) void me.run(() => softDelete(me.supabase, 'board_reports', r.id, me.profile!.id)) }}>Archive</button></td></tr>)}</tbody></table>{!me.data.reports.length && <Empty>No board briefs generated yet.</Empty>}</div>
    </>}
  </MEFrame>
}
