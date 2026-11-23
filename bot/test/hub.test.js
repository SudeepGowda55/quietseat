import { test } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { startHub } from '../src/hub.js'

test('a glasses client gets the current screen on connect, and its taps come back as commands', async () => {
  const got = []
  const hub = startHub({ port: 8791, token: 't', onCommand: c => got.push(c) })
  hub.show({ screen: 'captions', lines: ['Asha: hi'] })
  const ws = new WebSocket('ws://127.0.0.1:8791/?token=t')
  const first = await new Promise(r => ws.once('message', m => r(JSON.parse(m))))
  assert.deepEqual(first, { screen: 'captions', lines: ['Asha: hi'] })
  ws.send(JSON.stringify({ type: 'reply', index: 1 }))
  await new Promise(r => setTimeout(r, 100))
  assert.deepEqual(got, [{ type: 'reply', index: 1 }])
  const bad = new WebSocket('ws://127.0.0.1:8791/?token=nope')
  const code = await new Promise(r => bad.once('close', c => r(c)))
  assert.equal(code, 4001)
  ws.close(); await hub.close()
})
