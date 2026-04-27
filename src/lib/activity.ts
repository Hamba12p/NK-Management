import { createClient } from '@/lib/supabase/client'

type Action =
  | 'document.upload' | 'document.delete'
  | 'meeting.create' | 'meeting.update' | 'meeting.cancel'
  | 'announcement.create' | 'announcement.delete'
  | 'user.login' | 'user.logout'

export async function logActivity(
  action: Action,
  targetType?: string,
  targetId?: string,
  meta?: Record<string, unknown>
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return  // not logged in, skip

  // Fire and forget — don't let logging failure break the user action
  supabase.from('activity_log').insert({
    actor_id:    user.id,
    action,
    target_type: targetType,
    target_id:   targetId,
    meta:        meta ?? {},
  }).then()
}
