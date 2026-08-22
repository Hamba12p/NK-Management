'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Clock, Download, History, RotateCcw, ShieldAlert } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'

type Version = {
  id: string
  document_id: string
  version_number: number
  status: 'draft' | 'final'
  created_at: string
  restore_of_version_id: string | null
  workspace_docs: { title: string } | { title: string }[] | null
  profiles: { full_name: string } | { full_name: string }[] | null
}

const one = <T,>(relation: T | T[] | null) => Array.isArray(relation) ? relation[0] : relation

export default function AdvancedPage() {
  const supabase = useMemo(() => createClient(), [])
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') { setError('Only administrators can view document history.'); setLoading(false); return }
    setAuthorized(true)
    const { data, error: queryError } = await supabase
      .from('workspace_doc_versions')
      .select('id, document_id, version_number, status, created_at, restore_of_version_id, workspace_docs(title), profiles!workspace_doc_versions_created_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (queryError) setError(queryError.message)
    else setVersions((data || []) as Version[])
    setLoading(false)
  }, [supabase])

  // Loading remote state is the synchronization this effect owns.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const restore = async (version: Version) => {
    if (!confirm(`Restore version ${version.version_number} of ${one(version.workspace_docs)?.title || 'this document'}? A new version will preserve the restore.`)) return
    setError(''); setMessage('')
    const { error: restoreError } = await supabase.rpc('restore_workspace_document_version', { p_version_id: version.id })
    if (restoreError) { setError(restoreError.message); return }
    await logActivity('workspace.document.restore', 'workspace_doc', version.document_id, { version: version.version_number })
    setMessage('Version restored and recorded as a new revision.'); await load()
  }

  const exportHistory = (format: 'json' | 'csv') => {
    const rows = versions.map(version => ({ document: one(version.workspace_docs)?.title || 'Document', version: version.version_number, status: version.status, created_by: one(version.profiles)?.full_name || 'Team member', created_at: version.created_at, restored_from: version.restore_of_version_id }))
    const content = format === 'json' ? JSON.stringify(rows, null, 2) : ['Document,Version,Status,Created By,Created At,Restore Source', ...rows.map(row => `"${row.document.replaceAll('"', '""')}",${row.version},${row.status},"${row.created_by.replaceAll('"', '""')}",${row.created_at},${row.restored_from || ''}`)].join('\n')
    const link = document.createElement('a'); link.href = `data:text/${format === 'json' ? 'json' : 'csv'};charset=utf-8,${encodeURIComponent(content)}`; link.download = `workspace-history-${new Date().toISOString().slice(0, 10)}.${format}`; link.click()
  }

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading document history…</div>
  if (!authorized) return <div className="grid min-h-96 place-items-center"><div className="max-w-sm text-center"><ShieldAlert className="mx-auto mb-4 text-rust" size={48} /><h1 className="serif-display text-2xl text-ink">Access restricted</h1><p className="mt-2 text-sm text-muted">{error}</p></div></div>

  return <div><PageHeader title="Advanced Features" description="Versioned workspace records, restore controls, and audit exports." action={<div className="flex gap-2"><button onClick={() => exportHistory('csv')} className="btn-secondary"><Download size={16} />CSV</button><button onClick={() => exportHistory('json')} className="btn-secondary"><Download size={16} />JSON</button></div>} />
    {message && <p className="mb-5 rounded-lg border border-green/30 bg-green/10 p-3 text-sm text-green">{message}</p>}
    {error && <p className="mb-5 rounded-lg border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    <div className="mb-5 flex items-center gap-2"><History className="text-purple" size={20} /><h2 className="serif-display text-2xl text-ink">Document History</h2></div>
    <div className="space-y-3">{versions.map(version => <article key={version.id} className="card flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-3"><span className="rounded bg-purple/10 px-2 py-1 text-xs font-bold text-purple">v{version.version_number}</span><h3 className="font-bold text-ink">{one(version.workspace_docs)?.title || 'Workspace document'}</h3>{version.restore_of_version_id && <span className="text-xs text-muted">restored revision</span>}</div><p className="mt-2 flex items-center gap-2 text-sm text-muted"><Clock size={15} />{new Date(version.created_at).toLocaleString('en-UG')} · {one(version.profiles)?.full_name || 'Team member'} · <span className="capitalize">{version.status}</span></p></div><button onClick={() => restore(version)} className="btn-secondary"><RotateCcw size={16} />Restore</button></article>)}{!versions.length && <div className="card py-14 text-center"><Archive className="mx-auto mb-3 text-purple/30" size={36} /><p className="font-semibold text-ink">No saved versions yet</p><p className="mt-1 text-sm text-muted">Every future Workspace save will create a revision here.</p></div>}</div>
  </div>
}
