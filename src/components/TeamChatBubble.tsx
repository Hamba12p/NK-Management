'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, MessageCircle, X } from 'lucide-react'
import { canUseChat } from '@/lib/chat/access'
import { createClient } from '@/lib/supabase/client'
import { useChatUnread } from '@/components/chat/ChatUnreadProvider'

type ChatContact = {
  user_id: string | null
  display_name: string
  role: string
  room_id: string | null
}

type UnreadContact = ChatContact & { room_id: string }

export default function TeamChatBubble({ role }: { role?: string | null }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const { counts, total: unreadCount, refresh: refreshUnread } = useChatUnread()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const loadContacts = useCallback(async () => {
    const { data, error: queryError } = await supabase.rpc('chat_contacts')
    if (queryError) {
      setError('Chat preview is unavailable.')
      setLoading(false)
      return
    }
    setContacts((data || []) as ChatContact[])
    setError('')
    setLoading(false)
    await refreshUnread()
  }, [refreshUnread, supabase])

  const unreadChats = contacts
    .filter((contact): contact is UnreadContact => Boolean(contact.room_id && counts[contact.room_id] > 0))
    .sort((a, b) => counts[b.room_id] - counts[a.room_id] || a.display_name.localeCompare(b.display_name))

  useEffect(() => {
    if (!canUseChat(role) || pathname === '/dashboard/chat') return
    // Load conversation names only; unread counts come from the chat provider.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContacts()
    const channel = supabase
      .channel('team-chat-bubble')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => void loadContacts())
      .subscribe()
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadContacts()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      void supabase.removeChannel(channel)
    }
  }, [loadContacts, pathname, role, supabase])

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
          <div><h2 className="text-sm font-bold">Team chat</h2><p className="text-xs opacity-85">{unreadCount ? `${unreadChats.length} unread chat${unreadChats.length === 1 ? '' : 's'} · ${unreadCount} message${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}</p></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat preview" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-accent-text/15"><X size={17} aria-hidden="true" /></button>
      </header>
      {error ? <p role="status" className="px-4 py-5 text-sm text-muted">{error}</p>
        : loading ? <p className="px-4 py-5 text-sm text-muted">Loading chats…</p>
        : unreadChats.length ? <ul aria-label="Unread chats" className="divide-y divide-border-subtle">
          {unreadChats.slice(0, 5).map(contact => <li key={contact.room_id} className="px-4 py-2">
            <Link href={`/dashboard/chat?room=${encodeURIComponent(contact.room_id)}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted focus-visible:outline">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{contact.display_name}</span>
              <span className="shrink-0 rounded-full bg-pink-accent px-2 py-0.5 text-xs font-bold text-pink-fill-text">{counts[contact.room_id] > 99 ? '99+' : counts[contact.room_id]}</span>
            </Link>
          </li>)}
        </ul> : <p className="px-4 py-7 text-center text-sm text-muted">No unread chats.</p>}
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
