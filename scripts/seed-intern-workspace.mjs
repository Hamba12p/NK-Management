import { adminClient, deterministicUuid, normaliseEmail, parseArgs, requireIntern } from './lib/intern-admin.mjs'

const args = parseArgs(['email', 'start'])
const email = normaliseEmail(args.email)
const start = String(args.start || '')
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`))) throw new Error('--start must use YYYY-MM-DD.')
const supabase = adminClient()
const { profile: intern } = await requireIntern(supabase, email)

async function findStaff(name, role) {
  const { data, error } = await supabase.from('profiles').select('id,full_name,role').ilike('full_name', `%${name}%`).eq('role', role).limit(2)
  if (error) throw new Error(`Could not find ${name}: ${error.message}`)
  if (!data?.length) throw new Error(`No ${role} profile matched ${name}.`)
  if (data.length > 1) throw new Error(`More than one ${role} profile matched ${name}; resolve the roster before seeding.`)
  return data[0]
}

const [amina, hamba, balqees] = await Promise.all([
  findStaff('Amina', 'dpo'), findStaff('Hamba', 'manager'), findStaff('Balqees', 'manager'),
])

function workingDate(offset) {
  const date = new Date(`${start}T00:00:00.000Z`)
  let remaining = Math.max(0, offset)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1)
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining -= 1
  }
  return date.toISOString().slice(0, 10)
}

const weeks = [
  ['Sign the organisation MOU and code of conduct', 'Attend the data handling orientation with Amina', 'Build the document inventory', 'Compile the gap register'],
  ['Draft the outreach report template', 'Draft the attendance register template', 'Draft the learner feedback form template', 'Write the folder structure and naming convention', 'Reconcile and write the Covenant Junior School fact sheet', 'Reconcile and write the Kyaggwe Road Primary fact sheet', 'Reconcile and write the Nakifuma Modern Secondary fact sheet', 'Keep the query log up to date'],
  ['Log notes from two or three volunteer debrief calls', 'Draft the school outreach SOP', 'Draft the volunteer onboarding checklist', 'Build the outreach tracker', 'Prepare for the mid-point review', 'Submit any extension request by the end of week 3'],
  ['Revise all drafts after feedback', 'Write the handover note', 'Give the 30-minute walkthrough', 'Complete the exit review'],
]
const tasks = []
for (let week = 0; week < weeks.length; week += 1) {
  weeks[week].forEach((title, index) => tasks.push({
    id: deterministicUuid(`intern:${intern.id}:task:${week + 1}:${title}`),
    title, description: `Intern work plan, week ${week + 1}.`,
    assignee_id: intern.id, assignee_label: intern.full_name, created_by: amina.id,
    due_date: workingDate(week * 5 + Math.min(4, Math.floor(index * 5 / weeks[week].length))),
    status: 'todo',
  }))
}
for (let week = 0; week < 4; week += 1) tasks.push({
  id: deterministicUuid(`intern:${intern.id}:weekly-update:${week + 1}`),
  title: `Submit weekly update, week ${week + 1}`, description: 'Share work completed, next steps and any blockers.',
  assignee_id: intern.id, assignee_label: intern.full_name, created_by: amina.id,
  due_date: workingDate(week * 5 + 4), status: 'todo',
})

const meetingPlan = []
for (let week = 0; week < 4; week += 1) meetingPlan.push({
  key: `weekly-check-in-${week + 1}`, title: `Intern weekly check-in, week ${week + 1}`,
  date: workingDate(week * 5 + 4), description: `Weekly check-in with Amina. Intern-visible supervision meeting for ${intern.full_name}.`,
  agenda: ['Weekly update: done, next and blocked', 'Questions and support needed'],
})
meetingPlan.push(
  { key: 'week-2-review', title: 'Intern week 2 review', date: workingDate(9), description: `Review point with Hamba and ${intern.full_name}.`, agenda: ['Review the document inventory and gap register', 'Agree priorities for weeks 3 and 4'] },
  { key: 'week-3-midpoint', title: 'Intern mid-point review', date: workingDate(14), description: `Mid-point review with Amina, Hamba and ${intern.full_name}.`, agenda: ['Review progress and support needs', 'Discuss any extension request'] },
  { key: 'week-4-final', title: 'Intern final review', date: workingDate(19), description: `Final review with Hamba and Balqees, adviser.`, agenda: ['Review handover and walkthrough', 'Record final actions and feedback'] },
)
const meetings = meetingPlan.map(item => ({
  id: deterministicUuid(`intern:${intern.id}:meeting:${item.key}`),
  title: item.title,
  description: item.description,
  scheduled_at: `${item.date}T10:00:00+03:00`, duration_min: 60,
  location: 'Online', status: 'upcoming', created_by: amina.id,
  intern_visible: true, intern_check_in: true,
  contributor_name: amina.full_name, contributor_tag: 'AY',
}))

const body = [
  'Before beginning work, sign the organisation MOU and code of conduct.',
  'Use anonymised or aggregate data only. Do not copy identifiable learner information into drafts.',
  'Do not take or upload photographs of children.',
  'Keep Foundation material in the staff hub. Do not send it to personal email or messaging apps.',
  'Mark every draft DRAFT until it has been reviewed and formally adopted.',
].join('\n\n')
const announcement = {
  id: deterministicUuid(`intern:${intern.id}:announcement:onboarding-data-handling`),
  title: 'Intern onboarding and data handling rules', body,
  pinned: false, author_id: amina.id, intern_visible: true,
  acknowledgement_required: true,
  contributor_name: amina.full_name, contributor_tag: 'AY',
}

const areaRows = [
  ['Audit', 'audit', false], ['Template', 'template', false], ['Fact sheet', 'fact-sheet', false],
  ['SOP', 'sop', false], ['Handover', 'handover', false], ['Intern shared reading', 'intern-shared-reading', true],
].map(([name, slug, intern_visible]) => ({
  id: deterministicUuid(`intern:${intern.id}:area:${slug}`), name, slug, intern_visible, created_by: amina.id,
}))
const templateAreaId = areaRows.find(area => area.slug === 'template').id
const weeklyTemplate = {
  type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Done' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Work completed this week.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Next' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Planned work for next week.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Blocked' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Questions, dependencies or support needed.' }] },
  ],
}
const queryTemplate = {
  type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Question | Source document | Who can answer | Status | Answer' }] },
  ],
}
const workspaceDocs = [
  { key: 'weekly-update', title: 'Weekly update', content: weeklyTemplate },
  { key: 'query-log', title: 'Query log', content: queryTemplate },
].map(item => ({
  id: deterministicUuid(`intern:${intern.id}:workspace-template:${item.key}`),
  title: item.title, content: item.content, author_id: intern.id, status: 'draft', intern_area_id: templateAreaId,
  contributor_name: intern.full_name, contributor_tag: intern.display_tag,
}))

const agendaItems = meetingPlan.flatMap(item => item.agenda.map((content, index) => ({
  id: deterministicUuid(`intern:${intern.id}:agenda:${item.key}:${index}`),
  meeting_id: deterministicUuid(`intern:${intern.id}:meeting:${item.key}`),
  content, order_index: index + 1, created_by: intern.id,
})))

console.log(`Dry run: seed ${tasks.length} tasks, ${meetings.length} intern-visible meetings, ${agendaItems.length} agenda items, one required-acknowledgement announcement, ${areaRows.length} areas and ${workspaceDocs.length} workspace templates for ${intern.full_name}.`)
console.log('Amina:', amina.full_name, '| Hamba:', hamba.full_name, '| Balqees:', balqees.full_name)
console.log('No reports or real learner/volunteer records will be uploaded.')
if (!args.apply) {
  console.log('No changes made. Add --apply to seed this workspace.')
  process.exit(0)
}

async function upsert(table, rows) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`${table} seed failed: ${error.message}`)
}
await upsert('intern_workspace_areas', areaRows)
await upsert('tasks', tasks)
await upsert('meetings', meetings)
await upsert('agenda_items', agendaItems)
await upsert('announcements', [announcement])
await upsert('workspace_docs', workspaceDocs)
console.log('Intern workspace content seeded. Re-running this command updates the same deterministic rows.')
