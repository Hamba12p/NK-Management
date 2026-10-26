import test from 'node:test'
import assert from 'node:assert/strict'

process.env.OBX_SESSION_SECRET = 'test-secret-for-obx-session-signing-0000000000000000'

const [{ normaliseVolunteerNumber, normaliseEmail }, { hasTwoObxIdentifiers, normaliseObxContact }, { signSession, verifySession, signPendingLookup, verifyPendingLookup }, { scorePercent, meetsPassMark, isRateLimited }, { isLikelyObxBot }] = await Promise.all([
  import('../src/lib/obx/normalise.ts'),
  import('../src/lib/obx/contact.ts'),
  import('../src/lib/obx/session-core.ts'),
  import('../src/lib/obx/logic.ts'),
  import('../src/lib/obx/anti-abuse.ts'),
])
const { LEGAL_VERSION } = await import('../src/lib/obx/legal-content.ts')
const { isCurrentLegalConsent, makeLegalConsentRecord } = await import('../src/lib/obx/legal-consent.ts')
const { canVolunteerAccessApi, isObxOnlyVolunteerRole } = await import('../src/lib/staffhub-access.ts')

test('volunteer numbers normalise accepted forms and reject malformed input', () => {
  assert.equal(normaliseVolunteerNumber('nkv37'), 'NKV-037')
  assert.equal(normaliseVolunteerNumber('NKV 037'), 'NKV-037')
  assert.equal(normaliseVolunteerNumber('nkv-0037'), 'NKV-0037')
  assert.equal(normaliseVolunteerNumber('NKV-12345'), null)
  assert.equal(normaliseEmail('  TEAM@Example.ORG '), 'team@example.org')
})

test('roster contact normalisation accepts email and international phone numbers', () => {
  assert.deepEqual(normaliseObxContact('  TEAM@Example.ORG '), { channel: 'email', value: 'team@example.org' })
  assert.deepEqual(normaliseObxContact('0776 866 921'), { channel: 'phone', value: '+256776866921' })
  assert.deepEqual(normaliseObxContact('256776866921'), { channel: 'phone', value: '+256776866921' })
  assert.equal(normaliseObxContact('not-an-email-or-phone'), null)
})

test('OBX registration accepts any two of name, email, and phone', () => {
  assert.equal(hasTwoObxIdentifiers('Amina', 'amina@example.org', null), true)
  assert.equal(hasTwoObxIdentifiers('Amina', null, '+256776866921'), true)
  assert.equal(hasTwoObxIdentifiers('', 'amina@example.org', '+256776866921'), true)
  assert.equal(hasTwoObxIdentifiers('Amina', null, null), false)
  assert.equal(hasTwoObxIdentifiers('', 'amina@example.org', null), false)
})

test('scoring uses bounded first try percentages and applies threshold', () => {
  assert.equal(scorePercent(4, 5), 80)
  assert.equal(scorePercent(3, 0), 0)
  assert.equal(meetsPassMark(80, 80), true)
  assert.equal(meetsPassMark(79.99, 80), false)
})

test('signed sessions reject tampering and expiry', () => {
  const token = signSession('00000000-0000-4000-8000-000000000000', 1_000_000)
  assert.equal(verifySession(token, 1_000_001)?.rosterId, '00000000-0000-4000-8000-000000000000')
  assert.equal(verifySession(`${token}x`, 1_000_001), null)
  assert.equal(verifySession(token, 1_000_000 + 8 * 60 * 60 * 1000), null)
})

test('pending volunteer lookups expire after five minutes and reject tampering', () => {
  const token = signPendingLookup('00000000-0000-4000-8000-000000000000', 1_000_000)
  assert.equal(verifyPendingLookup(token, 1_000_001)?.rosterId, '00000000-0000-4000-8000-000000000000')
  assert.equal(verifyPendingLookup(`${token}x`, 1_000_001), null)
  assert.equal(verifyPendingLookup(token, 1_000_000 + 5 * 60 * 1000), null)
})

test('rate limit engages at eight failures by either key', () => {
  assert.equal(isRateLimited(7, 7), false)
  assert.equal(isRateLimited(8, 0), true)
  assert.equal(isRateLimited(0, 8), true)
})

test('OBX registration rejects honeypot submissions and forms submitted too quickly', () => {
  const now = 10_000
  assert.equal(isLikelyObxBot('', now - 2_000, now), false)
  assert.equal(isLikelyObxBot('filled', now - 3_000, now), true)
  assert.equal(isLikelyObxBot('', now - 1_999, now), true)
  assert.equal(isLikelyObxBot('', now - 31 * 60 * 1_000, now), true)
  assert.equal(isLikelyObxBot('', 'invalid', now), true)
})

test('legal consent gate requires both timestamps for the current version', () => {
  const volunteerId = '00000000-0000-4000-8000-000000000000'
  const acceptedAt = '2026-10-26T10:00:00.000Z'
  const record = makeLegalConsentRecord(volunteerId, LEGAL_VERSION, true, true, acceptedAt)
  assert.deepEqual(record, {
    roster_id: volunteerId,
    privacy_accepted_at: acceptedAt,
    mou_accepted_at: acceptedAt,
    legal_version: LEGAL_VERSION,
  })
  assert.equal(isCurrentLegalConsent(record, LEGAL_VERSION), true)
  assert.equal(isCurrentLegalConsent({ ...record, legal_version: '2026-01-01' }, LEGAL_VERSION), false)
  assert.equal(isCurrentLegalConsent({ ...record, mou_accepted_at: null }, LEGAL_VERSION), false)
  assert.equal(makeLegalConsentRecord(volunteerId, LEGAL_VERSION, true, false, acceptedAt), null)
  assert.equal(makeLegalConsentRecord(volunteerId, LEGAL_VERSION, false, true, acceptedAt), null)
})

test('basic volunteer StaffHub roles are restricted to OBX APIs', () => {
  assert.equal(isObxOnlyVolunteerRole('volunteer'), true)
  assert.equal(isObxOnlyVolunteerRole('volunteer_senior'), true)
  assert.equal(isObxOnlyVolunteerRole('volunteer_lead'), true)
  assert.equal(isObxOnlyVolunteerRole('volunteer_lead', 'georgina@example.org', ' Georgina@Example.org '), false)
  assert.equal(isObxOnlyVolunteerRole('volunteer', 'georgina@example.org', 'georgina@example.org'), true)
  assert.equal(isObxOnlyVolunteerRole('manager'), false)
  assert.equal(canVolunteerAccessApi('volunteer', '/api/obx/staff-session'), true)
  assert.equal(canVolunteerAccessApi('volunteer', '/api/auth/signout'), false)
  assert.equal(canVolunteerAccessApi('volunteer', '/api/tasks'), false)
  assert.equal(canVolunteerAccessApi('volunteer_lead', '/api/tasks', 'georgina@example.org', 'georgina@example.org'), true)
  assert.equal(canVolunteerAccessApi('manager', '/api/tasks'), true)
})
