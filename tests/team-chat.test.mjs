import assert from 'node:assert/strict'
import test from 'node:test'
import { chatResourceHref, parseChatResources } from '../src/lib/team-chat.ts'

test('chat references ignore malformed and unknown workspace items', () => {
  const resources = parseChatResources([
    { id: 'doc-1', kind: 'document', title: 'Board report' },
    { id: 'script', kind: 'javascript', title: 'Unexpected type' },
    { id: 'missing-title', kind: 'task' },
    null,
  ])

  assert.deepEqual(resources, [{ id: 'doc-1', kind: 'document', title: 'Board report' }])
})

test('chat references open their matching workspace destinations safely', () => {
  assert.equal(chatResourceHref({ id: 'doc 1', kind: 'workspace', title: 'Report' }), '/dashboard/workspace?document=doc%201')
  assert.equal(chatResourceHref({ id: 'task/2', kind: 'task', title: 'Follow up' }), '/dashboard/workspace?task=task%2F2')
  assert.equal(chatResourceHref({ id: 'file-3', kind: 'document', title: 'Policy' }), '/api/documents/file-3/access')
})
