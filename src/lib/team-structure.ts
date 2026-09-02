export type HubRole = 'admin' | 'manager' | 'dpo' | 'volunteer' | 'volunteer_senior' | 'volunteer_lead'

export const teamMembers = [
  { email: 'nkateregga003@gmail.com', name: 'Naira Kateregga', title: 'Founder & Coordinator', role: 'admin' as const, avatar: 'NK', color: 'var(--purple)' },
  { email: 'jfaizal633@gmail.com', name: 'Faizal Kizito Jamal', title: 'General Manager', role: 'manager' as const, avatar: 'FKJ', color: 'var(--purple-lt)' },
  { email: 'nantongoshamsa2@gmail.com', name: 'Shamsa Nantongo', title: 'Finance & Procurement Manager', role: 'manager' as const, avatar: 'SN', color: 'var(--gold)' },
  { email: 'shabehamba@gmail.com', name: 'Hamba Shabil', title: 'Operations & Programs Manager', role: 'manager' as const, avatar: 'HS', color: 'var(--rust)' },
  { email: 'aminayarmah@gmail.com', name: 'Amina Yarmah', title: 'Volunteer Rep / DPO', role: 'dpo' as const, avatar: 'AY', color: 'var(--purple)' },
  { email: 'admin@the-nkfoundation.org', name: 'Admin', title: 'Organization administrator', role: 'admin' as const, avatar: 'ADM', color: 'var(--ink)' },
  { email: 'ginanina400@gmail.com', name: 'Volunteers', title: 'Shared volunteer login', role: 'volunteer' as const, avatar: 'VOL', color: 'var(--purple-lt)' },
]

export const rolePermissions: Record<HubRole, string[]> = {
  admin: ['all'],
  manager: ['manage_operations', 'manage_volunteers', 'manage_tasks', 'workspace_write'],
  dpo: ['dpo_register', 'dpo_requests', 'dpo_incidents', 'view_activity_log', 'workspace_write'],
  volunteer: ['workspace_write', 'view_announcements', 'update_own_profile'],
  volunteer_senior: ['workspace_write', 'view_announcements', 'update_own_profile', 'mentor_volunteers'],
  volunteer_lead: ['workspace_write', 'view_announcements', 'update_own_profile', 'organize_volunteer_events'],
}
