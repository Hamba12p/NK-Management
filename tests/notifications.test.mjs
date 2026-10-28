import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canViewDocument,
  isTrustedPushEndpoint,
  isCategoryEnabled,
  isSafeNotificationPayload,
  isWithinQuietHours,
  nextQuietHoursEnd,
  notificationCopy,
  notificationUrl,
  selectCommentRecipients,
} from '../src/lib/notifications/policy.ts'
import { matchesSharedSecret } from '../src/lib/notifications/secrets.ts'

test('comment recipients exclude the author and restrict interns to their own document', () => {
  assert.deepEqual(
    selectCommentRecipients('owner', 'commenter', ['commenter', 'other', 'intern-owner', 'other'], {
      owner: 'manager',
      commenter: 'volunteer',
      other: 'volunteer',
      'intern-owner': 'intern',
    }),
    ['owner', 'other'],
  )
  assert.deepEqual(selectCommentRecipients('owner', 'owner', ['owner', 'other'], {
    owner: 'manager',
    other: 'intern',
  }), [])
})

test('document recipients follow visibility, assignment and role access', () => {
  const standardAssigned = { visibility: 'standard', assigned_to: ['assignee'] }
  assert.equal(canViewDocument({ id: 'assignee', role: 'volunteer' }, standardAssigned, 'uploader'), true)
  assert.equal(canViewDocument({ id: 'other', role: 'volunteer' }, standardAssigned, 'uploader'), false)
  assert.equal(canViewDocument({ id: 'admin', role: 'admin' }, standardAssigned, 'uploader'), true)
  assert.equal(canViewDocument({ id: 'intern', role: 'intern' }, { visibility: 'standard', assigned_to: [] }, 'uploader'), false)
  assert.equal(canViewDocument({ id: 'other', role: 'manager' }, { visibility: 'restricted', assigned_to: [] }, 'uploader'), false)
})

test('notification category defaults and saved switches are honoured', () => {
  assert.equal(isCategoryEnabled('comment', null, 'volunteer'), true)
  assert.equal(isCategoryEnabled('assignment', { comments_enabled: true, assignments_enabled: false, uploads_enabled: false }, 'admin'), false)
  assert.equal(isCategoryEnabled('upload', null, 'manager'), true)
  assert.equal(isCategoryEnabled('upload', null, 'volunteer'), false)
  assert.equal(isCategoryEnabled('upload', { comments_enabled: true, assignments_enabled: true, uploads_enabled: true }, 'volunteer'), true)
})

test('quiet hours use Kampala time and cross midnight', () => {
  assert.equal(isWithinQuietHours(new Date('2026-10-26T18:30:00Z'), '21:00', '07:00', 'Africa/Kampala'), true)
  assert.equal(isWithinQuietHours(new Date('2026-10-26T03:30:00Z'), '21:00', '07:00', 'Africa/Kampala'), true)
  assert.equal(isWithinQuietHours(new Date('2026-10-26T05:00:00Z'), '21:00', '07:00', 'Africa/Kampala'), false)
  assert.equal(nextQuietHoursEnd(new Date('2026-10-26T18:30:00Z'), '21:00', '07:00', 'Africa/Kampala').toISOString(), '2026-10-27T04:00:00.000Z')
})

test('push payload has only a generic type, notification id and same-origin relative path', () => {
  const payload = { type: 'comment', id: 'notice-1', url: '/dashboard/workspace' }
  assert.equal(isSafeNotificationPayload(payload), true)
  assert.equal(isSafeNotificationPayload({ ...payload, body: 'private comment text' }), false)
  assert.equal(Object.keys(payload).sort().join(','), 'id,type,url')
  assert.equal(isSafeNotificationPayload({ ...payload, url: '//example.org' }), false)
  assert.equal(isSafeNotificationPayload({ ...payload, url: 'https://example.org' }), false)
  assert.equal(notificationCopy('comment'), 'New comment on a document you follow')
  assert.equal(notificationUrl('upload'), '/dashboard/documents')
  assert.equal(JSON.stringify(payload).includes('private comment text'), false)
})

test('push endpoints are limited to recognised public browser push services', () => {
  assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true)
  assert.equal(isTrustedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true)
  assert.equal(isTrustedPushEndpoint('https://web.push.apple.com/example'), true)
  assert.equal(isTrustedPushEndpoint('https://wns2.example.notify.windows.com/example'), true)
  assert.equal(isTrustedPushEndpoint('https://127.0.0.1/private'), false)
  assert.equal(isTrustedPushEndpoint('https://localhost/example'), false)
  assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com:8443/example'), false)
})

test('dispatch secret matching rejects absent and incorrect secrets', () => {
  assert.equal(matchesSharedSecret('correct-secret', 'correct-secret'), true)
  assert.equal(matchesSharedSecret('wrong-secret', 'correct-secret'), false)
  assert.equal(matchesSharedSecret(null, 'correct-secret'), false)
  assert.equal(matchesSharedSecret('correct-secret', undefined), false)
})
