'use client'

import { useLayoutEffect, useRef } from 'react'
import { ArrowDown, ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, FileText, LoaderCircle } from 'lucide-react'
import type { ChatContact, ChatMessage } from './useChatRoom'
import { chatResourceHref, chatResourceLabel, type ChatResourceKind } from '@/lib/team-chat'

const resourceIcons: Record<ChatResourceKind, typeof FileText> = {
  document: FileText,
  workspace: BookOpen,
  task: Check,
  meeting: CalendarDays,
}

export default function MessageThread({ contact, contacts, messages, userId, loading, hasOlder, error, failedBody, onLoadOlder, onRetry, onBack, nearBottomRef }: {
  contact: ChatContact | null; contacts: ChatContact[]; messages: ChatMessage[]; userId: string | null; loading: boolean; hasOlder: boolean; error: string; failedBody: string | null
  onLoadOlder: () => Promise<ChatMessage[]>; onRetry: () => Promise<boolean>; onBack?: () => void; nearBottomRef: React.MutableRefObject<boolean>
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const olderAnchor = useRef<{ height: number; top: number } | null>(null)
  const firstRender = useRef(true)
  const loadOlder = async () => {
    if (scroller.current) olderAnchor.current = { height: scroller.current.scrollHeight, top: scroller.current.scrollTop }
    await onLoadOlder()
  }
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (olderAnchor.current) {
      element.scrollTop = olderAnchor.current.top + element.scrollHeight - olderAnchor.current.height
      olderAnchor.current = null
    } else if (firstRender.current || nearBottomRef.current) {
      element.scrollTop = element.scrollHeight
    }
    firstRender.current = false
  }, [messages, nearBottomRef])

  return <section className="flex min-h-0 flex-1 flex-col bg-surface" aria-label={contact ? `Chat with ${contact.display_name}` : 'Chat thread'}>
    <header className="flex min-h-[4.25rem] items-center gap-3 border-b border-border px-4 py-3">
      {onBack && <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-surface-muted" aria-label="Back to conversations"><ArrowLeft size={18} /></button>}
      <div className="min-w-0"><h2 className="truncate font-bold text-text">{contact?.display_name || 'Choose a conversation'}</h2>{contact?.is_shared_account && <p className="text-xs text-muted">Shared volunteer login</p>}</div>
    </header>
    <div ref={scroller} onScroll={(event) => {
      const target = event.currentTarget
      nearBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 100
    }} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
      {hasOlder && <div className="text-center"><button type="button" onClick={() => void loadOlder()} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-surface-muted"><ArrowDown size={15} />Load older messages</button></div>}
      {loading && messages.length === 0 && <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" />Loading messages…</p>}
      {!loading && messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Start the conversation.</p>}
      {messages.map((message) => {
        const own = message.sender_id === userId
        const senderName = contacts.find((entry) => entry.user_id === message.sender_id)?.display_name
        return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
          <article className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${own ? 'rounded-br-sm bg-accent text-white' : 'rounded-bl-sm bg-surface-muted text-text'} ${message.delivery === 'failed' ? 'border border-danger' : ''}`}>
            {contact?.role === 'general' && !own && <p className="mb-1 text-[11px] font-semibold opacity-75">{senderName || 'Team member'}</p>}
            <p>{message.body}</p>
            {message.attachments.length > 0 && <ul className="mt-2 space-y-1.5">
              {message.attachments.map(resource => {
                const Icon = resourceIcons[resource.kind]
                return <li key={`${resource.kind}-${resource.id}`}>
                  <a href={chatResourceHref(resource)} target="_blank" rel="noreferrer" className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${own ? 'border-white/25 bg-black/10 hover:bg-black/15' : 'border-border bg-surface-raised hover:bg-surface'}`}>
                    <Icon size={15} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{resource.title}</span><span className="block text-[10px] opacity-75">{chatResourceLabel(resource.kind)}</span></span>
                    <ArrowUpRight size={13} className="shrink-0" aria-hidden="true" />
                  </a>
                </li>
              })}
            </ul>}
            <time className={`mt-1 block text-right text-[10px] ${own ? 'text-white/70' : 'text-muted'}`} dateTime={message.created_at}>
              {message.delivery === 'sending' ? 'Sending…' : message.delivery === 'failed' ? 'Not sent' : new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}
            </time>
          </article>
        </div>
      })}
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 border-t border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
      <span>{error}{failedBody ? ` “${failedBody.slice(0, 90)}${failedBody.length > 90 ? '…' : ''}”` : ''}</span>
      {failedBody && <button type="button" onClick={() => void onRetry()} className="min-h-9 shrink-0 font-semibold underline">Retry</button>}
    </div>}
  </section>
}
