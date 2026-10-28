const allowedTypes = new Set(['comment', 'assignment', 'upload', 'test'])

function safePayload(value) {
  if (!value || typeof value !== 'object') return null
  const keys = Object.keys(value)
  if (keys.length !== 3 || keys.some((key) => !['type', 'id', 'url'].includes(key))) return null
  if (!allowedTypes.has(value.type) || typeof value.id !== 'string' || !value.id) return null
  if (typeof value.url !== 'string' || !value.url.startsWith('/dashboard/') || value.url.startsWith('//')) return null
  const target = new URL(value.url, self.location.origin)
  if (target.origin !== self.location.origin) return null
  return { type: value.type, id: value.id, url: target.pathname + target.search + target.hash }
}

function bodyFor(type) {
  if (type === 'comment') return 'New comment on a document you follow'
  if (type === 'assignment') return 'A task has been assigned to you'
  if (type === 'upload') return 'A new document has been uploaded'
  return 'Your notifications are working'
}

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = safePayload(event.data?.json())
  } catch {
    payload = null
  }
  if (!payload) return
  event.waitUntil(self.registration.showNotification('NK Udada Staff Hub', {
    body: bodyFor(payload.type),
    icon: '/logo.jpeg',
    badge: '/icons/notification-badge.png',
    tag: `nk-${payload.type}-${payload.id}`,
    data: { url: payload.url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = safePayload({
    type: 'test',
    id: 'click',
    url: event.notification.data?.url,
  })
  if (!target) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      await client.navigate(target.url)
      return client.focus()
    }
    return self.clients.openWindow(target.url)
  })())
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' })
    if (!keyResponse.ok) return
    const { publicKey } = await keyResponse.json()
    if (!publicKey) return
    const padding = '='.repeat((4 - (publicKey.length % 4)) % 4)
    const raw = atob((publicKey + padding).replace(/-/g, '+').replace(/_/g, '/'))
    const applicationServerKey = Uint8Array.from(raw, (character) => character.charCodeAt(0))
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
    const platform = /Android/i.test(self.navigator.userAgent) ? 'Android' : 'Other'
    const response = await fetch('/api/push/subscriptions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...subscription.toJSON(),
        platform,
        deviceLabel: `${platform} Browser`,
      }),
    })
    if (!response.ok) await subscription.unsubscribe()
  })())
})
