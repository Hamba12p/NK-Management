const MIN_FORM_AGE_MS = 2_000
const MAX_FORM_AGE_MS = 30 * 60 * 1_000

export function isLikelyObxBot(website: unknown, startedAt: unknown, now = Date.now()): boolean {
  if (typeof website !== 'string' || website.trim() !== '') return true
  if (typeof startedAt !== 'number' || !Number.isSafeInteger(startedAt)) return true
  const elapsed = now - startedAt
  return elapsed < MIN_FORM_AGE_MS || elapsed > MAX_FORM_AGE_MS
}
