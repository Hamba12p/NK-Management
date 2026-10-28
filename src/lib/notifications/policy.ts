export type NotificationType = 'comment' | 'assignment' | 'upload' | 'test'

export type NotificationPayload = {
  type: NotificationType
  id: string
  url: string
}

export type NotificationSettings = {
  comments_enabled: boolean
  assignments_enabled: boolean
  uploads_enabled: boolean
}

export function selectCommentRecipients(
  ownerId: string,
  commenterId: string,
  previousCommenterIds: string[],
  roles: Record<string, string>,
) {
  return [...new Set([ownerId, ...previousCommenterIds])].filter((userId) =>
    userId !== commenterId && (roles[userId] !== 'intern' || userId === ownerId),
  )
}

export function canViewDocument(
  profile: { id: string; role: string },
  document: { visibility: string; assigned_to: string[] },
  uploaderId: string,
) {
  if (profile.role === 'intern') return false
  if (document.visibility === 'standard') {
    return document.assigned_to.length === 0
      || document.assigned_to.includes(profile.id)
      || profile.id === uploaderId
      || ['admin', 'board_advisor'].includes(profile.role)
  }
  if (document.visibility === 'restricted') {
    return document.assigned_to.includes(profile.id)
      || ['admin', 'board_advisor'].includes(profile.role)
  }
  return false
}

export function isCategoryEnabled(
  type: Exclude<NotificationType, 'test'>,
  settings: NotificationSettings | null,
  role: string,
) {
  if (type === 'comment') return settings?.comments_enabled ?? true
  if (type === 'assignment') return settings?.assignments_enabled ?? true
  return settings?.uploads_enabled ?? ['admin', 'manager', 'dpo'].includes(role)
}

export function isWithinQuietHours(
  date: Date,
  start: string,
  end: string,
  timezone: string,
) {
  if (start === end) return false
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  const current = hour * 60 + minute
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const startValue = startHour * 60 + startMinute
  const endValue = endHour * 60 + endMinute
  return startValue < endValue
    ? current >= startValue && current < endValue
    : current >= startValue || current < endValue
}

export function nextQuietHoursEnd(
  date: Date,
  start: string,
  end: string,
  timezone: string,
) {
  for (let minute = 1; minute <= 24 * 60; minute += 1) {
    const candidate = new Date(date.getTime() + minute * 60_000)
    if (!isWithinQuietHours(candidate, start, end, timezone)) return candidate
  }
  return date
}

export function notificationUrl(type: Exclude<NotificationType, 'test'>) {
  return type === 'upload' ? '/dashboard/documents' : '/dashboard/workspace'
}

export function isTrustedPushEndpoint(value: string) {
  if (value.length > 2048) return false
  let endpoint: URL
  try {
    endpoint = new URL(value)
  } catch {
    return false
  }
  const host = endpoint.hostname.toLowerCase()
  const trustedHost = host === 'fcm.googleapis.com'
    || host === 'updates.push.services.mozilla.com'
    || host === 'web.push.apple.com'
    || host.endsWith('.notify.windows.com')
  return endpoint.protocol === 'https:'
    && endpoint.port === ''
    && !endpoint.username
    && !endpoint.password
    && trustedHost
}

export function notificationCopy(type: NotificationType) {
  if (type === 'comment') return 'New comment on a document you follow'
  if (type === 'assignment') return 'A task has been assigned to you'
  if (type === 'upload') return 'A new document has been uploaded'
  return 'Your notifications are working'
}

export function isSafeNotificationPayload(value: unknown): value is NotificationPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<NotificationPayload>
  const keys = Object.keys(value)
  return keys.length === 3
    && keys.every((key) => ['type', 'id', 'url'].includes(key))
    && ['comment', 'assignment', 'upload', 'test'].includes(payload.type || '')
    && typeof payload.id === 'string'
    && payload.id.length > 0
    && typeof payload.url === 'string'
    && payload.url.startsWith('/dashboard/')
    && !payload.url.startsWith('//')
}
