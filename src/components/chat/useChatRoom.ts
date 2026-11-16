'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatUnread } from './ChatUnreadProvider'

export type ChatMessage = { id: string; room_id: string; sender_id: string; body: string; created_at: string; delivery?: 'sending' | 'failed' }
export type ChatContact = { user_id: string | null; display_name: string; role: string; is_shared_account: boolean; room_id: string | null }

export function useChatRoom(roomId: string | null, userId: string | null) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [error, setError] = useState('')
  const [failedBody, setFailedBody] = useState<string | null>(null)
  const pendingId = useRef<string | null>(null)
  const nearBottom = useRef(true)
  const { refresh } = useChatUnread()

  const loadLatest = useCallback(async () => {
    if (!roomId) { setMessages([]); return }
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase.from('chat_messages').select('id,room_id,sender_id,body,created_at')
      .eq('room_id', roomId).order('created_at', { ascending: false }).limit(50)
    if (queryError) setError('Messages could not be loaded.')
    else {
      const rows = (data || []) as ChatMessage[]
      setMessages(rows.reverse())
      setHasOlder(rows.length === 50)
    }
    setLoading(false)
  }, [roomId, supabase])

  useEffect(() => {
    let active = true
    nearBottom.current = true
    setMessages([])
    setHasOlder(false)
    setError('')
    setFailedBody(null)
    if (!roomId) return
    void loadLatest().then(() => { if (active) void markRead() })
    const channel = supabase.channel(`chat-room-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        if (!active) return
        const incoming = payload.new as ChatMessage
        setMessages((current) => {
          const existing = current.findIndex((item) => item.id === incoming.id)
          if (existing >= 0) return current
          const optimisticIndex = incoming.sender_id === userId && pendingId.current
            ? current.findIndex((item) => item.id === pendingId.current && item.body === incoming.body)
            : -1
          if (optimisticIndex >= 0) {
            const next = [...current]
            next[optimisticIndex] = incoming
            pendingId.current = null
            setFailedBody(null)
            return next
          }
          return [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at))
        })
      }).subscribe()
    const markRead = async () => {
      const { error: markError } = await supabase.rpc('chat_mark_read', { p_room_id: roomId })
      if (!markError) await refresh()
    }
    const onFocus = () => { void markRead() }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [loadLatest, refresh, roomId, supabase, userId])

  const loadOlder = useCallback(async () => {
    if (!roomId || !messages.length || !hasOlder) return [] as ChatMessage[]
    const oldest = messages[0]
    const { data, error: queryError } = await supabase.from('chat_messages').select('id,room_id,sender_id,body,created_at')
      .eq('room_id', roomId).lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(50)
    if (queryError) { setError('Older messages could not be loaded.'); return [] }
    const rows = ((data || []) as ChatMessage[]).reverse()
    setMessages((current) => [...rows, ...current.filter((item) => !rows.some((row) => row.id === item.id))])
    setHasOlder(rows.length === 50)
    return rows
  }, [hasOlder, messages, roomId, supabase])

  const send = useCallback(async (body: string) => {
    if (!roomId || !userId || pendingId.current || !body.trim() || body.length > 2000) return false
    const clientId = `pending-${crypto.randomUUID()}`
    pendingId.current = clientId
    setError('')
    setFailedBody(null)
    const optimistic: ChatMessage = { id: clientId, room_id: roomId, sender_id: userId, body, created_at: new Date().toISOString(), delivery: 'sending' }
    setMessages((current) => [...current, optimistic])
    const { data, error: sendError } = await supabase.from('chat_messages').insert({ room_id: roomId, body }).select('id,room_id,sender_id,body,created_at').single()
    if (sendError || !data) {
      pendingId.current = null
      setMessages((current) => current.map((item) => item.id === clientId ? { ...item, delivery: 'failed' } : item))
      setError('Your message could not be sent.')
      setFailedBody(body)
      return false
    }
    pendingId.current = null
    setMessages((current) => {
      const withoutOptimistic = current.filter((item) => item.id !== clientId)
      if (withoutOptimistic.some((item) => item.id === data.id)) return withoutOptimistic
      return [...withoutOptimistic, data as ChatMessage].sort((a, b) => a.created_at.localeCompare(b.created_at))
    })
    await refresh()
    return true
  }, [refresh, roomId, supabase, userId])

  const retry = useCallback(async () => {
    if (!failedBody) return false
    setMessages((current) => current.filter((item) => item.delivery !== 'failed'))
    return send(failedBody)
  }, [failedBody, send])

  return { messages, loading, hasOlder, error, failedBody, send, retry, loadOlder, nearBottom }
}
