import test from 'node:test'
import assert from 'node:assert/strict'
import { initials, volunteerContributor } from '../src/lib/creator.ts'

test('creator tags meet the database minimum for single-name volunteers', () => {
  assert.equal(initials('Naira'), 'NA')
  assert.equal(initials('N'), 'NN')
  assert.equal(initials('Naira Monalisa'), 'NM')
  assert.equal(initials(''), 'NK')
})

test('single-name volunteer attribution emits a database-valid tag', () => {
  const originalDocument = globalThis.document
  globalThis.document = { cookie: 'nk_volunteer_name=Naira' }
  try {
    assert.deepEqual(volunteerContributor(), {
      contributor_name: 'Naira',
      contributor_tag: 'NA',
    })
  } finally {
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})
