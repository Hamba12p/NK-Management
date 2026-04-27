/**
 * Activity Logger
 * 
 * Centralized logging for all user actions. This creates audit trail entries
 * that are append-only (can never be deleted) for compliance and security.
 * 
 * Use this function whenever a significant action occurs:
 * - User login/logout
 * - Document upload/download/delete
 * - Meeting created/updated/deleted
 * - Agenda item modified
 * - Announcement posted/pinned/deleted
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Valid activity types in the system
 */
export type ActivityType =
  | 'login'
  | 'logout'
  | 'document_upload'
  | 'document_download'
  | 'document_delete'
  | 'meeting_create'
  | 'meeting_update'
  | 'meeting_delete'
  | 'agenda_item_add'
  | 'agenda_item_update'
  | 'agenda_item_delete'
  | 'announcement_post'
  | 'announcement_pin'
  | 'announcement_unpin'
  | 'announcement_delete'
  | 'user_invite'
  | 'user_role_change'
  | 'settings_update';

/**
 * Log an activity to the audit trail
 * 
 * @param userId - The UUID of the user performing the action
 * @param actionType - Type of action (see ActivityType)
 * @param resourceType - What was affected (document, meeting, announcement, etc.)
 * @param resourceId - UUID of the affected resource
 * @param details - Additional context as JSON object
 * @param ipAddress - (Optional) IP address of the request
 * 
 * @example
 * ```typescript
 * // When user uploads a document
 * await logActivity(
 *   user.id,
 *   'document_upload',
 *   'document',
 *   docId,
 *   { fileName: 'report.pdf', sizeBytes: 1024000 }
 * );
 * ```
 */
export async function logActivity(
  userId: string,
  actionType: ActivityType,
  resourceType: string,
  resourceId: string | null,
  details?: Record<string, unknown>,
  ipAddress?: string
) {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert([
        {
          user_id: userId,
          action_type: actionType,
          resource_type: resourceType,
          resource_id: resourceId,
          details: details || {},
          ip_address: ipAddress || null,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - logging shouldn't break the app
      return false;
    }

    return true;
  } catch (err) {
    console.error('Activity logging error:', err);
    return false;
  }
}

/**
 * Convenience functions for common logging scenarios
 */

export async function logDocumentUpload(
  userId: string,
  documentId: string,
  fileName: string,
  sizeBytes: number
) {
  return logActivity(
    userId,
    'document_upload',
    'document',
    documentId,
    { fileName, sizeBytes }
  );
}

export async function logDocumentDownload(
  userId: string,
  documentId: string,
  fileName: string
) {
  return logActivity(
    userId,
    'document_download',
    'document',
    documentId,
    { fileName }
  );
}

export async function logMeetingCreate(
  userId: string,
  meetingId: string,
  title: string
) {
  return logActivity(
    userId,
    'meeting_create',
    'meeting',
    meetingId,
    { title }
  );
}

export async function logAnnouncementPost(
  userId: string,
  announcementId: string,
  title: string
) {
  return logActivity(
    userId,
    'announcement_post',
    'announcement',
    announcementId,
    { title }
  );
}

export async function logLogin(userId: string, ipAddress?: string) {
  return logActivity(
    userId,
    'login',
    'auth',
    null,
    { method: 'magic_link' },
    ipAddress
  );
}

export async function logLogout(userId: string) {
  return logActivity(
    userId,
    'logout',
    'auth',
    null
  );
}
