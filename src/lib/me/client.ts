'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { volunteerContributor } from '@/lib/creator'
import { canUseME, type Profile } from './types'

export function useME<T>(query: (client: SupabaseClient) => Promise<T>) {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<T | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Please sign in again.')
      const result = await supabase.from('profiles').select('id,full_name,role').eq('id', user.id).single()
      if (result.error) throw result.error
      setRole(result.data.role)
      if (!canUseME(result.data.role)) { setData(null); throw new Error('M&E access is restricted to administrators and board advisors.') }
      setProfile(result.data)
      setData(await query(supabase))
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }, [supabase, query])
  useEffect(() => {
    // Remote hydration follows the existing Hub page pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  const run = async (action: () => Promise<void>, success = 'Saved.') => {
    if (busy || !canUseME(role)) return
    setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success); await load() }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return { supabase, data, profile, role, loading, busy, error, message, run, load }
}

export function errorMessage(cause: unknown) {
  return cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'Unable to complete this operation.'
}
export function checkResults(...results: { error: { message: string } | null }[]) {
  const failed = results.find(result => result.error)
  if (failed?.error) throw new Error(failed.error.message)
}
export async function saveRecord(client: SupabaseClient, table: string, actor: string, values: Record<string, unknown>, id?: string) {
  const result = id
    ? await client.from(table).update(values).eq('id', id).is('deleted_at', null).select('id').single()
    : await client.from(table).insert({ ...values, created_by: actor }).select('id').single()
  checkResults(result)
  await logActivity(id ? 'update' : 'create', table, result.data!.id, {}, { client, actorId: actor })
  return result.data!.id as string
}
export async function softDelete(client: SupabaseClient, table: string, id: string, actor: string) {
  const result = await client.from(table).update({ deleted_at: new Date().toISOString(), deleted_by: actor }).eq('id', id).is('deleted_at', null).select('id').single()
  checkResults(result)
  await logActivity('delete', table, id, { soft_delete: true }, { client, actorId: actor })
}
export async function uploadRestrictedDocument(client: SupabaseClient, actor: string, file: File, category = 'general') {
  if (file.size > 50 * 1024 * 1024) throw new Error('File too large. Maximum 50MB.')
  const id = crypto.randomUUID()
  const path = `${actor}/me/${id}/${file.name.replace(/[^a-z0-9.\-_]/gi, '_')}`
  checkResults(await client.storage.from('documents').upload(path, file))
  const result = await client.from('documents').insert({
    id, name: file.name, file_path: path, file_size: file.size,
    mime_type: file.type || 'application/octet-stream', category,
    uploaded_by: actor, visibility: 'restricted', ...volunteerContributor(),
  }).select('id').single()
  // An upload with no document row is unreadable under Storage RLS. Never
  // loosen access or fall back to a standard document when persistence fails.
  if (result.error) throw new Error(`File uploaded but its document record failed: ${result.error.message}. Unlinked object: ${path}`)
  await logActivity('document.upload', 'document', id, { visibility: 'restricted', category }, { client, actorId: actor })
  return id
}
