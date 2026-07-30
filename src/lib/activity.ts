import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

type Action =
  | 'document.upload' | 'document.delete'
  | 'meeting.create' | 'meeting.update' | 'meeting.cancel'
  | 'announcement.create' | 'announcement.delete'
  | 'user.login' | 'user.logout'

type LogActivityOptions = {
  /** Pass a server-side Supabase client when calling from a route handler or
   *  server action (e.g. /auth/callback), where the browser client isn't available. */
  client?: SupabaseClient
  /** Pass the actor id directly when it's already known server-side, to skip
   *  an extra getUser() round trip. */
  actorId?: string
}

/**
 * Writes an entry to the append-only activity_log audit table.
 * Fire-and-forget by design: a logging failure must never block the user's
 * actual action (upload, meeting creation, etc.), so errors are only logged
 * to the console, not thrown.
 */
export async function logActivity(
  action: Action,
  targetType?: string,
  targetId?: string,
  meta?: Record<string, unknown>,
  options?: LogActivityOptions
) {
  const supabase = options?.client ?? createBrowserClient()

  let actorId = options?.actorId
  if (!actorId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return // not logged in, skip
    actorId = user.id
  }

  const { error } = await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta: meta ?? {},
  })

  if (error) {
    console.error('[activity] failed to log', action, error)
  }
}
