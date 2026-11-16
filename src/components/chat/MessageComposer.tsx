'use client'

import { FormEvent, useState } from 'react'
import { Send } from 'lucide-react'

export default function MessageComposer({ onSend, sending, disabled }: { onSend: (body: string) => Promise<boolean>; sending: boolean; disabled?: boolean }) {
  const [body, setBody] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!body.trim() || body.length > 2000 || sending || disabled) return
    if (await onSend(body)) setBody('')
  }
  return <form onSubmit={submit} className="flex items-end gap-2 border-t border-border bg-surface-raised p-3 sm:p-4">
    <label className="sr-only" htmlFor="chat-message">Message</label>
    <textarea id="chat-message" value={body} onChange={(event) => setBody(event.target.value)} rows={2} maxLength={2001} placeholder="Write a message…" disabled={disabled}
      className="min-h-12 max-h-36 min-w-0 flex-1 resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60" />
    <div className="flex flex-col items-end gap-1">
      <span className={`text-[10px] ${body.length > 2000 ? 'text-danger' : 'text-muted'}`} aria-live="polite">{body.length}/2000</span>
      <button type="submit" aria-label="Send message" disabled={disabled || sending || !body.trim() || body.length > 2000}
        className="btn-primary min-h-11 !px-4 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} />{sending ? 'Sending' : 'Send'}</button>
    </div>
  </form>
}
