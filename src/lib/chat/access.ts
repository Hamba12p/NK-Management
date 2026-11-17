export const AMINA_CHAT_EMAIL = 'aminayarmah@gmail.com'
export const CHAT_PROFILE_ROLES = ['admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'board_advisor', 'intern']

export function canUseChat(role: string | null | undefined, _email?: string | null, _isFounder = false) {
  return CHAT_PROFILE_ROLES.includes(role || '')
}
