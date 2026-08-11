import type { SupabaseClient } from '@supabase/supabase-js'

export type DeletableContent =
  | 'document'
  | 'announcement'
  | 'meeting'
  | 'agenda_item'
  | 'workspace_document'
  | 'workspace_comment'
  | 'task'
  | 'processing_activity'

/**
 * Performs the database-owned soft deletion. The RPC snapshots the source,
 * writes an immutable audit entry, and notifies every administrator before
 * hiding the content from normal staff views.
 */
export async function archiveAndDeleteContent(
  supabase: SupabaseClient,
  resourceType: DeletableContent,
  resourceId: string,
) {
  const { data, error } = await supabase.rpc('archive_owned_content', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  })

  if (error) throw error
  return data as string
}
