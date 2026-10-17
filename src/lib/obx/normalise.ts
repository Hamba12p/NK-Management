export function normaliseVolunteerNumber(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/[\s-]/g, '')
  const digits = compact.startsWith('NKV') ? compact.slice(3) : compact
  if (!/^\d{1,4}$/.test(digits)) return null
  const padded = digits.padStart(3, '0')
  return `NKV-${padded}`
}

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase()
}
