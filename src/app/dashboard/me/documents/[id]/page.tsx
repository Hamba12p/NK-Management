'use client'

import { useCallback, useState, type ComponentProps } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import DocumentModal from '@/components/DocumentModal'
import MEFrame from '@/components/me/MEFrame'
import { checkResults, useME } from '@/lib/me/client'
import { logActivity } from '@/lib/activity'

type DocumentRecord = NonNullable<ComponentProps<typeof DocumentModal>['doc']>
export default function MEDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const query = useCallback(async (client: SupabaseClient) => {
    const result = await client.from('documents').select('*,profiles!documents_uploaded_by_fkey(full_name,display_tag,display_color)').eq('id', id).single()
    checkResults(result)
    return result.data as DocumentRecord
  }, [id])
  const me = useME(query)
  const [open, setOpen] = useState(true)
  const save = async (updates: Partial<DocumentRecord>) => {
    const result = await me.supabase.from('documents').update({ name: updates.name, description: updates.description, category: updates.category }).eq('id', id).select('id').single()
    checkResults(result)
    await logActivity('document.update', 'document', id, {}, { client: me.supabase, actorId: me.profile!.id })
    await me.load()
  }
  return <MEFrame title="Document preview" description="This file is stored in the existing document repository." {...me}>
    <div className="card flex flex-wrap gap-4"><button className="btn-primary" disabled={!me.data} onClick={() => setOpen(true)}>Preview document</button><Link className="text-purple underline" href="/dashboard/documents">Open document repository</Link></div>
    {open && me.data && <DocumentModal doc={me.data} onClose={() => setOpen(false)} onSave={save} />}
  </MEFrame>
}
