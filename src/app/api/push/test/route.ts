import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendPushPayload } from '@/lib/notifications/push-server'
import { createNotificationAdminClient } from '@/lib/notifications/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const admin = createNotificationAdminClient()
    const { data: subscriptions, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, failure_count')
      .eq('user_id', user.id)
    if (error) throw new Error('Unable to load device subscriptions')
    if (!subscriptions?.length) {
      return Response.json({ error: 'Turn on notifications on this device first.' }, { status: 400 })
    }

    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await sendPushPayload({
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        }, {
          type: 'test',
          id: crypto.randomUUID(),
          url: '/dashboard/settings?tab=notifications',
        })
      } catch (cause) {
        const statusCode = typeof cause === 'object' && cause !== null && 'statusCode' in cause
          ? Number(cause.statusCode)
          : 0
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await admin.from('push_subscriptions').delete().eq('id', subscription.id)
          if (deleteError) throw new Error('Unable to remove expired device subscription')
          return false
        }
        throw cause
      }
      const { error: updateError } = await admin.from('push_subscriptions')
        .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
        .eq('id', subscription.id)
      if (updateError) throw new Error('Unable to update device delivery state')
      return true
    }))
    const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length
    if (sent === 0) {
      return Response.json({ error: 'The test notification could not be delivered. Check this device and try again.' }, { status: 502 })
    }
    return Response.json({ sent })
  } catch {
    return Response.json({ error: 'The test notification could not be sent.' }, { status: 503 })
  }
}
