import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { SHARED_VOLUNTEER_EMAIL } from '@/lib/auth-identities'

type LogActivityOptions = { client?: SupabaseClient; actorId?: string }

function volunteerNameFromCookie() {
  if (typeof document === 'undefined') return undefined
  const value = document.cookie.split('; ').find((item) => item.startsWith('nk_volunteer_name='))?.split('=').slice(1).join('=')
  return value ? decodeURIComponent(value).trim().slice(0, 100) : undefined
}

export async function activityDetailsForUser(
  supabase: SupabaseClient,
  details: Record<string, unknown> = {},
  user?: User | null,
) {
  const authenticatedUser = user ?? (await supabase.auth.getUser()).data.user
  if (authenticatedUser?.email?.toLowerCase() !== SHARED_VOLUNTEER_EMAIL) return details
  const volunteerName = volunteerNameFromCookie()
  return volunteerName ? { ...details, volunteer_name: volunteerName } : details
}

export async function insertActivityRecord(
  supabase: SupabaseClient,
  record: { userId: string; action: string; resourceType: string; resourceId?: string; details: Record<string, unknown> },
) {
  return supabase.from('activity_log').insert({
    user_id: record.userId,
    action_type: record.action,
    resource_type: record.resourceType,
    resource_id: record.resourceId ?? null,
    details: record.details,
  })
}

/** Write an append-only audit entry. Logging never interrupts the action it describes. */
export async function logActivity(
  action: string,
  resourceType = 'system',
  resourceId?: string,
  details?: Record<string, unknown>,
  options?: LogActivityOptions,
) {
  const supabase = options?.client ?? createBrowserClient()
  let actorId = options?.actorId
  let user: User | null = null
  if (!actorId || !options?.client) {
    const result = await supabase.auth.getUser()
    user = result.data.user
    actorId ??= user?.id
  }
  if (!actorId) return

  const { error } = await insertActivityRecord(supabase, {
    userId: actorId,
    action,
    resourceType,
    resourceId,
    details: await activityDetailsForUser(supabase, details, user),
  })
  if (error) {
    console.error('[activity] failed to log', action, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
  }
}
