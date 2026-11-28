'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AccessRequest = {
  id: string
  access_code: string
  document_id: string
  requester_id: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  reviewed_at: string | null
  document: { name: string } | null
  requester: { full_name: string } | null
}

export default function DocumentAccessRequests() {
  const supabase = useMemo(() => createClient(), [])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRequests = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('document_access_requests')
      .select('id,access_code,document_id,requester_id,reason,status,created_at,reviewed_at,document:documents!document_access_requests_document_id_fkey(name),requester:profiles!document_access_requests_requester_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (queryError) {
      console.error('Document access requests could not be loaded:', queryError)
      setError('Access requests could not be loaded. Refresh and try again.')
      setLoading(false)
      return
    }

    const normalized = (data || []).map(request => ({
      ...request,
      document: Array.isArray(request.document) ? request.document[0] || null : request.document,
      requester: Array.isArray(request.requester) ? request.requester[0] || null : request.requester,
    }))
    setRequests(normalized as AccessRequest[])
    setError('')
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // Load the admin review queue once the section mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests()
    const channel = supabase
      .channel('document-access-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_access_requests' }, () => {
        void loadRequests()
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [loadRequests, supabase])

  async function reviewRequest(request: AccessRequest, approve: boolean) {
    setReviewingId(request.id)
    setError('')
    setNotice('')
    const { error: reviewError } = await supabase.rpc('review_document_access_request', {
      p_request_id: request.id,
      p_approve: approve,
    })

    if (reviewError) {
      console.error('Document access request review failed:', reviewError)
      setError(reviewError.message || 'The access request could not be reviewed.')
      setReviewingId(null)
      return
    }

    setNotice(approve
      ? `Access granted to ${request.requester?.full_name || 'the requester'} for "${request.document?.name || 'the document'}".`
      : `Request ${request.access_code} was denied.`)
    await loadRequests()
    setReviewingId(null)
  }

  const pendingCount = requests.filter(request => request.status === 'pending').length

  return <section aria-labelledby="document-access-requests-title" className="card mb-6 p-4 sm:p-6">
    <div className="flex items-start gap-3">
      <ShieldCheck size={21} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 id="document-access-requests-title" className="font-semibold text-text">
          Document access requests{pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted">Review requests from chat recipients. The request code is visible to every administrator.</p>
      </div>
    </div>

    {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p>}
    {loading
      ? <p className="mt-4 flex items-center gap-2 text-sm text-muted"><LoaderCircle size={15} className="animate-spin" />Loading requests…</p>
      : requests.length === 0
        ? <p className="mt-4 text-sm text-muted">No document access requests yet.</p>
        : <ul className="mt-4 divide-y divide-border">
          {requests.map(request => <li key={request.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-text">{request.document?.name || 'Unavailable document'}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${request.status === 'pending' ? 'bg-warning/10 text-warning' : request.status === 'approved' ? 'bg-success/10 text-success' : 'bg-surface-muted text-muted'}`}>
                    {request.status}
                  </span>
                  <code className="rounded bg-surface-muted px-2 py-0.5 text-xs font-bold tracking-wider text-text">{request.access_code}</code>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Requested by {request.requester?.full_name || 'Unknown user'} · {new Date(request.created_at).toLocaleString()}
                </p>
                <p className="mt-1 break-words text-sm text-text">{request.reason}</p>
              </div>
              {request.status === 'pending' && <div className="flex shrink-0 gap-2">
                <button type="button" disabled={reviewingId !== null} onClick={() => void reviewRequest(request, true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-success/10 px-3 text-sm font-semibold text-success hover:bg-success/15 disabled:opacity-60">
                  {reviewingId === request.id ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}Approve
                </button>
                <button type="button" disabled={reviewingId !== null} onClick={() => void reviewRequest(request, false)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-danger/10 px-3 text-sm font-semibold text-danger hover:bg-danger/15 disabled:opacity-60">
                  <X size={15} />Deny
                </button>
              </div>}
            </div>
          </li>)}
        </ul>}
  </section>
}
