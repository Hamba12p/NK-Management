const VOLUNTEER_ROLES = new Set(['volunteer', 'volunteer_senior', 'volunteer_lead'])

export function isObxOnlyVolunteerRole(
  role: string | null | undefined,
  email?: string | null,
  representativeEmail?: string | null
): boolean {
  if (role == null || !VOLUNTEER_ROLES.has(role)) return false
  const configuredRepresentative = representativeEmail?.trim().toLowerCase()
  const accountEmail = email?.trim().toLowerCase()
  return !(role === 'volunteer_lead' && configuredRepresentative && accountEmail === configuredRepresentative)
}

export function canVolunteerAccessApi(
  role: string | null | undefined,
  pathname: string,
  email?: string | null,
  representativeEmail?: string | null
): boolean {
  if (!isObxOnlyVolunteerRole(role, email, representativeEmail)) return true
  return pathname.startsWith('/api/obx/')
}
