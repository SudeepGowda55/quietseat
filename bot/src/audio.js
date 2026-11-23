// Discord gives 48 kHz stereo 16-bit PCM; whisper.cpp wants 16 kHz mono WAV.
export function toWav16k(pcm48stereo) {
  const frames = Math.floor(pcm48stereo.length / 4), out = Buffer.alloc(Math.floor(frames / 3) * 2)
  for (let i = 0, j = 0; j < out.length; i += 3, j += 2) {
    // average 3 stereo frames into one mono sample (a crude low-pass before dropping to a third of the rate)
    let sum = 0
    for (let k = 0; k < 3; k++) { const o = (i + k) * 4; sum += pcm48stereo.readInt16LE(o) + pcm48stereo.readInt16LE(o + 2) }
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sum / 6))), j)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + out.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(out.length, 40)
  return Buffer.concat([h, out])
}
export const seconds = wav => (wav.length - 44) / 32000
