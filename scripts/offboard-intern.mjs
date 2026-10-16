import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { adminClient, normaliseEmail, parseArgs, requireIntern } from './lib/intern-admin.mjs'

const args = parseArgs(['email'])
const email = normaliseEmail(args.email)
const supabase = adminClient()
const { profile, user } = await requireIntern(supabase, email)
const { data: dpoRows, error: dpoError } = await supabase.from('profiles').select('id,full_name,role').eq('role', 'dpo').ilike('full_name', '%Amina%').limit(2)
if (dpoError) throw new Error(`Amina lookup failed: ${dpoError.message}`)
if (!dpoRows?.length) throw new Error('No DPO profile matched Amina.')
if (dpoRows.length > 1) throw new Error('More than one DPO profile matched Amina; resolve the roster before offboarding.')
const amina = dpoRows[0]

const [documentsResult, draftsResult, tasksResult] = await Promise.all([
  supabase.from('documents').select('id,name,file_path,uploaded_by,contributor_name,contributor_tag').eq('uploaded_by', profile.id),
  supabase.from('workspace_docs').select('id,title,content,author_id,contributor_name,contributor_tag').eq('author_id', profile.id),
  supabase.from('tasks').select('id,title,status,due_date,assignee_id,created_by,contributor_name,contributor_tag')
    .or(`assignee_id.eq.${profile.id},created_by.eq.${profile.id}`),
])
for (const result of [documentsResult, draftsResult, tasksResult]) if (result.error) throw new Error(`Offboarding inventory failed: ${result.error.message}`)
const documents = documentsResult.data || []
const drafts = draftsResult.data || []
const tasks = tasksResult.data || []

function flatten(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  const children = (node.content || []).map(flatten).filter(Boolean)
  return children.join(['paragraph', 'heading', 'listItem', 'tableRow'].includes(node.type) ? '\n' : ['tableCell', 'tableHeader'].includes(node.type) ? '\t' : '')
}

const paragraphs = [
  new Paragraph({ text: `${profile.full_name} draft handover`, heading: HeadingLevel.TITLE }),
  new Paragraph({ text: `Prepared ${new Date().toLocaleDateString('en-GB')}. This export preserves the original author in each section.` }),
]
for (const draft of drafts) {
  paragraphs.push(new Paragraph({ text: draft.title, heading: HeadingLevel.HEADING_1 }))
  const plain = flatten(draft.content)
  for (const line of plain.split('\n').filter(Boolean)) paragraphs.push(new Paragraph({ children: [new TextRun(line)] }))
  paragraphs.push(new Paragraph(''))
}
if (!drafts.length) paragraphs.push(new Paragraph('No workspace drafts were found.'))
const word = new Document({ sections: [{ children: paragraphs }] })
const buffer = await Packer.toBuffer(word)
await mkdir('artifacts', { recursive: true })
const exportPath = join('artifacts', `intern-offboarding-${profile.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.docx`)
await writeFile(exportPath, buffer)

console.log(`Intern: ${profile.full_name} (${profile.id})`)
console.log(`Amina: ${amina.full_name}`)
console.log(`Documents: ${documents.length}`)
for (const item of documents) console.log(`  ${item.name} | ${item.file_path}`)
console.log(`Workspace drafts exported: ${drafts.length}`)
for (const item of drafts) console.log(`  ${item.title}`)
console.log(`Tasks: ${tasks.length}`)
for (const item of tasks) console.log(`  ${item.title} | ${item.status} | ${item.due_date || 'no due date'}`)
console.log(`Word export: ${exportPath}`)
console.log('Dry run: the Auth user, profile and content have not been changed.')

if (!args.apply) {
  console.log('No database changes made. Add --apply to expire, ban and reassign content.')
  process.exit(0)
}

const now = new Date().toISOString()
const { error: expireError } = await supabase.from('profiles').update({ access_expires_at: now, updated_at: now }).eq('id', profile.id)
if (expireError) throw new Error(`Could not expire access: ${expireError.message}`)
const { error: banError } = await supabase.auth.admin.updateUserById(user.id, { ban_duration: '876000h' })
if (banError) throw new Error(`Access is expired in the profile, but Auth ban failed: ${banError.message}`)

const tag = profile.display_tag || profile.full_name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase().slice(0, 4)
for (const doc of documents) {
  const { error } = await supabase.from('documents').update({ uploaded_by: amina.id, contributor_name: doc.contributor_name || profile.full_name, contributor_tag: doc.contributor_tag || tag }).eq('id', doc.id)
  if (error) throw new Error(`Could not transfer document ${doc.name}: ${error.message}`)
}
for (const draft of drafts) {
  const { error } = await supabase.from('workspace_docs').update({ author_id: amina.id, contributor_name: draft.contributor_name || profile.full_name, contributor_tag: draft.contributor_tag || tag }).eq('id', draft.id)
  if (error) throw new Error(`Could not transfer workspace draft ${draft.title}: ${error.message}`)
}
for (const task of tasks) {
  const { error } = await supabase.from('tasks').update({
    created_by: task.created_by === profile.id ? amina.id : task.created_by,
    assignee_id: task.assignee_id === profile.id ? amina.id : task.assignee_id,
    contributor_name: task.contributor_name || profile.full_name,
    contributor_tag: task.contributor_tag || tag,
  }).eq('id', task.id)
  if (error) throw new Error(`Could not transfer task ${task.title}: ${error.message}`)
}

console.log('Intern access expired and Auth account banned. Content owner and task assignment references were transferred to Amina; author names were retained in contributor fields.')
console.log('Human checklist: secure the Word export; review each open task; revoke shared links; collect Foundation files; confirm no personal copies remain; record exit review; decide whether to hide this account or show it as inactive on any team page.')
