'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  FileText,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  chatResourceHref,
  chatResourceLabel,
  parseChatResources,
  type ChatMessage,
  type ChatResource,
  type ChatResourceKind,
} from '@/lib/team-chat'

type ResourceChoice = ChatResource & { subtitle: string }

const resourceIcons: Record<ChatResourceKind, typeof FileText> = {
  document: FileText,
  workspace: BookOpen,
  task: Check,
  meeting: CalendarDays,
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T'
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function TeamChatPage() {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [resources, setResources] = useState<ResourceChoice[]>([])
  const [userId, setUserId] = useState('')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [resourceSearch, setResourceSearch] = useState('')
  const [attachments, setAttachments] = useState<ChatResource[]>([])
  const [showResources, setShowResources] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [resourceError, setResourceError] = useState('')
  const endOfMessages = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      setError('Your session could not be verified. Please sign in again.')
      setLoading(false)
      return
    }
    setUserId(user.id)
    const { data, error: queryError } = await supabase
      .from('team_chat_messages')
      .select('id, author_id, author_name, body, attachments, created_at')
      .order('created_at', { ascending: false })
      .limit(60)
    if (queryError) {
      setError('Team chat is unavailable. Please try again in a moment.')
      setLoading(false)
      return
    }
    setMessages((data || []).reverse().map(message => ({
      ...message,
      attachments: parseChatResources(message.attachments),
    })) as ChatMessage[])
    setError('')
    setLoading(false)
    const { error: readError } = await supabase.rpc('mark_team_chat_read')
    if (readError) setError('Messages loaded, but your read status could not be updated.')
  }, [supabase])

  const loadResources = useCallback(async () => {
    const [documents, workspace, tasks, meetings] = await Promise.all([
      supabase.from('documents').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }).limit(30),
      supabase.from('workspace_docs').select('id, title').is('deleted_at', null).order('updated_at', { ascending: false }).limit(30),
      supabase.from('tasks').select('id, title, status').is('deleted_at', null).neq('status', 'done').order('created_at', { ascending: false }).limit(30),
      supabase.from('meetings').select('id, title, scheduled_at').is('deleted_at', null).order('scheduled_at', { ascending: false }).limit(20),
    ])
    const failures = [documents.error, workspace.error, tasks.error, meetings.error].filter(Boolean)
    if (failures.length) setResourceError('Some workspace references could not be loaded.')
    setResources([
      ...(documents.data || []).map(item => ({ id: item.id, kind: 'document' as const, title: item.name, subtitle: 'Shared file' })),
      ...(workspace.data || []).map(item => ({ id: item.id, kind: 'workspace' as const, title: item.title, subtitle: 'Workspace document' })),
      ...(tasks.data || []).map(item => ({ id: item.id, kind: 'task' as const, title: item.title, subtitle: `Task · ${item.status.replace('_', ' ')}` })),
      ...(meetings.data || []).map(item => ({ id: item.id, kind: 'meeting' as const, title: item.title, subtitle: `Meeting · ${new Date(item.scheduled_at).toLocaleDateString('en-UG')}` })),
    ])
  }, [supabase])

  useEffect(() => {
    // Initial remote hydration intentionally populates the chat after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages()
    void loadResources()
    const channel = supabase
      .channel('team-chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages' }, () => void loadMessages())
      .subscribe()
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadMessages()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      void supabase.removeChannel(channel)
    }
  }, [loadMessages, loadResources, supabase])

  useEffect(() => {
    if (!loading) endOfMessages.current?.scrollIntoView({ block: 'end' })
  }, [loading, messages])

  const addResource = (resource: ChatResource) => {
    if (attachments.some(item => item.id === resource.id && item.kind === resource.kind)) return
    if (attachments.length >= 5) {
      setError('A message can include up to five workspace references.')
      return
    }
    setAttachments(current => [...current, resource])
    setShowResources(false)
    setResourceSearch('')
    setError('')
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()
    if ((!body && !attachments.length) || sending) return
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      setError('Your session has expired. Please sign in again.')
      return
    }
    setSending(true)
    setError('')
    const { error: insertError } = await supabase.from('team_chat_messages').insert({
      author_id: user.id,
      body: body || 'Shared a workspace reference',
      attachments,
    })
    if (insertError) {
      setError('Your message could not be sent. Please try again.')
      setSending(false)
      return
    }
    setDraft('')
    setAttachments([])
    setSending(false)
    await loadMessages()
  }

  const visibleMessages = messages.filter(message => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return true
    return message.body.toLocaleLowerCase().includes(query)
      || message.author_name.toLocaleLowerCase().includes(query)
      || message.attachments.some(item => item.title.toLocaleLowerCase().includes(query))
  })

  const visibleResources = resources.filter(resource =>
    `${resource.title} ${resource.subtitle}`.toLocaleLowerCase().includes(resourceSearch.trim().toLocaleLowerCase()),
  )

  return <div>
    <PageHeader title="Team chat" description="A shared place for quick updates, useful links, and the little decisions that keep work moving." />
    <section className="mx-auto flex min-h-[min(72vh,48rem)] max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-text"><Users size={20} aria-hidden="true" /></span>
          <div><h2 className="font-bold text-text">The Commons</h2><p className="text-xs text-muted">One shared conversation for the whole team</p></div>
        </div>
        <label className="global-search-shell flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-muted">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search recent messages</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search recent messages" className="global-search-input w-40 text-sm sm:w-52" />
        </label>
      </header>

      {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger sm:mx-7">{error}</p>}

      <div role="log" className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-7" aria-label="Team chat messages" aria-live="polite" aria-relevant="additions">
        {loading ? <div className="space-y-4" aria-label="Loading messages"><div className="h-16 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" /><div className="ml-auto h-16 w-3/4 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" /></div>
          : visibleMessages.length ? visibleMessages.map(message => {
            const ownMessage = message.author_id === userId
            return <article key={message.id} className={`flex items-end gap-2.5 ${ownMessage ? 'flex-row-reverse' : ''}`}>
              <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-[42%_58%_54%_46%] text-xs font-bold ${ownMessage ? 'bg-pink-100 text-pink-800' : 'bg-accent text-accent-text'}`}>{initials(message.author_name)}</span>
              <div className={`max-w-[min(88%,38rem)] rounded-2xl border px-4 py-3 ${ownMessage ? 'rounded-br-sm border-accent/20 bg-accent/5' : 'rounded-bl-sm border-border bg-surface'}`}>
                <div className={`mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${ownMessage ? 'justify-end' : ''}`}>
                  <p className="text-xs font-bold text-text">{ownMessage ? 'You' : message.author_name}</p>
                  <time className="text-[.68rem] text-muted" dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text">{message.body}</p>
                {message.attachments.length > 0 && <ul className="mt-3 space-y-2">
                  {message.attachments.map(resource => {
                    const Icon = resourceIcons[resource.kind]
                    return <li key={`${resource.kind}-${resource.id}`}>
                      <a href={chatResourceHref(resource)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left transition hover:border-accent hover:bg-surface-muted/40">
                        <Icon size={16} className="shrink-0 text-accent" aria-hidden="true" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-text">{resource.title}</span><span className="block text-[.68rem] text-muted">{chatResourceLabel(resource.kind)}</span></span>
                        <ArrowUpRight size={14} className="shrink-0 text-muted" aria-hidden="true" />
                      </a>
                    </li>
                  })}
                </ul>}
              </div>
            </article>
          }) : <div className="grid min-h-64 place-content-center px-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-800"><MessageCircle size={22} aria-hidden="true" /></span>
            <h3 className="serif-display mt-4 text-xl text-text">{search ? 'No matching messages' : 'A fresh page for good ideas'}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{search ? 'Try another name, phrase, or attached item.' : 'Share a quick update, ask a question, or bring a workspace item into the conversation.'}</p>
          </div>}
        <div ref={endOfMessages} />
      </div>

      <footer className="border-t border-border bg-surface px-4 py-4 sm:px-7">
        {showResources && <section aria-label="Choose a workspace reference" className="mb-4 rounded-xl border border-border bg-surface-raised p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-bold text-text">Bring work into the chat</h3><p className="mt-0.5 text-xs text-muted">References open in their original workspace.</p></div>
            <button type="button" onClick={() => setShowResources(false)} aria-label="Close references" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-text"><X size={17} /></button>
          </div>
          <label className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-muted">
            <Search size={15} aria-hidden="true" /><span className="sr-only">Filter workspace items</span>
            <input autoFocus value={resourceSearch} onChange={event => setResourceSearch(event.target.value)} placeholder="Find a document, task, or meeting" className="global-search-input w-full text-sm" />
          </label>
          {resourceError && <p className="mt-2 text-xs text-warning">{resourceError}</p>}
          <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {visibleResources.map(resource => {
              const Icon = resourceIcons[resource.kind]
              const selected = attachments.some(item => item.id === resource.id && item.kind === resource.kind)
              const capped = attachments.length >= 5 && !selected
              return <li key={`${resource.kind}-${resource.id}`}>
                <button type="button" disabled={selected || capped} onClick={() => addResource(resource)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-muted/60 disabled:opacity-55">
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
          {attachments.map(resource => <li key={`${resource.kind}-${resource.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 py-1 pl-3 pr-1 text-xs text-text">
            <span className="max-w-52 truncate">{resource.title}</span>
            <button type="button" onClick={() => setAttachments(current => current.filter(item => item.id !== resource.id || item.kind !== resource.kind))} aria-label={`Remove ${resource.title}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-text"><X size={14} /></button>
          </li>)}
        </ul>}

        <form onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="team-chat-composer">Write a message</label>
          <textarea id="team-chat-composer" rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }} placeholder="Write a message… (Enter to send, Shift + Enter for a new line)" className="min-h-20 w-full resize-y rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm leading-6" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowResources(value => !value)} aria-expanded={showResources} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-accent transition hover:bg-surface-muted">
                <Paperclip size={15} aria-hidden="true" />Attach workspace item
              </button>
              <p className="hidden text-[.68rem] text-muted sm:block">Keep messages under 2,000 characters</p>
            </div>
            <button type="submit" disabled={sending || (!draft.trim() && !attachments.length)} className="btn-primary !min-h-10 !rounded-lg !px-4 !py-2">
              <Send size={15} aria-hidden="true" />{sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </footer>
    </section>
  </div>
}
