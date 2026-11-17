'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ChatUnreadContextValue = { counts: Record<string, number>; total: number; refresh: () => Promise<void> }
const ChatUnreadContext = createContext<ChatUnreadContextValue>({ counts: {}, total: 0, refresh: async () => {} })

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('chat_unread_counts')
    if (error) return
    const next: Record<string, number> = {}
    for (const row of (data || []) as { room_id: string; unread: number }[]) next[row.room_id] = Number(row.unread)
    setCounts(next)
  }, [supabase])

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active || !user) return
      await refresh()
      if (!active) return
      channel = supabase.channel(`chat-unread-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
          if (timeout) clearTimeout(timeout)
          timeout = setTimeout(() => { if (active) void refresh() }, 150)
        })
        .subscribe()
    })
    return () => {
      active = false
      if (timeout) clearTimeout(timeout)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [refresh, supabase])

  const value = useMemo(() => ({ counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0), refresh }), [counts, refresh])
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>
}

export function useChatUnread() {
  return useContext(ChatUnreadContext)
}
