'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkResults, saveRecord, softDelete, uploadRestrictedDocument, useME } from '@/lib/me/client'
import type { Evidence } from '@/lib/me/types'
import { Field, Empty, fieldClass } from './MEFrame'

export default function EvidencePanel({ target }: { target: { program_id?: string; finding_id?: string; risk_id?: string } }) {
  const key = target.program_id ? 'program_id' : target.finding_id ? 'finding_id' : 'risk_id'
  const id = target[key]!
  const query = useCallback(async (client: SupabaseClient) => {
    const [links, documents] = await Promise.all([
      client.from('evidence_links').select('*,documents(id,name)').eq(key, id).is('deleted_at', null).order('created_at', { ascending: false }),
      client.from('documents').select('id,name,visibility').is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    checkResults(links, documents)
    return { links: links.data as unknown as Evidence[], documents: documents.data! }
  }, [key, id])
  const me = useME(query)
  const [documentId, setDocumentId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [inputVersion, setInputVersion] = useState(0)
  const attach = (event: React.FormEvent) => {
    event.preventDefault()
    void me.run(async () => {
      let linkedId = documentId
      if (file) {
        linkedId = await uploadRestrictedDocument(me.supabase, me.profile!.id, file)
        // Preserve the document choice if linking fails so retry does not upload twice.
        setDocumentId(linkedId); setFile(null); setInputVersion(v => v + 1)
      }
      if (!linkedId) throw new Error('Choose a document or upload a file.')
      await saveRecord(me.supabase, 'evidence_links', me.profile!.id, { document_id: linkedId, [key]: id })
      setDocumentId('')
    }, 'Evidence attached.')
  }
  return <div className="mt-4">
    {me.error && <p role="alert" className="mb-3 text-rust">{me.error}</p>}{me.message && <p role="status" className="mb-3 text-purple">{me.message}</p>}
    <p className="mb-4 text-sm text-muted">New evidence uploads are restricted to administrators and board advisors. Linking an existing document keeps that document’s current visibility.</p>
    <form onSubmit={attach}><fieldset disabled={me.busy || me.loading} className="grid gap-4 md:grid-cols-2">
      <Field label="Existing document"><select className={fieldClass} value={documentId} disabled={!!file} onChange={e => setDocumentId(e.target.value)}><option value="">Choose a document</option>{me.data?.documents.map(d => <option key={d.id} value={d.id}>{d.name} ({d.visibility})</option>)}</select></Field>
      <Field label="Or upload new evidence"><input key={inputVersion} type="file" className={fieldClass} onChange={e => { setFile(e.target.files?.[0] || null); setDocumentId('') }} /></Field>
      <button className="btn-primary w-fit" disabled={!file && !documentId}>{me.busy ? 'Attaching…' : 'Attach evidence'}</button>
    </fieldset></form>
    <ul className="mt-5 divide-y divide-purple/10">{me.data?.links.map(link => <li key={link.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><Link className="text-purple underline" href={`/dashboard/me/documents/${link.document_id}`}>{link.documents?.name || 'Document unavailable'}</Link><button disabled={me.busy} className="text-rust underline" onClick={() => { if (confirm('Remove this evidence link? The document will be retained.')) void me.run(() => softDelete(me.supabase, 'evidence_links', link.id, me.profile!.id), 'Evidence link removed.') }}>Remove link</button></li>)}</ul>
    {!me.loading && !me.data?.links.length && <Empty>No evidence attached.</Empty>}
  </div>
}
