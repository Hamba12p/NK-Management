/**
 * NK Udada Staff Hub — shared utilities
 */

/** Human-readable label for any role string */
export function formatRole(role?: string | null): string {
  if (!role) return ''
  if (role === 'board_advisor') return 'Board Advisor'
  if (role === 'volunteer_senior') return 'Senior Volunteer'
  if (role === 'volunteer_lead') return 'Volunteer Lead'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/** Tailwind badge classes for a role */
export function roleBadgeClass(role?: string | null): string {
  if (role === 'admin') return 'role-badge role-badge--admin'
  if (role === 'manager') return 'role-badge role-badge--manager'
  if (role?.startsWith('volunteer')) return 'role-badge role-badge--volunteer'
  return 'role-badge'
}
