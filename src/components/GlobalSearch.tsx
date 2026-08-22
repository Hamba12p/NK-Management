'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CalendarDays, FileText, ListTodo, Loader2, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SearchResult = {
  id: string
  label: string
  kind: 'Document' | 'Workspace document' | 'Task' | 'Meeting' | 'Announcement'
  href: string
}

const iconByKind = {
  Document: FileText,
  'Workspace document': FileText,
  Task: ListTodo,
  Meeting: CalendarDays,
  Announcement: Bell,
}

export default function GlobalSearch() {
  const supabase = useMemo(() => createClient(), [])
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  function updateQuery(value: string) {
    setQuery(value)
    setOpen(true)
    if (value.trim().length < 2) {
      setResults([])
      setError('')
      setLoading(false)
    }
  }

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      const pattern = `%${term}%`
      const [documents, workspaceDocs, tasks, meetings, announcements] = await Promise.all([
        supabase.from('documents').select('id, name').is('deleted_at', null).ilike('name', pattern).limit(5),
        supabase.from('workspace_docs').select('id, title').is('deleted_at', null).ilike('title', pattern).limit(5),
        supabase.from('tasks').select('id, title').is('deleted_at', null).ilike('title', pattern).limit(5),
        supabase.from('meetings').select('id, title').is('deleted_at', null).ilike('title', pattern).limit(5),
        supabase.from('announcements').select('id, title').is('deleted_at', null).ilike('title', pattern).limit(5),
      ])

      const failed = [documents, workspaceDocs, tasks, meetings, announcements].find(result => result.error)
      if (cancelled) return
      if (failed?.error) {
        console.error('Global search failed:', failed.error)
        setResults([])
        setError(`Search failed: ${failed.error.message}`)
        setLoading(false)
        setOpen(true)
        return
      }

      setResults([
        ...(documents.data || []).map(item => ({ id: item.id, label: item.name, kind: 'Document' as const, href: '/dashboard/documents' })),
        ...(workspaceDocs.data || []).map(item => ({ id: item.id, label: item.title, kind: 'Workspace document' as const, href: `/dashboard/workspace?document=${item.id}` })),
        ...(tasks.data || []).map(item => ({ id: item.id, label: item.title, kind: 'Task' as const, href: `/dashboard/workspace?task=${item.id}` })),
        ...(meetings.data || []).map(item => ({ id: item.id, label: item.title, kind: 'Meeting' as const, href: `/dashboard/meetings?meeting=${item.id}` })),
        ...(announcements.data || []).map(item => ({ id: item.id, label: item.title, kind: 'Announcement' as const, href: `/dashboard/announcements?announcement=${item.id}` })),
      ])
      setLoading(false)
      setOpen(true)
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, supabase])

  return (
    <div ref={wrapperRef} className="relative hidden w-80 lg:block">
      <label htmlFor="global-search" className="sr-only">Search documents, tasks, meetings, and announcements</label>
      <div className="flex items-center gap-2 rounded border border-border bg-cream px-3 py-2 text-sm focus-within:border-purple">
        {loading ? <Loader2 size={15} className="animate-spin text-purple" /> : <Search size={15} className="text-muted" />}
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={event => updateQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={event => event.key === 'Escape' && setOpen(false)}
          placeholder="Find documents, tasks, meetings..."
          autoComplete="off"
          aria-expanded={open}
          aria-controls="global-search-results"
          role="combobox"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
        />
        {query && (
          <button type="button" onClick={() => { updateQuery(''); setOpen(false) }} aria-label="Clear search" className="text-muted hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="record-surface absolute right-0 z-50 mt-2 max-h-96 w-full overflow-y-auto p-2">
          {error ? (
            <div role="alert" className="rounded bg-rust/10 p-3 text-sm text-rust">
              <p>{error}</p>
              <button type="button" onClick={() => setQuery(value => `${value} `)} className="mt-2 font-semibold underline">Retry</button>
            </div>
          ) : loading ? (
            <p className="p-3 text-sm text-muted">Searching…</p>
          ) : results.length ? (
            <ul>
              {results.map(result => {
                const Icon = iconByKind[result.kind]
                return (
                  <li key={`${result.kind}-${result.id}`} role="option" aria-selected="false">
                    <Link href={result.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-cream">
                      <Icon size={16} className="shrink-0 text-purple" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{result.label}</span>
                        <span className="block text-xs text-muted">{result.kind}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="p-3 text-sm text-muted">No matching records found.</p>
          )}
        </div>
      )}
    </div>
  )
}
