import assert from 'node:assert/strict'
import test from 'node:test'
import { dashboardResourceHref } from '../src/lib/team-chat.ts'

test('resource links preserve encoded identifiers and deep-link to the matching record', () => {
  assert.equal(dashboardResourceHref('document', 'doc/1'), '/dashboard/documents?document=doc%2F1')
  assert.equal(dashboardResourceHref('workspace', 'doc 2'), '/dashboard/workspace?document=doc%202')
  assert.equal(dashboardResourceHref('task', 'task&3'), '/dashboard/workspace?task=task%263')
  assert.equal(dashboardResourceHref('meeting', 'meeting 4'), '/dashboard/meetings?meeting=meeting%204')
  assert.equal(dashboardResourceHref('announcement', 'notice?5'), '/dashboard/announcements?announcement=notice%3F5')
})
