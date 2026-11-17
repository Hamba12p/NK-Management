import test from 'node:test'
import assert from 'node:assert/strict'
import { canUseChat } from '../src/lib/chat/access.ts'

test('all profile roles can open Chat so eligible counterparts can reach board and advisory profiles', () => {
  assert.equal(canUseChat('dpo', 'aminayarmah@gmail.com'), true)
  assert.equal(canUseChat('dpo', 'other@example.invalid'), true)
  assert.equal(canUseChat('board_advisor', 'board@example.invalid'), true)
  assert.equal(canUseChat('unknown', 'member@example.invalid'), false)
})

test('all database profile roles retain route access', () => {
  for (const role of ['admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'board_advisor', 'intern']) {
    assert.equal(canUseChat(role, 'member@example.invalid'), true)
  }
})
