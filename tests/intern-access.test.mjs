import test from 'node:test'
import assert from 'node:assert/strict'
import {
  internAccessIsActive,
  internPasswordChangeIsDue,
} from '../src/lib/intern-access.ts'

test('manual intern access accepts null expiry until disabled', () => {
  const now = new Date('2026-10-28T09:00:00.000Z')

  assert.equal(internAccessIsActive(true, '2026-10-28', null, now), true)
  assert.equal(internAccessIsActive(false, '2026-10-28', null, now), false)
  assert.equal(internAccessIsActive(true, '2026-10-29', null, now), false)
  assert.equal(internAccessIsActive(true, '2026-10-28', '2026-10-28T08:59:59.000Z', now), false)
})

test('scheduled password change becomes due at midnight Nairobi time', () => {
  assert.equal(
    internPasswordChangeIsDue(true, '2026-11-03', new Date('2026-11-02T20:59:59.000Z')),
    false,
  )
  assert.equal(
    internPasswordChangeIsDue(true, '2026-11-03', new Date('2026-11-02T21:00:00.000Z')),
    true,
  )
  assert.equal(internPasswordChangeIsDue(false, '2026-10-28'), false)
  assert.equal(internPasswordChangeIsDue(true, null), true)
})
