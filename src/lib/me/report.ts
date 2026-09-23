import { Document, HeadingLevel, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOverdue, latestMeasurements, type Action, type Finding, type Kpi, type Measurement, type Program, type Risk } from './types'

export type ReportScope = { programId: string; start: string; end: string; title: string }
export type ReportData = { programs: Program[]; kpis: Kpi[]; measurements: Measurement[]; findings: Finding[]; risks: Risk[]; tasks: Action[] }
export function validateScope(scope: ReportScope) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
  if (!scope.title.trim() || !validDate(scope.start) || !validDate(scope.end) || scope.start > scope.end) throw new Error('Enter a title and a valid reporting period.')
}

// Page through every result so board totals are not silently capped at the
// PostgREST default row limit. Keep each page below that default.
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await query(offset, offset + 499)
    if (result.error) throw new Error(result.error.message)
    rows.push(...(result.data || []) as T[])
    if ((result.data?.length || 0) < 500) return rows
  }
}
export async function loadReport(client: SupabaseClient, scope: ReportScope): Promise<ReportData> {
  validateScope(scope)
  const scoped = (table: string, column = 'program_id') => {
    const query = client.from(table).select('*').is('deleted_at', null).order('id')
    return scope.programId ? query.eq(column, scope.programId) : query
  }
  const endExclusive = new Date(`${scope.end}T00:00:00Z`)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
  const [programs, kpis, findings, risks, tasks] = await Promise.all([
    allRows<Program>((a, b) => scoped('programs', 'id').lt('created_at', endExclusive.toISOString()).range(a, b)),
    allRows<Kpi>((a, b) => scoped('program_kpis').lt('created_at', endExclusive.toISOString()).range(a, b)),
    allRows<Finding>((a, b) => scoped('findings').gte('created_at', `${scope.start}T00:00:00Z`).lt('created_at', endExclusive.toISOString()).range(a, b)),
    allRows<Risk>((a, b) => scoped('risks').gte('created_at', `${scope.start}T00:00:00Z`).lt('created_at', endExclusive.toISOString()).range(a, b)),
    allRows<Action>((a, b) => scoped('tasks', 'source_program_id').or('source_finding_id.not.is.null,source_risk_id.not.is.null,source_program_id.not.is.null').lt('created_at', endExclusive.toISOString()).neq('status', 'done').range(a, b)),
  ])
  const measurements: Measurement[] = []
  // Chunk IN filters to keep request URLs bounded on larger programme sets.
  for (let offset = 0; offset < kpis.length; offset += 100) {
    measurements.push(...await allRows<Measurement>((a, b) => client.from('kpi_measurements').select('*')
      .in('kpi_id', kpis.slice(offset, offset + 100).map(k => k.id)).is('deleted_at', null)
      .gte('period_end', scope.start).lte('period_end', scope.end).order('id').range(a, b)))
  }
  if (scope.programId && !programs.length) throw new Error('Programme is unavailable for this reporting period.')
  return { programs, kpis, measurements, findings, risks, tasks }
}
export function reportSnapshot(data: ReportData, scope: ReportScope) {
  validateScope(scope)
  return {
    version: 1, generated_at: new Date().toISOString(), scope,
    methodology: 'UTC dates. KPIs use the latest measurement ending within the period. Findings and risks were recorded within the period. Actions were created by period end and are currently open; overdue is assessed at period end. Statuses are current at generation, not historical reconstructions.',
    totals: { programs: data.programs.length, kpis: data.kpis.length, findings: data.findings.length, risks: data.risks.length, open_actions: data.tasks.length, overdue_actions: data.tasks.filter(t => isOverdue(t, scope.end)).length },
    kpi_summary: data.kpis.map(k => ({ ...k, latest: latestMeasurements(data.measurements, k.id)[0] || null })),
    findings: data.findings, risks: data.risks, actions: data.tasks,
  }
}
function table(headers: string[], rows: string[][]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headers, ...rows].map((cells, index) => new TableRow({ tableHeader: index === 0, cantSplit: true, children: cells.map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: index === 0, size: 20 })] })], margins: { top: 100, bottom: 100, left: 100, right: 100 } })) })) })
}
export function buildBoardBrief(data: ReportData, scope: ReportScope, snapshot = reportSnapshot(data, scope)) {
  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 })
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: scope.title, heading: HeadingLevel.TITLE }),
    new Paragraph('NK Udada Foundation'),
    new Paragraph(scope.programId ? data.programs.find(p => p.id === scope.programId)?.name || 'Programme brief' : 'Organisation wide board brief'),
    new Paragraph(`Reporting period ${scope.start} to ${scope.end}`),
    new Paragraph('Restricted to administrators and board advisors'),
    new Paragraph(`Generated ${snapshot.generated_at.slice(0, 10)}`),
    new Paragraph('This brief presents programme outcomes, recorded findings, risks and open actions for board review.'),
    new Paragraph({ text: 'Scope and method', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
    new Paragraph(snapshot.methodology),
    new Paragraph(`${snapshot.totals.programs} programmes; ${snapshot.totals.kpis} KPIs; ${snapshot.totals.findings} findings; ${snapshot.totals.risks} risks; ${snapshot.totals.open_actions} open actions; ${snapshot.totals.overdue_actions} overdue actions.`),
    heading('KPI summary'),
    table(['KPI and unit', 'Baseline', 'Target', 'Latest in period'], snapshot.kpi_summary.map(k => [k.name + ' (' + k.unit + ')', String(k.baseline_value ?? 'Not set'), String(k.target_value ?? 'Not set'), k.latest ? `${k.latest.value} on ${k.latest.period_end}` : 'No measurement'])),
  ]
  children.push(heading('Findings by severity'))
  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const rows = data.findings.filter(f => f.severity === severity)
    children.push(new Paragraph({ text: `${severity[0].toUpperCase() + severity.slice(1)} (${rows.length})`, heading: HeadingLevel.HEADING_2 }))
    for (const f of rows) children.push(new Paragraph({ children: [new TextRun({ text: `${f.title} — ${f.status.replaceAll('_', ' ')}`, bold: true })] }), new Paragraph(f.description))
  }
  children.push(heading('Risks by impact'))
  for (const impact of ['high', 'medium', 'low']) {
    const rows = data.risks.filter(r => r.impact === impact)
    children.push(new Paragraph({ text: `${impact[0].toUpperCase() + impact.slice(1)} impact (${rows.length})`, heading: HeadingLevel.HEADING_2 }))
    if (rows.length) children.push(table(['Risk', 'Likelihood', 'Status', 'Mitigation'], rows.map(r => [r.title, r.likelihood, r.status, r.mitigation_plan || 'Not recorded'])))
  }
  children.push(heading('Open and overdue actions'), table(['Action', 'Status', 'Due date', 'Overdue at period end'], data.tasks.map(t => [t.title, t.status.replaceAll('_', ' '), t.due_date || 'Not set', isOverdue(t, scope.end) ? 'Yes' : 'No'])))
  if (!data.tasks.length) children.push(new Paragraph('No open actions in scope.'))
  return new Document({ creator: 'NK Udada Foundation', title: scope.title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 160 } } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  })
}
