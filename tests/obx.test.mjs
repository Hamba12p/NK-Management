import test from 'node:test'
import assert from 'node:assert/strict'

process.env.OBX_SESSION_SECRET = 'test-secret-for-obx-session-signing-0000000000000000'

const [{ normaliseVolunteerNumber, normaliseEmail }, { normaliseObxContact }, { signSession, verifySession }, { scorePercent, meetsPassMark, isRateLimited }] = await Promise.all([
  import('../src/lib/obx/normalise.ts'),
  import('../src/lib/obx/contact.ts'),
  import('../src/lib/obx/session-core.ts'),
  import('../src/lib/obx/logic.ts'),
])

test('volunteer numbers normalise accepted forms and reject malformed input', () => {
  assert.equal(normaliseVolunteerNumber('nkv37'), 'NKV-037')
  assert.equal(normaliseVolunteerNumber('NKV 037'), 'NKV-037')
  assert.equal(normaliseVolunteerNumber('nkv-0037'), 'NKV-0037')
  assert.equal(normaliseVolunteerNumber('NKV-12345'), null)
  assert.equal(normaliseEmail('  TEAM@Example.ORG '), 'team@example.org')
})

test('passport contact input normalises email and international phone numbers', () => {
  assert.deepEqual(normaliseObxContact('  TEAM@Example.ORG '), { channel: 'email', value: 'team@example.org' })
  assert.deepEqual(normaliseObxContact('0776 866 921'), { channel: 'phone', value: '+256776866921' })
  assert.deepEqual(normaliseObxContact('256776866921'), { channel: 'phone', value: '+256776866921' })
  assert.equal(normaliseObxContact('not-an-email-or-phone'), null)
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

test('rate limit engages at eight failures by either key', () => {
  assert.equal(isRateLimited(7, 7), false)
  assert.equal(isRateLimited(8, 0), true)
  assert.equal(isRateLimited(0, 8), true)
})
