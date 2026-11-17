'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Check, FileText, Paperclip, Search, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ChatResource, ChatResourceKind } from '@/lib/team-chat'

type ResourceChoice = ChatResource & { subtitle: string }

const resourceIcons: Record<ChatResourceKind, typeof FileText> = {
  document: FileText,
  workspace: BookOpen,
  task: Check,
  meeting: CalendarDays,
}

export default function MessageComposer({ onSend, sending, disabled }: {
  onSend: (body: string, attachments: ChatResource[]) => Promise<boolean>
  sending: boolean
  disabled?: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [body, setBody] = useState('')
  const [resources, setResources] = useState<ResourceChoice[]>([])
  const [attachments, setAttachments] = useState<ChatResource[]>([])
  const [resourceSearch, setResourceSearch] = useState('')
  const [showResources, setShowResources] = useState(false)
  const [resourceError, setResourceError] = useState('')

  const loadResources = useCallback(async () => {
    const [documents, workspace, tasks, meetings] = await Promise.all([
      supabase.from('documents').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }).limit(30),
      supabase.from('workspace_docs').select('id, title').is('deleted_at', null).order('updated_at', { ascending: false }).limit(30),
      supabase.from('tasks').select('id, title, status').is('deleted_at', null).neq('status', 'done').order('created_at', { ascending: false }).limit(30),
      supabase.from('meetings').select('id, title, scheduled_at').is('deleted_at', null).order('scheduled_at', { ascending: false }).limit(20),
    ])
    if ([documents.error, workspace.error, tasks.error, meetings.error].some(Boolean)) {
      setResourceError('Some workspace references could not be loaded.')
    }
    setResources([
      ...(documents.data || []).map(item => ({ id: item.id, kind: 'document' as const, title: item.name, subtitle: 'Shared file' })),
      ...(workspace.data || []).map(item => ({ id: item.id, kind: 'workspace' as const, title: item.title, subtitle: 'Workspace document' })),
      ...(tasks.data || []).map(item => ({ id: item.id, kind: 'task' as const, title: item.title, subtitle: `Task · ${item.status.replace('_', ' ')}` })),
      ...(meetings.data || []).map(item => ({ id: item.id, kind: 'meeting' as const, title: item.title, subtitle: `Meeting · ${new Date(item.scheduled_at).toLocaleDateString('en-UG')}` })),
    ])
  }, [supabase])

  useEffect(() => {
    // Load the authorized workspace references when the composer mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadResources()
  }, [loadResources])

  const visibleResources = resources.filter(resource =>
    `${resource.title} ${resource.subtitle}`.toLocaleLowerCase().includes(resourceSearch.trim().toLocaleLowerCase()),
  )

  const addResource = (resource: ChatResource) => {
    if (attachments.some(item => item.id === resource.id && item.kind === resource.kind)) return
    if (attachments.length >= 5) return
    setAttachments(current => [...current, resource])
    setShowResources(false)
    setResourceSearch('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!body.trim() || body.length > 2000 || sending || disabled) return
    if (await onSend(body.trim(), attachments)) {
      setBody('')
      setAttachments([])
    }
  }

  return <form onSubmit={submit} className="border-t border-border bg-surface-raised p-3 sm:p-4">
    {showResources && <section aria-label="Choose a workspace reference" className="mb-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-sm font-bold text-text">Bring work into the chat</h3><p className="mt-0.5 text-xs text-muted">Links keep their original workspace permissions.</p></div>
        <button type="button" onClick={() => setShowResources(false)} aria-label="Close references" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-muted"><X size={16} /></button>
      </div>
      <label className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-muted">
        <Search size={15} aria-hidden="true" /><span className="sr-only">Filter workspace items</span>
        <input autoFocus value={resourceSearch} onChange={event => setResourceSearch(event.target.value)} placeholder="Find a document, task, or meeting" className="global-search-input w-full text-sm" />
      </label>
      {resourceError && <p role="status" className="mt-2 text-xs text-warning">{resourceError}</p>}
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {visibleResources.map(resource => {
          const Icon = resourceIcons[resource.kind]
          const selected = attachments.some(item => item.id === resource.id && item.kind === resource.kind)
          return <li key={`${resource.kind}-${resource.id}`}>
            <button type="button" disabled={selected || attachments.length >= 5} onClick={() => addResource(resource)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-muted/60 disabled:opacity-55">
              <Icon size={16} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{resource.title}</span><span className="block text-xs text-muted">{resource.subtitle}</span></span>
              {selected && <Check size={16} className="shrink-0 text-success" aria-label="Added" />}
            </button>
          </li>
        })}
        {!visibleResources.length && <li className="px-3 py-4 text-center text-sm text-muted">{resources.length ? 'No matching workspace items.' : 'No workspace items available to share yet.'}</li>}
      </ul>
      <p className="mt-2 border-t border-border-subtle pt-2 text-[.68rem] text-muted">Up to five references per message.</p>
    </section>}

    {attachments.length > 0 && <ul aria-label="References to attach" className="mb-3 flex flex-wrap gap-2">
      {attachments.map(resource => <li key={`${resource.kind}-${resource.id}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/5 py-1 pl-3 pr-1 text-xs text-text">
        <span className="max-w-52 truncate">{resource.title}</span>
        <button type="button" onClick={() => setAttachments(current => current.filter(item => item.id !== resource.id || item.kind !== resource.kind))} aria-label={`Remove ${resource.title}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-muted"><X size={14} /></button>
      </li>)}
    </ul>}

    <label className="sr-only" htmlFor="chat-message">Message</label>
    <textarea id="chat-message" value={body} onChange={event => setBody(event.target.value)} rows={2} maxLength={2001} placeholder="Write a message…" disabled={disabled}
      className="min-h-12 max-h-36 min-w-0 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60" />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setShowResources(value => !value)} aria-expanded={showResources} disabled={disabled} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-accent hover:bg-surface-muted disabled:opacity-60">
          <Paperclip size={15} aria-hidden="true" />Attach workspace item
        </button>
        <span className={`hidden text-[10px] sm:inline ${body.length > 2000 ? 'text-danger' : 'text-muted'}`} aria-live="polite">{body.length}/2000</span>
      </div>
      <button type="submit" aria-label="Send message" disabled={disabled || sending || !body.trim() || body.length > 2000}
        className="btn-primary min-h-11 !px-4 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} />{sending ? 'Sending' : 'Send'}</button>
    </div>
  </form>
}
