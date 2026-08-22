'use client'

import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { Document as WordDocument, Packer, Paragraph, TextRun } from 'docx'
import { Link2, List, Plus, Table2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import CreatorTag from '@/components/CreatorTag'
import { EmptyLedger } from '@/components/BrandIllustrations'
import { logActivity } from '@/lib/activity'
import { archiveAndDeleteContent } from '@/lib/content-deletion'
import { type CreatorProfile, volunteerContributor } from '@/lib/creator'

type WorkspaceDoc = { id: string; title: string; content: Record<string, unknown>; author_id: string; status: 'draft' | 'final'; updated_at: string; contributor_name: string | null; contributor_tag: string | null; profiles: CreatorProfile }
type Comment = { id: string; document_id: string; body: string; author_id: string; created_at: string; profiles?: CreatorProfile }
type Task = { id: string; title: string; assignee_label: string | null; due_date: string | null; status: string; linked_doc_id: string | null; created_by: string; contributor_name: string | null; contributor_tag: string | null; profiles: CreatorProfile }

function Tool({ active = false, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded border px-2.5 py-1.5 text-xs font-semibold ${active ? 'border-purple bg-warm text-purple' : 'border-transparent text-muted hover:border-border hover:bg-warm/45 hover:text-ink'}`} aria-label={label} title={label}>{children}</button>
}

function RichEditor({ documentId, value, onChange }: { documentId: string; value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), TableKit.configure({ table: { resizable: false } })],
    content: value,
    editorProps: { attributes: { class: 'min-h-72 px-5 py-4 outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  })
  // The editor owns its transient state; document changes replace it deliberately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (editor) editor.commands.setContent(value, { emitUpdate: false }) }, [editor, documentId])
  if (!editor) return <div className="min-h-72 p-5 text-sm text-muted">Loading editor…</div>
  const setLink = () => {
    const href = window.prompt('Link address', editor.getAttributes('link').href || 'https://')
    if (href === null) return
    if (!href.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }
  return <div className="workspace-editor"><div className="flex flex-wrap items-center gap-1 border-b border-border bg-cream px-3 py-2">
    <Tool label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</Tool>
    {([1, 2, 3] as const).map(level => <Tool key={level} label={`Heading ${level}`} active={editor.isActive('heading', { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>H{level}</Tool>)}
    <Tool label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></Tool>
    <Tool label="Add or edit link" active={editor.isActive('link')} onClick={setLink}><Link2 size={14} /></Tool>
    <span className="mx-1 h-5 w-px bg-border" />
    <Tool label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={14} /> Table</Tool>
    {editor.isActive('table') && <><Tool label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</Tool><Tool label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</Tool><Tool label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={14} /></Tool></>}
  </div><EditorContent editor={editor} /></div>
}

function textFromContent(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  return (node.content || []).map(textFromContent).join(['paragraph', 'heading', 'tableRow'].includes(node.type) ? '\n' : ['tableCell', 'tableHeader'].includes(node.type) ? '\t' : '')
}

export default function WorkspacePage() {
  const supabase = useMemo(() => createClient(), [])
  const [docs, setDocs] = useState<WorkspaceDoc[]>([])
  const [selected, setSelected] = useState<WorkspaceDoc | null>(null)
  const [content, setContent] = useState<Record<string, unknown>>({ type: 'doc', content: [] })
  const [comments, setComments] = useState<Comment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [comment, setComment] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('Volunteers')
  const [taskDue, setTaskDue] = useState('')
  const [newDocTitle, setNewDocTitle] = useState('')
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [myDocsOnly, setMyDocsOnly] = useState(false)
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const canManageTasks = ['admin', 'manager'].includes(role)

  const loadComments = async (documentId: string) => {
    const { data, error: queryError } = await supabase.from('workspace_comments').select('*, profiles!workspace_comments_author_id_fkey(*)').eq('document_id', documentId).order('created_at')
    if (queryError) setError(queryError.message); else setComments(data || [])
  }
  const openDoc = (doc: WorkspaceDoc) => { setSelected(doc); setContent(doc.content || { type: 'doc', content: [] }); void loadComments(doc.id) }
  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    setUserId(user.id)
    const [docResult, taskResult, profileResult] = await Promise.all([
      supabase.from('workspace_docs').select('*, profiles!workspace_docs_author_id_fkey(*)').order('updated_at', { ascending: false }),
      supabase.from('tasks').select('*, profiles!tasks_created_by_fkey(*)').order('due_date', { ascending: true }),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ])
    if (docResult.error) setError(docResult.error.message); else { setDocs(docResult.data || []); if (!selected && docResult.data?.[0]) openDoc(docResult.data[0]) }
    if (taskResult.error) setError(taskResult.error.message); else setTasks(taskResult.data || [])
    setRole(profileResult.data?.role || '')
  }
  useEffect(() => {
    // Initial remote hydration intentionally updates the client workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])
  useEffect(() => { if (!selected) return; const channel = supabase.channel(`workspace-comments-${selected.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_comments', filter: `document_id=eq.${selected.id}` }, () => void loadComments(selected.id)).subscribe(); return () => { void supabase.removeChannel(channel) } }, [selected?.id, supabase])

  const createDoc = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser(); if (!user || !newDocTitle.trim()) return
    const { data, error: insertError } = await supabase.from('workspace_docs').insert({ title: newDocTitle.trim(), content: { type: 'doc', content: [] }, author_id: user.id, ...volunteerContributor() }).select('*, profiles!workspace_docs_author_id_fkey(*)').single()
    if (insertError || !data) { setError(insertError?.message || 'Unable to create document'); return }
    setNewDocTitle(''); setShowNewDoc(false); setMessage('Document created. Start writing, then choose Save.'); await logActivity('workspace.document.create', 'workspace_doc', data.id, { title: data.title }); await load(); openDoc(data)
  }
  const saveDoc = async () => { if (!selected) return; const { error: saveError } = await supabase.rpc('save_workspace_document', { p_document_id: selected.id, p_content: content, p_status: selected.status }); if (saveError) setError(saveError.message); else { setError(''); setMessage('Saved. A recoverable version was recorded.'); await logActivity('workspace.document.update', 'workspace_doc', selected.id, { title: selected.title }); await load() } }
  const exportDoc = async () => { if (!selected) return; const word = new WordDocument({ sections: [{ children: [new Paragraph({ children: [new TextRun({ text: selected.title, bold: true, size: 32 })] }), ...textFromContent(content).split('\n').filter(Boolean).map(text => new Paragraph(text))] }] }); const blob = await Packer.toBlob(word); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${selected.title.replace(/[^a-z0-9]+/gi, '-') || 'workspace-document'}.docx`; link.click(); URL.revokeObjectURL(link.href) }
  const deleteDoc = async () => { if (!selected || !confirm('Delete this document? An administrator-retained copy will be kept.')) return; try { await archiveAndDeleteContent(supabase, 'workspace_document', selected.id); setSelected(null); setComments([]); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete document') } }
  const addComment = async (event: React.FormEvent) => { event.preventDefault(); const { data: { user } } = await supabase.auth.getUser(); if (!user || !selected || !comment.trim()) return; const { error: insertError } = await supabase.from('workspace_comments').insert({ document_id: selected.id, body: comment.trim(), author_id: user.id }); if (insertError) setError(insertError.message); else { setComment(''); setMessage('Comment posted.'); await logActivity('workspace.comment.create', 'workspace_doc', selected.id) } }
  const deleteComment = async (id: string) => { if (!confirm('Delete this comment? An archived copy will be kept.')) return; await archiveAndDeleteContent(supabase, 'workspace_comment', id); if (selected) await loadComments(selected.id) }
  const addTask = async (event: React.FormEvent) => { event.preventDefault(); const { data: { user } } = await supabase.auth.getUser(); if (!user || !taskTitle.trim()) return; const { data, error: insertError } = await supabase.from('tasks').insert({ title: taskTitle.trim(), assignee_label: taskAssignee.trim() || 'Volunteers', due_date: taskDue || null, linked_doc_id: selected?.id || null, created_by: user.id, ...volunteerContributor() }).select('id').single(); if (insertError) setError(insertError.message); else { setTaskTitle(''); setTaskDue(''); setMessage('Task added. Use its status menu to move the work forward.'); await load(); await logActivity('task.create', 'task', data?.id, { title: taskTitle }) } }
  const setTaskStatus = async (task: Task, status: string) => { const { error: updateError } = await supabase.from('tasks').update({ status }).eq('id', task.id); if (updateError) setError(updateError.message); else { setMessage(`Task moved to ${status.replace('_', ' ')}.`); await load() } }
  const deleteTask = async (id: string) => { if (!confirm('Delete this task? An archived copy will be kept.')) return; await archiveAndDeleteContent(supabase, 'task', id); await load() }
  const visibleDocs = myDocsOnly ? docs.filter(doc => doc.author_id === userId) : docs
  const visibleTasks = myTasksOnly ? tasks.filter(task => task.created_by === userId) : tasks

  return <div><PageHeader title="Workspace" description="Draft reports, keep discussion beside the work, and turn decisions into tasks." action={<button onClick={() => setShowNewDoc(value => !value)} className="btn-primary !px-4 !py-2"><Plus size={16} />New document</button>} />
    {error && <p className="mb-4 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    {message && <p className="mb-4 rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p>}
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="record-surface self-start p-3"><div className="flex items-center justify-between gap-2 px-2 pb-3"><h2 className="text-sm font-semibold text-ink">Documents</h2><label className="flex items-center gap-1.5 text-xs font-semibold text-muted"><input type="checkbox" checked={myDocsOnly} onChange={event => setMyDocsOnly(event.target.checked)} /> Mine</label></div>
        {showNewDoc && <form onSubmit={createDoc} className="mb-3 rounded border border-border bg-warm/45 p-2"><label className="text-xs font-semibold text-muted">Document title<input autoFocus value={newDocTitle} onChange={event => setNewDocTitle(event.target.value)} required maxLength={200} placeholder="e.g. Partnership concept note" className="mt-1 w-full px-2 py-2 text-sm" /></label><div className="mt-2 flex gap-2"><button className="btn-primary !min-h-0 !px-3 !py-1.5 text-xs">Create</button><button type="button" onClick={() => setShowNewDoc(false)} className="text-xs font-semibold text-muted">Cancel</button></div></form>}
        {visibleDocs.length ? visibleDocs.map(doc => <button key={doc.id} onClick={() => openDoc(doc)} className={`mb-1 w-full rounded px-3 py-2 text-left text-sm ${selected?.id === doc.id ? 'bg-warm text-purple' : 'hover:bg-warm/45'}`}><span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span><CreatorTag profile={doc.profiles} contributorName={doc.contributor_name} contributorTag={doc.contributor_tag} /></span><span className="mt-1 block text-xs text-muted">{doc.status} · {new Date(doc.updated_at).toLocaleDateString()}</span></button>) : <div className="px-2 py-5 text-center"><EmptyLedger className="mx-auto w-32" /><p className="mt-2 text-sm font-semibold text-ink">{myDocsOnly ? 'No documents created by you.' : 'Nothing recorded yet.'}</p><p className="mt-1 text-xs text-muted">Choose New document to begin.</p></div>}
      </aside>
      <section className="space-y-6">
        {selected ? <><div className="record-surface overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-cream px-4 py-3"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-ink">{selected.title}</h2><CreatorTag profile={selected.profiles} contributorName={selected.contributor_name} contributorTag={selected.contributor_tag} /></div><p className="mt-1 text-xs text-muted">{selected.status} · created by {selected.contributor_name || selected.profiles?.full_name || 'Team member'}</p></div><div className="flex flex-wrap gap-2"><button onClick={saveDoc} className="btn-primary !min-h-0 !px-3 !py-2">Save</button><button onClick={exportDoc} className="btn-secondary !min-h-0 !px-3 !py-2">Download Word</button>{selected.author_id === userId && <button onClick={deleteDoc} className="rounded border border-rust/40 px-3 py-2 text-sm font-semibold text-rust">Delete</button>}</div></div><RichEditor documentId={selected.id} value={content} onChange={setContent} /></div>
          <div className="card"><h2 className="font-semibold text-ink">Comments</h2><div className="mt-3 space-y-3">{comments.length ? comments.map(item => <div key={item.id} className="rounded border border-border bg-cream p-3 text-sm"><div className="flex items-start justify-between gap-3"><p>{item.body}</p>{item.author_id === userId && <button onClick={() => deleteComment(item.id)} className="shrink-0 text-xs font-semibold text-rust">Delete</button>}</div><div className="mt-2"><CreatorTag profile={item.profiles} showName /> <span className="text-xs text-muted">· {new Date(item.created_at).toLocaleString()}</span></div></div>) : <p className="text-sm text-muted">No comments yet. Add context or a decision below.</p>}</div><form onSubmit={addComment} className="mt-4 flex gap-2"><input value={comment} onChange={event => setComment(event.target.value)} required maxLength={4000} placeholder="Add context or record a decision" className="min-w-0 flex-1 px-3 py-2 text-sm" /><button className="btn-secondary !min-h-0 !px-3 !py-2">Post comment</button></form></div></>
          : <div className="card py-10 text-center"><EmptyLedger className="empty-illustration mx-auto" /><p className="mt-3 font-semibold text-ink">Open a document to start writing.</p><p className="mt-1 text-sm text-muted">Or choose New document to create the first record.</p></div>}
        <div className="card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">Tasks</h2><p className="mt-1 text-xs text-muted">Turn a decision into an owned next step.</p></div><label className="flex items-center gap-2 text-xs font-semibold text-muted"><input type="checkbox" checked={myTasksOnly} onChange={event => setMyTasksOnly(event.target.checked)} /> Created by me</label></div>
          {canManageTasks && <form onSubmit={addTask} className="mt-4 grid gap-2 md:grid-cols-4"><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} required placeholder="Task title" className="px-3 py-2 text-sm" /><input value={taskAssignee} onChange={event => setTaskAssignee(event.target.value)} placeholder="Assignee or Volunteers" className="px-3 py-2 text-sm" /><input type="date" value={taskDue} onChange={event => setTaskDue(event.target.value)} className="px-3 py-2 text-sm" /><button className="btn-primary !min-h-0 !px-3 !py-2">Add task</button></form>}
          <div className="mt-4 space-y-2">{visibleTasks.length ? visibleTasks.map(task => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-cream p-3 text-sm"><div><div className="flex items-center gap-2"><p className="font-medium text-ink">{task.title}</p><CreatorTag profile={task.profiles} contributorName={task.contributor_name} contributorTag={task.contributor_tag} /></div><p className="mt-1 text-xs text-muted">{task.assignee_label || 'Unassigned'}{task.due_date ? ` · due ${task.due_date}` : ''}</p></div><div className="flex items-center gap-3">{canManageTasks ? <select value={task.status} onChange={event => setTaskStatus(task, event.target.value)} className="border border-border bg-cream px-2 py-1 text-xs"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select> : <span className="text-xs capitalize text-muted">{task.status.replace('_', ' ')}</span>}{task.created_by === userId && <button onClick={() => deleteTask(task.id)} className="text-xs font-semibold text-rust">Delete</button>}</div></div>) : <div className="py-6 text-center"><EmptyLedger variant="tasks" className="mx-auto w-36" /><p className="mt-2 text-sm font-semibold text-ink">{myTasksOnly ? 'You have not created a task.' : 'No open task records yet.'}</p><p className="mt-1 text-xs text-muted">{canManageTasks ? 'Use the form above to assign the first next step.' : 'A manager will add tasks here when work is assigned.'}</p></div>}</div>
        </div>
      </section>
    </div>
  </div>
}
