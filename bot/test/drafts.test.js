import { test } from 'node:test'
import assert from 'node:assert/strict'
import { builtIn, makeDrafts, MAX } from '../src/drafts.js'

test('built-in replies fit the glasses list and match the question', () => {
  for (const q of ['can you take the deploy tonight?', 'when can you join?', 'which branch is it?']) {
    const r = builtIn(q)
    assert.equal(r.length, 3)
    assert.ok(r.every(s => s.length <= MAX))
  }
  assert.match(builtIn('when can you join?')[0], /minutes/)
})

test('with no model, or a model that does not answer in time, the built-in replies come back', async () => {
  assert.equal((await makeDrafts('')('can you?')).by, 'built-in')
  assert.equal((await makeDrafts('http://127.0.0.1:9', { timeoutMs: 300 })('can you?')).by, 'built-in')
})
