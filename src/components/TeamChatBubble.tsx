'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, MessageCircle, X } from 'lucide-react'
import { canUseChat } from '@/lib/chat/access'
import { createClient } from '@/lib/supabase/client'
import { useChatUnread } from '@/components/chat/ChatUnreadProvider'
import { parseChatResources, type ChatResource } from '@/lib/team-chat'

type PreviewMessage = {
  id: string
  room_id: string
  sender_id: string
  body: string
  attachments: ChatResource[]
  created_at: string
  conversation: string
  sender: string
}

type ChatContact = {
  user_id: string | null
  display_name: string
  role: string
  room_id: string | null
}

function previewTime(value: string) {
  return new Intl.DateTimeFormat('en-UG', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default function TeamChatBubble({ role }: { role?: string | null }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const { total: unreadCount, refresh: refreshUnread } = useChatUnread()
  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const loadPreviews = useCallback(async () => {
    const [{ data: authData, error: authError }, { data: contacts, error: contactsError }, { data, error: messagesError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('chat_contacts'),
      supabase.from('chat_messages').select('id,room_id,sender_id,body,attachments,created_at').order('created_at', { ascending: false }).limit(3),
    ])
    const user = authData.user
    if (authError || !user || contactsError || messagesError) {
      setError('Chat preview is unavailable.')
      return
    }
    const availableContacts = (contacts || []) as ChatContact[]
    const contactByRoom = new Map(availableContacts.filter(contact => contact.room_id).map(contact => [contact.room_id as string, contact]))
    const contactByUser = new Map(availableContacts.filter(contact => contact.user_id).map(contact => [contact.user_id as string, contact]))
    const previews = (data || []).flatMap((message): PreviewMessage[] => {
      const contact = contactByRoom.get(message.room_id)
      if (!contact) return []
      return [{
        ...message,
        attachments: parseChatResources(message.attachments),
        conversation: contact.display_name,
        sender: contact.role === 'general'
          ? contactByUser.get(message.sender_id)?.display_name || (message.sender_id === user.id ? 'You' : 'Team member')
          : message.sender_id === user.id ? 'You' : contact.display_name,
      }]
    })
    setMessages(previews)
    setError('')
    await refreshUnread()
  }, [refreshUnread, supabase])

  useEffect(() => {
    if (!canUseChat(role) || pathname === '/dashboard/chat') return
    // Load server-backed previews and subscribe to new messages after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPreviews()
    const channel = supabase
      .channel('team-chat-bubble')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => void loadPreviews())
      .subscribe()
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadPreviews()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      void supabase.removeChannel(channel)
    }
  }, [loadPreviews, pathname, role, supabase])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  if (!canUseChat(role) || pathname === '/dashboard/chat') return null

  return <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <section aria-label="Team chat preview" className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl">
      <header className="flex items-center justify-between gap-3 bg-accent px-4 py-3 text-accent-text">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-text/15"><MessageCircle size={18} aria-hidden="true" /></span>
          <div><h2 className="text-sm font-bold">Team chat</h2><p className="text-xs opacity-85">{unreadCount ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : 'A little team catch-up'}</p></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat preview" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-accent-text/15"><X size={17} aria-hidden="true" /></button>
      </header>
      {error ? <p role="status" className="px-4 py-5 text-sm text-muted">{error}</p> : messages.length ? <ul className="divide-y divide-border-subtle">
        {messages.map(message => <li key={message.id} className="px-4 py-3">
          <Link href={`/dashboard/chat?room=${encodeURIComponent(message.room_id)}`} onClick={() => setOpen(false)} className="block rounded-lg focus-visible:outline">
            <span className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold text-text">{message.conversation === 'General' ? `General · ${message.sender}` : message.sender}</span><time className="shrink-0 text-[.68rem] text-muted" dateTime={message.created_at}>{previewTime(message.created_at)}</time></span>
            <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted">{message.body || (message.attachments.length ? `Shared ${message.attachments[0].title}` : 'New message')}</span>
            {message.attachments.length > 0 && <span className="mt-1 block truncate text-[.68rem] font-semibold text-accent">{message.attachments[0].title}</span>}
          </Link>
        </li>)}
      </ul> : <p className="px-4 py-7 text-center text-sm text-muted">No recent messages. Start a conversation.</p>}
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
