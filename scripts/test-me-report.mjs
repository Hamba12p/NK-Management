// Uses the installed TypeScript compiler; no test dependency or app changes.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { Packer } = require('docx')
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  mod.filename = file
  mod.paths = require.resolve.paths('docx')
  cache.set(file, mod)
  const original = mod.require.bind(mod)
  mod.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : original(name)
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
  return mod.exports
}
async function main() {
  const { reportSnapshot, buildBoardBrief, validateScope, loadReport } = load('src/lib/me/report.ts')
  const { latestMeasurements, isOverdue } = load('src/lib/me/types.ts')
  const scope = { title: 'Board advisory brief', programId: 'p1', start: '2026-09-01', end: '2026-09-30' }
  const data = {
    programs: [{ id: 'p1', name: 'Community learning', status: 'active' }],
    kpis: [{ id: 'k1', program_id: 'p1', name: 'Learners attending', unit: 'count', baseline_value: 0, target_value: 30 }],
    measurements: [{ id: 'm1', kpi_id: 'k1', value: 10, period_end: '2026-09-01', created_at: '2026-09-30' }, { id: 'm2', kpi_id: 'k1', value: 24, period_end: '2026-09-20', created_at: '2026-09-21' }],
    findings: [{ id: 'f1', title: 'Attendance improved', description: 'Attendance increased compared with the baseline.', severity: 'high', status: 'open' }],
    risks: [{ id: 'r1', title: 'Equipment availability', likelihood: 'medium', impact: 'high', status: 'mitigating', mitigation_plan: 'Schedule shared equipment before each class.' }],
    tasks: [{ id: 't1', title: 'Review equipment schedule', due_date: '2026-09-29', status: 'todo' }, { id: 't2', title: 'Confirm next session', due_date: '2026-09-30', status: 'in_progress' }],
  }
  assert.throws(() => validateScope({ ...scope, end: '2026-08-01' }))
  assert.throws(() => validateScope({ ...scope, start: '2026-02-30' }))
  assert.throws(() => validateScope({ ...scope, title: ' ' }))
  assert.equal(latestMeasurements(data.measurements, 'k1')[0].value, 24)
  assert.equal(isOverdue({ status: 'done', due_date: '2026-09-01' }, scope.end), false)
  assert.equal(isOverdue({ status: 'todo', due_date: scope.end }, scope.end), false)
  const snapshot = reportSnapshot(data, scope)
  assert.equal(snapshot.kpi_summary[0].baseline_value, 0)
  assert.equal(snapshot.kpi_summary[0].latest.value, 24)
  assert.equal(snapshot.totals.overdue_actions, 1)
  assert.equal(reportSnapshot({ ...data, kpis: [], measurements: [], findings: [], risks: [], tasks: [] }, scope).totals.overdue_actions, 0)
  // Verify period/scope query predicates and pagination using a query recorder.
  const calls = []
  const fake = { from(table) {
    const operations = []
    let range = [0, 499]
    const builder = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve) => {
        calls.push({ table, operations, range })
        const rows = table === 'programs' ? data.programs : table === 'program_kpis' ? data.kpis : table === 'findings' && range[0] === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: i })) : []
        return Promise.resolve({ data: rows, error: null }).then(resolve)
      }
      return (...args) => { if (key === 'range') range = args; else operations.push([key, ...args]); return builder }
    } })
    return builder
  } }
  const loaded = await loadReport(fake, scope)
  assert.equal(loaded.findings.length, 500)
  assert(calls.some(c => c.table === 'findings' && c.range[0] === 500))
  assert(calls.some(c => c.table === 'tasks' && c.operations.some(op => op[0] === 'eq' && op[1] === 'source_program_id' && op[2] === 'p1')))
  assert(calls.some(c => c.table === 'findings' && c.operations.some(op => op[0] === 'lt' && op[2] === '2026-10-01T00:00:00.000Z')))
  assert(calls.some(c => c.table === 'kpi_measurements' && c.operations.some(op => op[0] === 'lte' && op[1] === 'period_end' && op[2] === scope.end)))
  const bytes = await Packer.toBuffer(buildBoardBrief(data, scope, snapshot))
  assert.equal(bytes.subarray(0, 2).toString(), 'PK')
  const output = process.env.ME_TEST_DOCX || path.join(require('node:os').tmpdir(), 'nk-me-board-brief-test.docx')
  fs.writeFileSync(output, bytes)
  console.log('PASS: report validation, date boundaries, latest readings, zero baseline, overdue semantics, scope filters, pagination, DOCX generation')
  console.log('DOCX sample:', output)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
