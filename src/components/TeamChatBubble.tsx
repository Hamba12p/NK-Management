'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, MessageCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseChatResources, type ChatMessage } from '@/lib/team-chat'

function previewTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-UG', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export default function TeamChatBubble() {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    const load = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user || !active) {
        if (active && (authError || !user)) setError('Chat preview is unavailable.')
        return
      }
      setUserId(user.id)

      const [{ data: readState, error: readError }, { data, error: messagesError }] = await Promise.all([
        supabase.from('team_chat_reads').select('last_read_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('team_chat_messages').select('id, author_id, author_name, body, attachments, created_at').order('created_at', { ascending: false }).limit(3),
      ])
      if (!active) return
      if (readError || messagesError) {
        setError('Chat preview is unavailable.')
        return
      }
      const latestRead = readState?.last_read_at || '1970-01-01T00:00:00.000Z'
      const { count, error: countError } = await supabase
        .from('team_chat_messages')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', latestRead)
        .neq('author_id', user.id)
      if (!active) return
      if (countError) {
        setError('Chat unread count is unavailable.')
        return
      }
      setMessages((data || []).map(message => ({
        ...message,
        attachments: parseChatResources(message.attachments),
      })) as ChatMessage[])
      setUnreadCount(count || 0)
      setError('')
      if (!channel) {
        channel = supabase
          .channel(`team-chat-preview-${user.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages' }, () => void load())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'team_chat_reads', filter: `user_id=eq.${user.id}` }, () => void load())
          .subscribe()
      }
    }

    void load()
    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  if (pathname === '/dashboard/chat') return null

  return <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <section aria-label="Team chat preview" className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl">
      <header className="flex items-center justify-between gap-3 bg-accent px-4 py-3 text-accent-text">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-text/15"><MessageCircle size={18} aria-hidden="true" /></span>
          <div><h2 className="text-sm font-bold">The Commons</h2><p className="text-xs opacity-85">{unreadCount ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : 'A little team catch-up'}</p></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat preview" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-accent-text/15"><X size={17} aria-hidden="true" /></button>
      </header>
      {error ? <p role="status" className="px-4 py-5 text-sm text-muted">{error}</p> : messages.length ? <ul className="divide-y divide-border-subtle">
        {messages.map(message => <li key={message.id} className="px-4 py-3">
          <Link href="/dashboard/chat" onClick={() => setOpen(false)} className="block rounded-lg focus-visible:outline">
            <span className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold text-text">{message.author_id === userId ? 'You' : message.author_name}</span><time className="shrink-0 text-[.68rem] text-muted" dateTime={message.created_at}>{previewTime(message.created_at)}</time></span>
            <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted">{message.body || (message.attachments.length ? `Shared ${message.attachments[0].title}` : 'New message')}</span>
            {message.attachments.length > 0 && <span className="mt-1 block truncate text-[.68rem] font-semibold text-accent">{message.attachments[0].title}</span>}
          </Link>
        </li>)}
      </ul> : <p className="px-4 py-7 text-center text-sm text-muted">No messages yet. Start the conversation.</p>}
      <div className="border-t border-border p-3">
        <Link href="/dashboard/chat" onClick={() => setOpen(false)} className="btn-primary flex w-full !min-h-11 !rounded-xl !px-4 !py-2.5">
          Open team chat <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>}

    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? 'Close team chat preview' : unreadCount ? `Open team chat, ${unreadCount} unread messages` : 'Open team chat'} className="group relative grid h-14 w-14 place-items-center rounded-2xl border border-white/30 bg-accent text-accent-text shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-offset-4 sm:h-16 sm:w-16">
      <span className="absolute inset-1 rounded-[1.05rem] border border-white/20" aria-hidden="true" />
      {open ? <X size={23} aria-hidden="true" /> : <MessageCircle size={24} aria-hidden="true" />}
      {unreadCount > 0 && !open && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid min-h-6 min-w-6 place-items-center rounded-full border-2 border-surface-raised bg-pink-accent px-1 text-[.65rem] font-bold text-pink-fill-text">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      <span className="sr-only">{unreadCount} unread chat messages</span>
    </button>
  </div>
}
