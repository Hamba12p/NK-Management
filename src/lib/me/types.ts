export type Profile = { id: string; full_name: string; role: string }
export type Program = { id: string; name: string; description: string | null; status: string; start_date: string | null; end_date: string | null; owner_id: string | null; created_at: string }
export type Kpi = { id: string; program_id: string; name: string; description: string | null; unit: string; baseline_value: number | null; target_value: number | null; frequency: string }
export type Measurement = { id: string; kpi_id: string; value: number; period_start: string; period_end: string; notes: string | null; created_at: string }
export type Finding = { id: string; program_id: string | null; title: string; description: string; category: string; severity: string; status: string; source_meeting_id: string | null; created_at: string }
export type Risk = { id: string; program_id: string | null; finding_id: string | null; title: string; description: string; likelihood: string; impact: string; status: string; mitigation_plan: string | null; owner_id: string | null; created_at: string }
export type Action = { id: string; title: string; status: string; due_date: string | null; assignee_label: string | null; assignee_id: string | null; source_program_id: string | null; source_finding_id: string | null; source_risk_id: string | null; created_at: string }
export type Evidence = { id: string; document_id: string; program_id: string | null; finding_id: string | null; risk_id: string | null; documents: { id: string; name: string } | null }
export type BoardReport = { id: string; title: string; period_start: string; period_end: string; document_id: string | null; created_at: string }
export const canUseME = (role: string) => role === 'admin' || role === 'board_advisor'
export const today = () => new Date().toLocaleDateString('en-CA')
export const isOverdue = (task: Pick<Action, 'status' | 'due_date'>, day = today()) => task.status !== 'done' && !!task.due_date && task.due_date < day
export function latestMeasurements(rows: Measurement[], kpiId: string) {
  return rows.filter(row => row.kpi_id === kpiId).sort((a, b) => b.period_end.localeCompare(a.period_end) || b.created_at.localeCompare(a.created_at))
}
