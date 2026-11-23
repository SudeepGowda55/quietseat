import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { timeline, screenAt, fit, GAP } from '../src/replay.js'

const session = JSON.parse(readFileSync(new URL('../public/session.json', import.meta.url)))

test('session.json replays without unknown events or undefined text', () => {
  const known = ['consent', 'caption', 'speaking', 'called', 'tap']
  for (const e of session.events) assert.ok(known.includes(e.type), `unknown event type ${e.type}`)
  const tl = timeline(session)
  assert.equal(tl.events.length, session.events.length)
  for (let at = 0; at <= tl.duration; at += 100) {
    const s = screenAt(tl, at, 'General')
    const text = JSON.stringify({ ...s, state: undefined })
    assert.ok(!/undefined|null|NaN/.test(text), `bad text at ${at}: ${text}`)
  }
})

test('pauses are capped but the question latency is kept', () => {
  const tl = timeline({ events: [{ t: 0, type: 'caption', speaker: 'A', text: 'hi' }, { t: 60000, type: 'caption', speaker: 'A', text: 'B, can you?' }, { t: 62400, type: 'called', asker: 'A', question: 'B, can you?', replies: ['y', 'n', 'q?'] }] })
  assert.deepEqual(tl.events.map(e => e.at), [0, GAP, GAP + 2400])
})

test('unnamed speakers collapse, orphan taps are skipped, sent shows for 2 s', () => {
  const tl = timeline({ events: [
    { t: 0, type: 'speaking' }, { t: 100, type: 'speaking' }, { t: 200, type: 'tap', index: 0, reply: 'x' },
    { t: 300, type: 'called', asker: 'Asha', question: 'Q?', replies: ['a', 'b', 'c?'] }, { t: 2000, type: 'tap', index: 2, reply: 'c?' },
  ] })
  assert.deepEqual(screenAt(tl, 250, 'G').lines, ['Someone speaking (not captioned)'])
  const before = screenAt(tl, 1900, 'G')
  assert.equal(before.screen, 'called'); assert.equal(before.sel, 2); assert.ok(before.pressed)
  assert.equal(screenAt(tl, 2100, 'G').text, 'Sent to #G')
  assert.equal(screenAt(tl, 4100, 'G').screen, 'captions')
  assert.deepEqual(screenAt(tl, 4100, 'G').state.chat, [{ to: 'Asha', text: 'c?', at: 2000 }])
})

test('fit keeps the newest lines that fit 9 rows of 54 characters', () => {
  const lines = Array.from({ length: 12 }, (_, i) => `line ${i}`)
  assert.equal(fit(lines).split('\n').length, 9)
  assert.equal(fit(['x'.repeat(200), 'y']).split('\n').length, 2)
})
