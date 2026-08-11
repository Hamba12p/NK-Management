export type HubRole = 'admin' | 'manager' | 'dpo' | 'volunteer' | 'volunteer_senior' | 'volunteer_lead'

export const teamMembers = [
  { email: 'naira@the-nkfoundation.org', name: 'Naira Kateregga', title: 'Founder & Coordinator', role: 'admin' as const, avatar: 'NK', color: 'var(--purple)' },
  { email: 'kizito@the-nkfoundation.org', name: 'Kizito Jamal', title: 'General Manager', role: 'manager' as const, avatar: 'KJ', color: 'var(--gold)' },
  { email: 'hamba@the-nkfoundation.org', name: 'Hamba Shabil', title: 'Operations & Programs Manager', role: 'manager' as const, avatar: 'HS', color: 'var(--rust)' },
  { email: 'balqees@the-nkfoundation.org', name: 'Balqees Yasin', title: 'Consultations & Advisory Board Lead', role: 'manager' as const, avatar: 'BY', color: 'var(--green)' },
  { email: 'shamsa@the-nkfoundation.org', name: 'Shamsa Nantongo', title: 'Finance & Procurement Manager', role: 'manager' as const, avatar: 'SN', color: 'var(--purple-lt)' },
  { email: 'aminah@the-nkfoundation.org', name: 'Aminah Yarmah', title: 'Data Protection Officer', role: 'dpo' as const, avatar: 'AY', color: 'var(--gold)' },
  { email: 'volunteers@the-nkfoundation.org', name: 'Volunteer team', title: 'Shared volunteer account', role: 'volunteer' as const, avatar: 'VT', color: 'var(--green)' },
]

export const rolePermissions: Record<HubRole, string[]> = {
  admin: ['all'],
  manager: ['manage_operations', 'manage_volunteers', 'manage_tasks', 'workspace_write'],
  dpo: ['dpo_register', 'dpo_requests', 'dpo_incidents', 'view_activity_log', 'workspace_write'],
  volunteer: ['workspace_write', 'view_announcements', 'update_own_profile'],
  volunteer_senior: ['workspace_write', 'view_announcements', 'update_own_profile', 'mentor_volunteers'],
  volunteer_lead: ['workspace_write', 'view_announcements', 'update_own_profile', 'organize_volunteer_events'],
}
