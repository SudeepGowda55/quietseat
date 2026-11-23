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

test('model replies that invent facts, fake a decline or forget to ask are swapped for built-in ones', async () => {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ accept: "I merged it into 'main'.", decline: 'Sure, happy to.', ask: 'Tell me more.' }) } }] }))
  }).listen(8792)
  const r = await makeDrafts('http://127.0.0.1:8792')('Sudeep, which branch has the fix?')
  server.close()
  assert.equal(r.by, 'llm')
  assert.deepEqual(r.replies, builtIn('Sudeep, which branch has the fix?'))
})
