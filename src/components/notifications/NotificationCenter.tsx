'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notificationCopy, type NotificationType } from '@/lib/notifications/policy'

type InboxItem = {
  id: string
  type: Exclude<NotificationType, 'test'>
  entity_id: string
  url: string
  created_at: string
  read_at: string | null
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function NotificationCenter() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [items, setItems] = useState<InboxItem[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const unreadCount = items.filter((item) => !item.read_at).length

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      setUserId(user.id)
      const refresh = async () => {
        const { data, error: queryError } = await supabase
          .from('notifications')
          .select('id, type, entity_id, url, created_at, read_at')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)
        if (!active) return
        if (queryError) {
          setError('Notifications could not be loaded.')
          return
        }
        setItems((data || []) as InboxItem[])
        setError('')
      }
      await refresh()
      if (!active) return
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        }, () => void refresh())
        .subscribe()
      window.addEventListener('focus', refresh)
      document.addEventListener('visibilitychange', refresh)
      return () => {
        window.removeEventListener('focus', refresh)
        document.removeEventListener('visibilitychange', refresh)
      }
    }
    let removeRefreshListeners: (() => void) | undefined
    void load().then((cleanup) => { removeRefreshListeners = cleanup }).catch(() => {
      if (active) setError('Notifications could not be loaded.')
    })
    return () => {
      active = false
      removeRefreshListeners?.()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase])

  async function markRead(item: InboxItem) {
    if (!userId || item.read_at) return
    const timestamp = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: timestamp })
      .eq('id', item.id)
      .eq('recipient_id', userId)
    if (updateError) {
      setError('This notification could not be marked as read.')
      return
    }
    setItems((current) => current.map((value) => value.id === item.id ? { ...value, read_at: timestamp } : value))
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return
    const timestamp = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: timestamp })
      .eq('recipient_id', userId)
      .is('read_at', null)
    if (updateError) {
      setError('Notifications could not be marked as read.')
      return
    }
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || timestamp })))
    setError('')
  }

  return <div className="relative">
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      className="relative grid h-10 w-10 place-items-center rounded-lg border border-border text-accent hover:bg-surface-muted"
    >
      <Bell size={19} aria-hidden="true" />
      {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-pink-accent px-1 text-[10px] font-bold text-pink-fill-text">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section aria-label="Notifications" className="record-surface absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1rem))] p-3 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-1 pb-3">
        <h2 className="font-bold text-text">Notifications</h2>
        <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-accent underline"><CheckCheck size={15} aria-hidden="true" />Mark all as read</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded bg-danger/10 p-2 text-xs text-danger">{error}</p>}
      <ul className="mt-2 max-h-[min(65vh,30rem)] space-y-1 overflow-y-auto">
        {items.map((item) => <li key={item.id} className={`rounded-lg p-3 ${item.read_at ? 'bg-surface' : 'bg-surface-muted'}`}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Link href={item.url} onClick={() => { void markRead(item); setOpen(false) }} className="block text-sm font-semibold leading-5 text-accent hover:underline">
                {notificationCopy(item.type)}
              </Link>
              <time className="mt-1 block text-xs text-muted" dateTime={item.created_at}>{formatTime(item.created_at)}</time>
            </div>
            {!item.read_at && <button type="button" onClick={() => void markRead(item)} className="min-h-9 shrink-0 text-xs font-semibold text-accent underline" aria-label="Mark notification as read">Mark read</button>}
          </div>
        </li>)}
      </ul>
      {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted">You are all caught up.</p>}
    </section>}
  </div>
}
