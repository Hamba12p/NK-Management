export type CreatorProfile = {
  full_name: string
  display_tag?: string | null
  display_color?: string | null
}

export function initials(value: string, limit = 2) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'NK'
}

export function volunteerContributor() {
  if (typeof document === 'undefined') return {}
  const raw = document.cookie
    .split('; ')
    .find(item => item.startsWith('nk_volunteer_name='))
    ?.split('=')
    .slice(1)
    .join('=')
  if (!raw) return {}
  const contributor_name = decodeURIComponent(raw).trim().slice(0, 100)
  return contributor_name
    ? { contributor_name, contributor_tag: initials(contributor_name) }
    : {}
}
