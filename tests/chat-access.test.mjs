import test from 'node:test'
import assert from 'node:assert/strict'
import { canUseChat } from '../src/lib/chat/access.ts'

test('chat route visibility includes Amina by account email but excludes other DPO accounts', () => {
  assert.equal(canUseChat('dpo', 'aminayarmah@gmail.com'), true)
  assert.equal(canUseChat('dpo', 'AMINAYARMAH@GMAIL.COM'), true)
  assert.equal(canUseChat('dpo', 'other@example.invalid'), false)
})

test('existing chat roles and founders retain route access', () => {
  for (const role of ['manager', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'intern']) {
    assert.equal(canUseChat(role, 'member@example.invalid'), true)
  }
  assert.equal(canUseChat('admin', 'admin@example.invalid', true), true)
  assert.equal(canUseChat('admin', 'admin@example.invalid'), false)
})
