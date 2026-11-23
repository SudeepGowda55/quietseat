import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toWav16k, seconds } from '../src/audio.js'

test('48 kHz stereo becomes a 16 kHz mono WAV of the same length', () => {
  const pcm = Buffer.alloc(48000 * 4) // one second
  for (let i = 0; i < 48000; i++) { pcm.writeInt16LE(1000, i * 4); pcm.writeInt16LE(3000, i * 4 + 2) }
  const wav = toWav16k(pcm)
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
  assert.equal(wav.readUInt32LE(24), 16000)
  assert.equal(seconds(wav), 1)
  assert.equal(wav.readInt16LE(44), 2000) // the two channels averaged
})
