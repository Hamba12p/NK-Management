'use client'

import { MessageCircle } from 'lucide-react'
import type { ChatContact } from './useChatRoom'

const roleGroup = (role: string) => ['admin', 'manager'].includes(role) ? 'Managers'
  : role === 'dpo' ? 'Managers'
  : role === 'board_advisor' ? 'Board & Advisory'
  : role === 'intern' ? 'Interns'
  : ['volunteer', 'volunteer_senior', 'volunteer_lead'].includes(role) ? 'Volunteers' : ''

export default function ConversationList({ contacts, selectedId, unread, onSelect }: {
  contacts: ChatContact[]; selectedId: string | null; unread: Record<string, number>; onSelect: (contact: ChatContact) => void
}) {
  const groups = ['General', 'Managers', 'Volunteers', 'Interns', 'Board & Advisory']
  return <nav aria-label="Conversations" className="space-y-5">
    {groups.map((group) => {
      const entries = contacts.filter((contact) => group === 'General' ? contact.role === 'general' : roleGroup(contact.role) === group)
      if (!entries.length) return null
      return <section key={group}>
        <h2 className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-muted">{group}</h2>
        <ul className="space-y-1">{entries.map((contact) => {
          const id = contact.room_id || contact.user_id || 'general'
          const active = selectedId === id
          const count = contact.room_id ? unread[contact.room_id] || 0 : 0
          return <li key={`${group}-${id}`}>
            <button type="button" onClick={() => onSelect(contact)} aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-surface-muted text-accent' : 'text-text hover:bg-surface-muted'}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><MessageCircle size={17} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{contact.display_name}</span>
                {contact.is_shared_account && <span className="block text-xs text-muted">Shared volunteer login</span>}
              </span>
              {count > 0 && <span className="rounded-full bg-pink-accent px-2 py-0.5 text-xs font-bold text-pink-fill-text">{count > 99 ? '99+' : count}</span>}
            </button>
          </li>
        })}</ul>
      </section>
    })}
  </nav>
}
