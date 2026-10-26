export const LEGAL_VERSION = '2026-10-26'
export const LEGAL_EFFECTIVE_DATE = '26 October 2026'

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export type LegalDocument = {
  title: string
  intro: string
  sections: LegalSection[]
}

export const PRIVACY_NOTICE: LegalDocument = {
  title: 'How we look after your information',
  intro: `Effective ${LEGAL_EFFECTIVE_DATE}.`,
  sections: [
    {
      heading: 'Who we are',
      paragraphs: ['NK Udada Foundation is a youth-led non-profit organisation based in Kampala, Uganda. We run this onboarding course (OBX) for our volunteers.'],
    },
    {
      heading: 'What we collect',
      paragraphs: ['We collect the name, email address and phone number you provide, your volunteer number, your answers and scores in the course, your progress and completion date, and the details shown on your badge. To help prevent misuse, we also keep a keyed, one-way hash of your device network address and the identity details used during public registration. We do not store the original network address in the OBX attempt log.'],
    },
    {
      heading: 'Why we collect it',
      paragraphs: ['We use this information to run your onboarding, save your progress so you can return later, award your badge, help authorised staff support volunteers and review progress, and protect the course from misuse.'],
    },
    {
      heading: 'Who can see it',
      paragraphs: ['Authorised NK Udada management and staff hub users can access OBX information for their work. Service providers that host and operate the platform may process information on the Foundation’s behalf. We do not sell your information or share it outside the Foundation unless the law requires us to.'],
    },
    {
      heading: 'How long we keep it',
      paragraphs: ['OBX does not currently apply an automatic deletion schedule. Contact admin@the-nkfoundation.org to ask about retention or deletion of your information.'],
    },
    {
      heading: 'Your rights',
      paragraphs: ['Under Uganda’s Data Protection and Privacy Act, 2019, you may ask to see your information, correct it, ask us to delete it, or object to how we use it. Write to admin@the-nkfoundation.org and our Data Protection Officer will respond.'],
    },
    {
      heading: 'Changes',
      paragraphs: ['If we change this notice, we will update the date above and ask you to agree again.'],
    },
  ],
}

export const VOLUNTEER_MOU: LegalDocument = {
  title: 'Our volunteer promise',
  intro: `Effective ${LEGAL_EFFECTIVE_DATE}. This is the short version of the NK Udada Organisation MOU. By agreeing, you promise to uphold it.`,
  sections: [
    { heading: '1. Respect', paragraphs: ['I will treat everyone with dignity, whatever their age, gender, background, ability or belief. I will not harass, bully or discriminate.'] },
    { heading: '2. Keeping children safe', paragraphs: ['I will never be alone with a child, never share private contact details with a child, and never take or share photos or videos of children without proper consent. I will report any concern straight away to the Foundation.'] },
    { heading: '3. Confidentiality', paragraphs: ['I will keep private any personal information about learners, volunteers, partners and the Foundation, and I will not share it outside my role.'] },
    { heading: '4. Our space and equipment', paragraphs: ['At the NK Udada Hub and at outreach events I will arrive on time, look after equipment, follow safety rules, and not bring in visitors without permission.'] },
    { heading: '5. Honesty', paragraphs: ['I will be truthful, tell the Foundation about any conflict of interest, and not use my role for personal gain.'] },
    { heading: '6. Representing NK Udada', paragraphs: ['I will speak and act in a way that reflects our values, online and offline, and I will not speak for the Foundation unless asked to.'] },
    { heading: '7. Raising concerns', paragraphs: ['If something is wrong, I will tell a manager or write to admin@the-nkfoundation.org. I can do this without fear of punishment.'] },
    { heading: '8. If the promise is broken', paragraphs: ['The Foundation may give a warning, pause my volunteering or end it, depending on how serious the matter is.'] },
  ],
}
