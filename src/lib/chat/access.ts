export const AMINA_CHAT_EMAIL = 'aminayarmah@gmail.com'

export function canUseChat(role: string | null | undefined, email: string | null | undefined, isFounder = false) {
  return isFounder
    || ['manager', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'intern'].includes(role || '')
    || (role === 'dpo' && email?.trim().toLowerCase() === AMINA_CHAT_EMAIL)
}
