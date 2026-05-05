/**
 * NK Udada Staff Hub — shared utilities
 */

/** Human-readable label for any role string */
export function formatRole(role?: string | null): string {
  if (!role) return ''
  if (role === 'volunteer_senior') return 'Senior Volunteer'
  if (role === 'volunteer_lead') return 'Volunteer Lead'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/** Tailwind badge classes for a role */
export function roleBadgeClass(role?: string | null): string {
  if (role === 'admin') return 'bg-purple/20 text-purple'
  if (role === 'manager') return 'bg-gold/20 text-gold'
  if (role?.startsWith('volunteer')) return 'bg-warm text-muted border border-border'
  return 'bg-border text-muted'
}
