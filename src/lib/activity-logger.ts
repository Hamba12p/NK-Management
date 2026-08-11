import { createClient } from '@/lib/supabase/client'
import { activityDetailsForUser } from '@/lib/activity'

export type ActivityType = string

/** Legacy-friendly logger using the canonical Phase 6 activity_log columns. */
export async function logActivity(
  userId: string,
  actionType: ActivityType,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown> = {},
) {
  const supabase = createClient()
  const { error } = await supabase.from('activity_log').insert({
    user_id: userId,
    action_type: actionType,
    resource_type: resourceType,
    resource_id: resourceId,
    details: await activityDetailsForUser(supabase, details),
  })
  if (error) console.error('Failed to log activity:', error)
  return !error
}

export const logDocumentUpload = (userId: string, documentId: string, fileName: string, sizeBytes: number) => logActivity(userId, 'document_upload', 'document', documentId, { fileName, sizeBytes })
export const logDocumentDownload = (userId: string, documentId: string, fileName: string) => logActivity(userId, 'document_download', 'document', documentId, { fileName })
export const logMeetingCreate = (userId: string, meetingId: string, title: string) => logActivity(userId, 'meeting_create', 'meeting', meetingId, { title })
export const logAnnouncementPost = (userId: string, announcementId: string, title: string) => logActivity(userId, 'announcement_post', 'announcement', announcementId, { title })
export const logLogin = (userId: string) => logActivity(userId, 'login', 'auth', null, { method: 'password' })
export const logLogout = (userId: string) => logActivity(userId, 'logout', 'auth', null)
