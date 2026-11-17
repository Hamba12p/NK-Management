'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, MessageSquareText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConversationList from './ConversationList'
import MessageComposer from './MessageComposer'
import MessageThread from './MessageThread'
import { useChatRoom, type ChatContact } from './useChatRoom'
import { useChatUnread } from './ChatUnreadProvider'

export default function ChatPanel() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [selected, setSelected] = useState<ChatContact | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [contactError, setContactError] = useState('')
  const [mobileThread, setMobileThread] = useState(false)
  const { counts, refresh } = useChatUnread()
  const room = useChatRoom(roomId, userId)
  const nearBottomRef = room.nearBottom
  const sending = room.messages.some((message) => message.delivery === 'sending')

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true)
    const [{ data: authData }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('chat_contacts'),
    ])
    setUserId(authData.user?.id || null)
    if (error) setContactError('Conversations could not be loaded.')
    else { setContacts((data || []) as ChatContact[]); setContactError('') }
    setLoadingContacts(false)
  }, [supabase])

  useEffect(() => {
    // The contact list is hydrated from the authenticated user's chat access.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContacts()
  }, [loadContacts])

  const selectContact = useCallback(async (contact: ChatContact) => {
    setSelected(contact)
    setRoomId(null)
    setContactError('')
    setMobileThread(true)
    if (contact.role === 'general' && contact.room_id) {
      setRoomId(contact.room_id)
      return
    }
    if (contact.room_id) { setRoomId(contact.room_id); return }
    if (!contact.user_id) return
    const { data, error } = await supabase.rpc('chat_open_dm', { other_user: contact.user_id })
    if (error || !data) {
      setContactError('This conversation could not be opened. Refresh and try again.')
      setMobileThread(false)
      return
    }
    const openedId = data as string
    setRoomId(openedId)
    setContacts((current) => current.map((item) => item.user_id === contact.user_id ? { ...item, room_id: openedId } : item))
    setSelected((current) => current?.user_id === contact.user_id ? { ...current, room_id: openedId } : current)
  }, [supabase])

  useEffect(() => {
    const requestedRoom = new URLSearchParams(window.location.search).get('room')
    if (!requestedRoom || roomId === requestedRoom) return
    const contact = contacts.find((entry) => entry.room_id === requestedRoom)
    // Resolve deep links only after the authorized contacts have loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (contact) void selectContact(contact)
  }, [contacts, roomId, selectContact])

  const backToList = () => { setMobileThread(false); setRoomId(null); setSelected(null) }

  return <section aria-label="Chat" className="record-surface flex min-h-[min(72vh,52rem)] overflow-hidden rounded-xl border border-border">
    <aside className={`${mobileThread ? 'hidden' : 'flex'} w-full shrink-0 flex-col border-r border-border bg-surface-raised md:flex md:w-72 lg:w-80`}>
      <div className="border-b border-border px-4 py-4"><h1 className="text-lg font-bold text-text">Chat</h1><p className="mt-1 text-xs text-muted">Private conversations for your team</p></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loadingContacts ? <p className="p-3 text-sm text-muted">Loading conversations…</p>
          : contactError && !contacts.length ? <div role="alert" className="rounded-lg bg-danger/5 p-3 text-sm text-danger"><AlertCircle size={16} className="mb-2" />{contactError}<button type="button" onClick={() => void loadContacts()} className="mt-2 block underline">Try again</button></div>
          : contacts.length ? <ConversationList contacts={contacts} selectedId={selected?.room_id || selected?.user_id || (selected?.role === 'general' ? 'general' : null)} unread={counts} onSelect={(contact) => void selectContact(contact)} />
            : <p className="p-3 text-sm text-muted">No conversations are available for your account.</p>}
      </div>
    </aside>
    <div className={`${mobileThread ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}>
      {selected && roomId ? <>
        <MessageThread contact={selected} contacts={contacts} messages={room.messages} userId={userId} loading={room.loading} hasOlder={room.hasOlder} error={room.error}
          failedBody={room.failedBody} onLoadOlder={room.loadOlder} onRetry={room.retry} onBack={backToList} nearBottomRef={nearBottomRef} />
        <MessageComposer onSend={room.send} sending={sending} />
      </> : <div className="hidden flex-1 flex-col items-center justify-center p-8 text-center md:flex">
        <MessageSquareText size={36} className="text-accent/60" aria-hidden="true" />
        <p className="mt-3 font-semibold text-text">Choose a conversation</p>
        <p className="mt-1 max-w-xs text-sm text-muted">Select a person or General to read and send messages.</p>
      </div>}
    </div>
    {contactError && contacts.length > 0 && <p role="alert" className="sr-only">{contactError}</p>}
    <button type="button" onClick={() => void refresh()} className="sr-only" aria-label="Refresh unread messages">Refresh unread messages</button>
  </section>
}
