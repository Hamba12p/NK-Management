// Loopback-only UI fixture, NOT an authentication/RLS test or production service.
// Start the app separately with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55440
// and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture. Visit /fixture/login here.
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const actor = '10000000-0000-0000-0000-000000000001'
const program = '20000000-0000-0000-0000-000000000001'
const kpi = '30000000-0000-0000-0000-000000000001'
const now = new Date().toISOString()
const day = now.slice(0, 10)
const tables = {
  profiles: [{ id: actor, full_name: 'Fixture Board Advisor', role: 'board_advisor', display_tag: 'BA', display_color: 'burgundy' }],
  programs: [{ id: program, name: 'Community learning', description: 'Track learning outcomes and programme evidence.', status: 'active', start_date: day.slice(0, 8) + '01', end_date: null, owner_id: actor }],
  program_kpis: [{ id: kpi, program_id: program, name: 'Learner attendance', description: 'Learners attending the programme', unit: 'count', baseline_value: 0, target_value: 30, frequency: 'monthly' }],
  kpi_measurements: [{ id: randomUUID(), kpi_id: kpi, value: 12, period_start: day, period_end: day, notes: 'First reading' }],
  findings: [{ id: '40000000-0000-0000-0000-000000000001', program_id: program, title: 'Attendance follow-up', description: 'Review attendance barriers with the programme team.', category: 'monitoring', severity: 'high', status: 'open', source_meeting_id: null }],
  risks: [{ id: '50000000-0000-0000-0000-000000000001', program_id: program, finding_id: null, title: 'Equipment availability', description: 'Shared equipment may limit session capacity.', likelihood: 'medium', impact: 'high', status: 'mitigating', mitigation_plan: 'Confirm equipment schedules in advance.', owner_id: actor }],
  tasks: [], documents: [], evidence_links: [], board_reports: [], meetings: [], activity_log: [], admin_notifications: [], workspace_docs: [], workspace_comments: [], announcements: [], events: [], hub_classes: [], volunteer_profiles: [], user_preferences: [],
}
for (const rows of Object.values(tables)) for (const row of rows) Object.assign(row, { created_at: now, deleted_at: null, deleted_by: null })
const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: now }
const jwt = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })).toString('base64url') + '.fixture'
const session = { access_token: jwt, refresh_token: 'fixture', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user }
const objects = new Map()
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3123')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const url = new URL(req.url, 'http://127.0.0.1:55440')
  const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
  try {
    if (url.pathname === '/fixture/login') {
      tables.profiles[0].role = url.searchParams.get('role') || 'board_advisor'
      res.setHeader('Set-Cookie', `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}; Path=/; SameSite=Lax`)
      res.writeHead(302, { Location: 'http://127.0.0.1:3123/dashboard/me' }); res.end(); return
    }
    if (url.pathname === '/fixture/state') return json(tables)
    if (url.pathname === '/auth/v1/user') return json(user)
    if (url.pathname === '/auth/v1/token') return json(session)
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      const filePath = url.pathname.slice('/storage/v1/object/sign/'.length)
      return json({ signedURL: `/object/${filePath}` })
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const filePath = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length))
      if (req.method === 'POST') { objects.set(filePath, buffer); return json({ Key: filePath }) }
      res.writeHead(objects.has(filePath) ? 200 : 404); res.end(objects.get(filePath)); return
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const name = url.pathname.slice('/rest/v1/'.length)
      const rows = tables[name] ||= []
      const matches = row => [...url.searchParams].every(([key, value]) => {
        if (['select', 'order', 'limit', 'offset', 'or', 'on_conflict'].includes(key)) return true
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
        if (value === 'is.null') return row[key] == null
        if (value === 'not.is.null') return row[key] != null
        if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4)
        if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]))
        if (value.startsWith('gte.')) return String(row[key]) >= value.slice(4)
        if (value.startsWith('lte.')) return String(row[key]) <= value.slice(4)
        if (value.startsWith('lt.')) return String(row[key]) < value.slice(3)
        return true
      })
      let selected
      if (req.method === 'POST') {
        const payload = JSON.parse(buffer.toString())
        const items = Array.isArray(payload) ? payload : [payload]
        selected = items.map(item => {
          const existing = rows.find(r => item.id && r.id === item.id)
          if (existing) { Object.assign(existing, item); return existing }
          const row = { id: randomUUID(), created_at: now, deleted_at: null, deleted_by: null, status: name === 'tasks' ? 'todo' : undefined, ...item }
          rows.push(row); return row
        })
      } else {
        selected = rows.filter(matches)
        if (req.method === 'PATCH') { const payload = JSON.parse(buffer.toString()); selected.forEach(row => Object.assign(row, payload)) }
      }
      if (url.searchParams.has('order')) {
        const [key, direction] = url.searchParams.get('order').split('.')
        selected = [...selected].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === 'desc' ? -1 : 1))
      }
      const offset = Number(url.searchParams.get('offset') || 0)
      selected = selected.slice(offset, offset + Number(url.searchParams.get('limit') || 1000)).map(row => ({ ...row }))
      if (name === 'evidence_links') selected.forEach(row => { row.documents = tables.documents.find(d => d.id === row.document_id) || null })
      if (name === 'documents') selected.forEach(row => { row.profiles = tables.profiles[0] })
      if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) return selected.length ? json(selected[0]) : json({ message: 'No rows' }, 406)
      return json(selected, req.method === 'POST' ? 201 : 200)
    }
    json({ message: 'Fixture endpoint not implemented' }, 404)
  } catch (error) { json({ message: error.message }, 500) }
})
server.listen(55440, '127.0.0.1', () => console.log('UI fixture listening on loopback 55440; no production data or credentials used.'))
