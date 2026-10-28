import { createNotificationAdminClient } from '@/lib/notifications/server'
import { dispatchPushNotification } from '@/lib/notifications/push-server'
import { matchesSharedSecret } from '@/lib/notifications/secrets'

export const runtime = 'nodejs'

type WebhookBody = { record?: { id?: unknown } }

async function dispatchOne(id: string) {
  const admin = createNotificationAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .select('id, recipient_id, type, entity_id, url, push_attempts')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Unable to load notification for dispatch')
  if (!data) return 'not-found'
  return dispatchPushNotification(admin, data)
}

export async function POST(request: Request) {
  if (!matchesSharedSecret(request.headers.get('x-push-dispatch-secret'), process.env.PUSH_DISPATCH_SECRET)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await request.json() as WebhookBody
  } catch {
    return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }
  const id = typeof body.record?.id === 'string' ? body.record.id : ''
  if (!id) return Response.json({ error: 'Notification identifier is required' }, { status: 400 })

  try {
    const result = await dispatchOne(id)
    return Response.json({ accepted: true, result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Push dispatch could not be completed' }, { status: 503 })
  }
}

export async function GET(request: Request) {
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
  if (!matchesSharedSecret(provided, process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const admin = createNotificationAdminClient()
    const { data, error } = await admin
      .from('notifications')
      .select('id, recipient_id, type, entity_id, url, push_attempts')
      .is('push_delivered_at', null)
      .lte('push_next_attempt_at', new Date().toISOString())
      .order('push_next_attempt_at')
      .limit(500)
    if (error) throw new Error('Unable to load pending push deliveries')

    const results = await Promise.allSettled((data || []).map((notification) =>
      dispatchPushNotification(admin, notification),
    ))
    const failures = results.filter((result) => result.status === 'rejected').length
    return Response.json({
      processed: results.length,
      failures,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Pending push dispatch could not be completed' }, { status: 503 })
  }
}
