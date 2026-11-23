// Speech to text through a local whisper.cpp server. The prompt nudges whisper towards the names it will hear.
const NOISE = /^(\[.*\]|\(.*\)|thank you\.?|thanks for watching!?|you|\.|bye\.?)$/i // what whisper says to silence

export function makeStt(url, names) {
  return async function transcribe(wav) {
    const form = new FormData()
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'utt.wav')
    form.append('response_format', 'json')
    form.append('prompt', names.join(', '))
    const r = await fetch(`${url}/inference`, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error(`whisper ${r.status}`)
    const text = ((await r.json()).text || '').replace(/\s+/g, ' ').trim()
    return NOISE.test(text) ? '' : text
  }
}
