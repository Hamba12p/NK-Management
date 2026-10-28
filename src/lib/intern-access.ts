export function todayInNairobi(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function internHasStarted(startDate: string | null, now = new Date()): boolean {
  return Boolean(startDate && startDate <= todayInNairobi(now))
}

export function internAccessIsActive(
  enabled: boolean,
  startDate: string | null,
  expiresAt: string | null,
  now = new Date(),
): boolean {
  return enabled
    && internHasStarted(startDate, now)
    && (!expiresAt || Date.parse(expiresAt) > now.getTime())
}

export function internPasswordChangeIsDue(
  required: boolean,
  requiredOn: string | null,
  now = new Date(),
): boolean {
  return required && (!requiredOn || requiredOn <= todayInNairobi(now))
}
