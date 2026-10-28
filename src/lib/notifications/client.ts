export type PushDevice = {
  id: string
  device_label: string
  platform: string
  created_at: string
  last_seen_at: string
}

export type NotificationSettings = {
  comments_enabled: boolean
  assignments_enabled: boolean
  uploads_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_start: string
  quiet_end: string
  timezone: string
  banner_snoozed_until: string | null
}

export const defaultNotificationSettings = (role: string): NotificationSettings => ({
  comments_enabled: true,
  assignments_enabled: true,
  uploads_enabled: ['admin', 'manager', 'dpo'].includes(role),
  quiet_hours_enabled: true,
  quiet_start: '21:00',
  quiet_end: '07:00',
  timezone: 'Africa/Kampala',
  banner_snoozed_until: null,
})

export async function loadOrCreateNotificationSettings(
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  userId: string,
  role: string,
) {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('Unable to load notification settings.')
  if (data) return data as NotificationSettings

  const defaults = defaultNotificationSettings(role)
  const { data: inserted, error: insertError } = await supabase
    .from('notification_settings')
    .upsert({ user_id: userId, ...defaults }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (insertError || !inserted) throw new Error('Unable to save default notification settings.')
  return inserted as NotificationSettings
}

export function pushCapabilities() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, iosHomeScreenRequired: false }
  }
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.platform)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean }
  const isStandalone = standaloneNavigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
  return {
    supported: 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window,
    iosHomeScreenRequired: isAppleMobile && !isStandalone,
  }
}

function base64UrlToBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function deviceDetails() {
  const userAgent = navigator.userAgent
  const platform = /Android/i.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? 'iOS'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Macintosh|Mac OS/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Other'
  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /Firefox\//i.test(userAgent)
      ? 'Firefox'
      : /SamsungBrowser\//i.test(userAgent)
        ? 'Samsung Internet'
        : /Chrome\//i.test(userAgent)
          ? 'Chrome'
          : /Safari\//i.test(userAgent)
            ? 'Safari'
            : 'Browser'
  return { platform, deviceLabel: `${platform} ${browser}`.slice(0, 80) }
}

export async function registerNotificationServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('This browser cannot register notification support.')
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  return registration
}

export async function savePushSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...subscription.toJSON(),
      ...deviceDetails(),
    }),
  })
  const payload = await response.json() as { id?: string; error?: string }
  if (!response.ok || !payload.id) {
    throw new Error(payload.error || 'Unable to save this device subscription.')
  }
  return payload.id
}

export async function enablePushNotifications() {
  const capability = pushCapabilities()
  if (!capability.supported) throw new Error('Push notifications are not available in this browser.')
  if (capability.iosHomeScreenRequired) {
    throw new Error('Add NK Udada Staff Hub to your Home Screen, then open it there to enable notifications.')
  }

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked. Allow them in your browser or device settings, then try again.')
  }

  const registration = await registerNotificationServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' })
    const keyPayload = await keyResponse.json() as { publicKey?: string; error?: string }
    if (!keyResponse.ok || !keyPayload.publicKey) {
      throw new Error(keyPayload.error || 'Push notifications are not configured.')
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(keyPayload.publicKey),
    })
  }
  const id = await savePushSubscription(subscription)
  return { id, permission }
}

export async function removePushSubscription(id?: string, unsubscribeCurrent = false) {
  const registration = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistration('/')
    : undefined
  const subscription = await registration?.pushManager.getSubscription()
  const response = await fetch('/api/push/subscriptions', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { id } : subscription ? { endpoint: subscription.endpoint } : {}),
  })
  const payload = await response.json() as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Unable to remove this device.')
  if (unsubscribeCurrent) await subscription?.unsubscribe()
}

export async function clearPushSubscriptionBeforeSignOut() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  let deleteError: Error | null = null
  try {
    const response = await fetch('/api/push/subscriptions', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    if (!response.ok) deleteError = new Error('The device subscription could not be removed from your account.')
  } catch {
    deleteError = new Error('The device subscription could not be removed from your account.')
  }
  const unsubscribed = await subscription.unsubscribe()
  if (!unsubscribed) deleteError = new Error('This browser did not confirm that notifications were switched off.')
  if (deleteError) throw deleteError
}
