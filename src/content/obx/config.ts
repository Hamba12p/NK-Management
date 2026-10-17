export const OBX_CONFIG = {
  courseVersion: 1,
  mouVersion: 'draft-1',
  privacyNoticeUrl: '',
  coordinatorContact: '',
  safeguardingContact: 'To be confirmed before launch',
  dpoContact: 'To be confirmed before launch',
  generalContact: 'To be confirmed before launch',
  fullMouUrl: '',
  storyVideoUrl: '',
  pocketCardEnabled: true,
  passMarks: { keepingChildrenSafe: 80, otherStops: 0 },
} as const

// DRAFT: management and safeguarding lead to review before launch
export const OBX_FACTS = {
  founded: '2024',
  basedIn: 'Kampala',
  mission: 'Empower and Equip',
  verifyBeforeLaunch: true,
} as const
