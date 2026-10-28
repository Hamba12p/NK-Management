import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWithinQuietHours,
  nextQuietHoursEnd,
  type NotificationPayload,
  type NotificationType,
} from '@/lib/notifications/policy'
import { vapidConfiguration } from '@/lib/notifications/server'
import { internAccessIsActive } from '@/lib/intern-access'

type PushRecord = {
  id: string
  recipient_id: string
  type: Exclude<NotificationType, 'test'>
  entity_id: string
  url: string
  push_attempts: number
}

type PushSubscriptionRecord = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  failure_count: number
}

export async function sendPushPayload(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: NotificationPayload,
) {
  const vapid = vapidConfiguration()
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    { TTL: 86400, urgency: 'normal' },
  )
}

async function updateNotification(
  admin: SupabaseClient,
  id: string,
  updates: Record<string, unknown>,
) {
  const { error } = await admin.from('notifications').update(updates).eq('id', id)
  if (error) throw new Error('Unable to update push delivery state')
}

export async function dispatchPushNotification(admin: SupabaseClient, notification: PushRecord) {
  const now = new Date()
  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    admin.from('profiles').select('role, access_starts_on, access_expires_at, intern_access_enabled').eq('id', notification.recipient_id).maybeSingle(),
    admin.from('notification_settings').select('comments_enabled, assignments_enabled, uploads_enabled, quiet_hours_enabled, quiet_start, quiet_end, timezone').eq('user_id', notification.recipient_id).maybeSingle(),
  ])
  if (profileError || settingsError) {
    throw new Error('Unable to load recipient notification settings')
  }
  const inactiveIntern = profile?.role === 'intern'
    && !internAccessIsActive(
      profile.intern_access_enabled,
      profile.access_starts_on,
      profile.access_expires_at,
      now,
    )
  if (!profile || inactiveIntern) {
    if (profile) {
      const { error } = await admin.from('push_subscriptions').delete().eq('user_id', notification.recipient_id)
      if (error) throw new Error('Unable to remove expired intern device subscriptions')
    }
    await updateNotification(admin, notification.id, { push_delivered_at: now.toISOString() })
    return 'inactive'
  }

  const { data: account, error: accountError } = await admin.auth.admin.getUserById(notification.recipient_id)
  if (accountError && accountError.status !== 404) throw new Error('Unable to verify the notification recipient')
  const bannedUntil = account.user?.banned_until
  if (!account.user || (bannedUntil && Date.parse(bannedUntil) > now.getTime())) {
    await updateNotification(admin, notification.id, { push_delivered_at: now.toISOString() })
    return 'inactive'
  }

  const categoryEnabled = notification.type === 'comment'
    ? settings?.comments_enabled ?? true
    : notification.type === 'assignment'
      ? settings?.assignments_enabled ?? true
      : settings?.uploads_enabled ?? ['admin', 'manager', 'dpo'].includes(profile.role)
  if (!categoryEnabled) {
    await updateNotification(admin, notification.id, { push_delivered_at: now.toISOString() })
    return 'disabled'
  }

  if (settings?.quiet_hours_enabled && isWithinQuietHours(
    now,
    settings.quiet_start || '21:00',
    settings.quiet_end || '07:00',
    settings.timezone || 'Africa/Kampala',
  )) {
    const nextAttempt = nextQuietHoursEnd(
      now,
      settings.quiet_start || '21:00',
      settings.quiet_end || '07:00',
      settings.timezone || 'Africa/Kampala',
    )
    await updateNotification(admin, notification.id, { push_next_attempt_at: nextAttempt.toISOString() })
    return 'quiet'
  }

  const claimUntil = new Date(now.getTime() + 5 * 60_000).toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('notifications')
    .update({
      push_next_attempt_at: claimUntil,
      push_attempts: notification.push_attempts + 1,
    })
    .eq('id', notification.id)
    .is('push_delivered_at', null)
    .lte('push_next_attempt_at', now.toISOString())
    .select('id')
    .maybeSingle()
  if (claimError) throw new Error('Unable to claim push delivery')
  if (!claimed) return 'already-claimed'

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count')
    .eq('user_id', notification.recipient_id)
  if (subscriptionError) throw new Error('Unable to load device subscriptions')
  if (!subscriptions?.length) {
    await updateNotification(admin, notification.id, { push_delivered_at: new Date().toISOString() })
    return 'no-devices'
  }

  const payload: NotificationPayload = {
    type: notification.type,
    id: notification.id,
    url: notification.url,
  }
  let transientFailure = false
  for (const subscription of subscriptions as PushSubscriptionRecord[]) {
    try {
      await sendPushPayload(subscription, payload)
      const { error } = await admin.from('push_subscriptions')
        .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
        .eq('id', subscription.id)
      if (error) throw new Error('Unable to update device delivery state')
    } catch (cause) {
      const statusCode = typeof cause === 'object' && cause !== null && 'statusCode' in cause
        ? Number(cause.statusCode)
        : 0
      if (statusCode === 404 || statusCode === 410) {
        const { error } = await admin.from('push_subscriptions').delete().eq('id', subscription.id)
        if (error) throw new Error('Unable to remove expired device subscription')
        continue
      }
      transientFailure = true
      const failures = subscription.failure_count + 1
      if (failures >= 3) {
        const { error } = await admin.from('push_subscriptions').delete().eq('id', subscription.id)
        if (error) throw new Error('Unable to remove repeatedly failing device subscription')
      } else {
        const { error } = await admin.from('push_subscriptions')
          .update({ failure_count: failures })
          .eq('id', subscription.id)
        if (error) throw new Error('Unable to record device delivery failure')
      }
    }
  }

  if (transientFailure && notification.push_attempts + 1 < 3) {
    const retryAt = new Date()
    retryAt.setUTCHours(4, 0, 0, 0)
    if (retryAt.getTime() <= Date.now()) retryAt.setUTCDate(retryAt.getUTCDate() + 1)
    await updateNotification(admin, notification.id, {
      push_next_attempt_at: retryAt.toISOString(),
    })
    return 'retry'
  }
  await updateNotification(admin, notification.id, { push_delivered_at: new Date().toISOString() })
  return transientFailure ? 'attempt-limit' : 'sent'
}
