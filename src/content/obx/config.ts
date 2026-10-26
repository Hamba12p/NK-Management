import { LEGAL_VERSION } from '@/lib/obx/legal-content'

export const OBX_CONFIG = {
  courseVersion: 1,
  mouVersion: LEGAL_VERSION,
  passMarks: { keepingChildrenSafe: 80, otherStops: 0 },
} as const

// DRAFT: management and safeguarding lead to review before launch
export const OBX_FACTS = {
  founded: '2024',
  basedIn: 'Kampala',
  mission: 'Empower and Equip',
} as const
