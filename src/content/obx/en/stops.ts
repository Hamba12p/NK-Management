export type ObxChoice = { id: string; label: string }
export type ObxQuestion = { id: string; prompt: string; choices: ObxChoice[] }
export type ObxStop = { id: string; title: string; minutes: number; intro: string; questions: ObxQuestion[]; recap: [string, string, string] }

// DRAFT: management and safeguarding lead to review before launch
export const meetNkUdadaStory = [
  'NK Udada is youth-founded and youth-led.',
  'The organisation was founded in 2024 and is based in Kampala.',
  'Our promise is to Empower and Equip.',
  'We work with girls and boys.',
  'Our work supports the Sustainable Development Goals on health, education and gender equality.',
] as const

// DRAFT: management and safeguarding lead to review before launch
export const obxStops: ObxStop[] = [
  { id: 'meet_nk_udada', title: 'Meet NK Udada', minutes: 4, intro: 'Get to know the team and the five pillars that guide our work.', questions: [
    { id: 'pillar_school', prompt: 'A learner needs school materials to stay enrolled. Which pillar fits best?', choices: [{ id: 'education', label: 'Education Access' }, { id: 'advocacy', label: 'Advocacy and Awareness' }] },
    { id: 'pillar_health', prompt: 'A session combines reusable pad kits with a puberty talk. Which pillar fits best?', choices: [{ id: 'menstrual', label: 'Menstrual Health and Support' }, { id: 'skills', label: 'Skilling for Sustainability' }] },
    { id: 'pillar_computer', prompt: 'A computer literacy class at the Hub is part of which pillar?', choices: [{ id: 'skills', label: 'Skilling for Sustainability' }, { id: 'life', label: 'Life Skills and Mentorship' }] },
    { id: 'pillar_mentor', prompt: 'A goal-setting and money-skills session is part of which pillar?', choices: [{ id: 'life', label: 'Life Skills and Mentorship' }, { id: 'education', label: 'Education Access' }] },
    { id: 'pillar_stigma', prompt: 'A community talk that challenges stigma is part of which pillar?', choices: [{ id: 'advocacy', label: 'Advocacy and Awareness' }, { id: 'menstrual', label: 'Menstrual Health and Support' }] },
    { id: 'pillar_purpose', prompt: 'What is the organisation’s short promise?', choices: [{ id: 'empower', label: 'Empower and Equip' }, { id: 'compete', label: 'Compete and Win' }] },
  ], recap: ['We empower and equip girls and boys.', 'Our work follows five connected pillars.', 'Ask your coordinator when you are unsure where an activity fits.'] },
  { id: 'our_promise', title: 'Our Promise', minutes: 4, intro: 'Everyday choices help make the Hub welcoming and safe.', questions: [
    { id: 'late', prompt: 'You may arrive late to an activity. What should you do?', choices: [{ id: 'tell_early', label: 'Tell the coordinator as early as possible.' }, { id: 'say_nothing', label: 'Wait to see if anyone notices.' }, { id: 'leave', label: 'Skip it and explain later.' }] },
    { id: 'joke', prompt: 'A colleague makes a joke that upsets someone. What is a good next step?', choices: [{ id: 'speak', label: 'Speak up kindly and use the grievance channel if needed.' }, { id: 'share', label: 'Repeat the joke to others.' }, { id: 'ignore', label: 'Stay silent every time.' }] },
    { id: 'confidential', prompt: 'You hear private information about a learner. What should you do?', choices: [{ id: 'keep', label: 'Keep it private and share only with the right person if needed.' }, { id: 'group', label: 'Post it in the volunteer group.' }, { id: 'friend', label: 'Tell a friend outside the Hub.' }] },
    { id: 'computer', prompt: 'You want to use a Hub computer for personal work. What is the respectful choice?', choices: [{ id: 'ask_first', label: 'Follow the workspace rules and ask your coordinator first.' }, { id: 'use_it', label: 'Use it for anything without asking.' }, { id: 'copy_data', label: 'Copy Hub data to your own device.' }] },
    { id: 'gift', prompt: 'A parent offers you a gift after a session. What should you do?', choices: [{ id: 'declare_gift', label: 'Thank them, follow the MOU guidance and tell your coordinator.' }, { id: 'hide_gift', label: 'Accept it secretly.' }, { id: 'ask_more', label: 'Ask for a bigger gift.' }] },
    { id: 'conflict', prompt: 'You have a personal interest in a volunteer decision. What should you do?', choices: [{ id: 'declare_conflict', label: 'Declare the conflict before taking part in the decision.' }, { id: 'decide', label: 'Make the decision yourself.' }, { id: 'conceal', label: 'Keep the interest private.' }] },
  ], recap: ['Communicate early and treat people with respect.', 'Keep confidential information private.', 'Declare conflicts and use the grievance channel.'] },
  { id: 'keeping_children_safe', title: 'Keeping Children Safe', minutes: 5, intro: 'Listen calmly, keep clear boundaries and report concerns the same day.', questions: [
    { id: 'concern', prompt: 'A learner says something that worries you after a session. What do you do?', choices: [{ id: 'report', label: 'Listen, reassure them, record only what you heard and report today.' }, { id: 'investigate', label: 'Ask lots of questions to investigate.' }, { id: 'secret', label: 'Promise to keep it secret.' }] },
    { id: 'social', prompt: 'A learner asks to follow you on social media. What do you do?', choices: [{ id: 'official', label: 'Keep the boundary and use official channels only.' }, { id: 'accept', label: 'Accept from your personal account.' }, { id: 'message', label: 'Start a private chat.' }] },
    { id: 'drive', prompt: 'A colleague offers to drive a learner home alone. What do you do?', choices: [{ id: 'tell', label: 'Do not allow a one-to-one journey, tell the safeguarding contact.' }, { id: 'fine', label: 'Agree if the journey is short.' }, { id: 'alone', label: 'Let them decide without telling anyone.' }] },
    { id: 'photo', prompt: 'You want to take outreach photos for social media. What comes first?', choices: [{ id: 'consent', label: 'Get consent and use an approved account.' }, { id: 'post', label: 'Post now and ask later.' }, { id: 'personal', label: 'Use your personal story.' }] },
    { id: 'messages', prompt: 'You notice private messages between a volunteer and a learner. What do you do?', choices: [{ id: 'contact', label: 'Report the concern the same day through the safeguarding route.' }, { id: 'delete', label: 'Delete them and say nothing.' }, { id: 'forward', label: 'Forward them to friends.' }] },
  ], recap: ['Listen, reassure, record and report on the same day.', 'Use official channels and never promise secrecy.', 'A good-faith concern should always be raised.'] },
  { id: 'data_and_privacy', title: 'Data and Privacy', minutes: 3, intro: 'Personal information belongs in approved, secure channels. Uganda’s Data Protection and Privacy Act 2019 sets rules for handling people’s information.', questions: [
    { id: 'photo_data', prompt: 'Can you post a learner photo to your personal story?', choices: [{ id: 'keep', label: 'Keep private unless approved and consented.' }, { id: 'share', label: 'Share it freely.' }] },
    { id: 'numbers', prompt: 'Can you put learners’ phone numbers in a volunteer group?', choices: [{ id: 'keep', label: 'Keep private and use approved channels.' }, { id: 'share', label: 'Share the full list.' }] },
    { id: 'event', prompt: 'A public event date is approved for social media. Can it be shared?', choices: [{ id: 'share', label: 'Share only the approved details.' }, { id: 'keep', label: 'Never share any public event information.' }] },
    { id: 'lost_phone', prompt: 'You lose a phone containing learner details. What next?', choices: [{ id: 'report', label: 'Tell the DPO the same day.' }, { id: 'wait', label: 'Wait to see if it turns up.' }] },
    { id: 'attendance', prompt: 'You need to send an attendance list. Which channel should you use?', choices: [{ id: 'official_email', label: 'Use an approved work account and send only what is needed.' }, { id: 'personal_email', label: 'Use your personal email.' }] },
    { id: 'password', prompt: 'A colleague asks for your account password to get a file. What should you do?', choices: [{ id: 'no_password', label: 'Keep your password private and use an approved sharing method.' }, { id: 'send_password', label: 'Send it in a message.' }] },
    { id: 'delete', prompt: 'You no longer need a copy of personal information. What should you do?', choices: [{ id: 'delete_copy', label: 'Delete it safely under the organisation’s process.' }, { id: 'keep_copy', label: 'Keep it on your phone forever.' }] },
    { id: 'minimum', prompt: 'A report asks for a few details. What is safest?', choices: [{ id: 'minimum_needed', label: 'Share only the minimum information needed.' }, { id: 'everything', label: 'Attach the full volunteer and learner roster.' }] },
  ], recap: ['Ask for consent and collect only what is needed.', 'Use official channels and secure your devices.', 'Tell the DPO about a possible breach immediately.'] },
  { id: 'how_we_work', title: 'How We Work', minutes: 3, intro: 'Good activities start with a clear plan and finish with a useful report.', questions: [
    { id: 'help', prompt: 'You have a question about an upcoming activity. Who can help first?', choices: [{ id: 'coordinator', label: 'Your coordinator.' }, { id: 'public', label: 'Post private details publicly.' }] },
  ], recap: ['Sign up and attend the briefing.', 'Run the activity and take the roll-call.', 'Debrief and report what happened.'] },
  { id: 'sign_and_celebrate', title: 'Sign and Celebrate', minutes: 2, intro: 'Review the shared promise, then add your name to your passport.', questions: [], recap: ['Treat people with respect.', 'Protect children and personal information.', 'Ask for help when you are unsure.'] },
]
