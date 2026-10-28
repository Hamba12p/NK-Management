import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createNotificationAdminClient } from '@/lib/notifications/server'
import { isTrustedPushEndpoint } from '@/lib/notifications/policy'

export const runtime = 'nodejs'

type SubscriptionBody = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
  deviceLabel?: unknown
  platform?: unknown
  id?: unknown
}

function isSubscriptionBody(value: unknown): value is SubscriptionBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function currentUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export async function GET() {
  const { user, error: authError } = await currentUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const admin = createNotificationAdminClient()
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('id, device_label, platform, created_at, last_seen_at')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false })
    if (error) throw new Error('Unable to load registered devices')
    return Response.json({ devices: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Unable to load registered devices' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const { user, error: authError } = await currentUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  let body: SubscriptionBody
  try {
    const parsed: unknown = await request.json()
    if (!isSubscriptionBody(parsed)) return Response.json({ error: 'Invalid subscription details' }, { status: 400 })
    body = parsed
  } catch {
    return Response.json({ error: 'Invalid subscription details' }, { status: 400 })
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  const deviceLabel = typeof body.deviceLabel === 'string' ? body.deviceLabel.trim().slice(0, 80) : ''
  const platform = typeof body.platform === 'string' ? body.platform.trim().slice(0, 80) : ''
  if (
    endpoint.length > 2048
    || !isTrustedPushEndpoint(endpoint)
    || !/^[A-Za-z0-9_-]{20,256}$/.test(p256dh)
    || !/^[A-Za-z0-9_-]{16,256}$/.test(auth)
    || !deviceLabel
    || !platform
  ) {
    return Response.json({ error: 'Incomplete subscription details' }, { status: 400 })
  }

  try {
    const admin = createNotificationAdminClient()
    const { data, error } = await admin
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        device_label: deviceLabel,
        platform,
        last_seen_at: new Date().toISOString(),
        failure_count: 0,
      }, { onConflict: 'endpoint' })
      .select('id')
      .single()
    if (error || !data) throw new Error('Unable to save device subscription')
    return Response.json({ id: data.id }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Unable to save device subscription' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  const { user, error: authError } = await currentUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  let body: SubscriptionBody
  try {
    const parsed: unknown = await request.json()
    if (!isSubscriptionBody(parsed)) return Response.json({ error: 'Invalid device selection' }, { status: 400 })
    body = parsed
  } catch {
    return Response.json({ error: 'Invalid device selection' }, { status: 400 })
  }
  if (typeof body.id !== 'string' && typeof body.endpoint !== 'string') {
    return Response.json({ error: 'Choose a registered device to remove' }, { status: 400 })
  }

  try {
    const admin = createNotificationAdminClient()
    let query = admin.from('push_subscriptions').delete().eq('user_id', user.id)
    query = typeof body.id === 'string' ? query.eq('id', body.id) : query.eq('endpoint', body.endpoint as string)
    const { error } = await query
    if (error) throw new Error('Unable to remove device subscription')
    return Response.json({ removed: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Unable to remove device subscription' }, { status: 503 })
  }
}
