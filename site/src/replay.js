// Replays a call recorded by the bot (QS_RECORD) as the screens the glasses showed, following bot/src/index.js and
// glasses/src/main.ts: same caption lines, same question screen, same "Sent to #channel" for 2 s after a tap.
export const CHARS = 54, BODY_LINES = 9
export const GAP = 3500 // pauses longer than this are shortened in the replay
export const SENT_MS = 2000
const KNOWN = new Set(['consent', 'caption', 'speaking', 'called', 'tap'])

// Verbatim from glasses/src/main.ts
export const ascii = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7e\n]/g, '')
export function fit(lines) {
  const out = []
  let rows = 0
  for (const line of [...lines].reverse()) {
    const r = Math.max(1, Math.ceil(line.length / CHARS))
    if (rows + r > BODY_LINES) break
    out.unshift(line); rows += r
  }
  return out.join('\n')
}

// Each event gets a replay time `at`. Idle gaps are capped; the gap before a question screen is the real latency, never cut.
export function timeline(session) {
  const events = (session?.events ?? []).filter(e => KNOWN.has(e?.type) && Number.isFinite(e.t)).sort((a, b) => a.t - b.t)
  let at = 0, prev = null
  const out = events.map(e => {
    if (prev) at += e.type === 'called' ? e.t - prev.t : Math.min(e.t - prev.t, GAP)
    prev = e
    return { ...e, at }
  })
  return { events: out, duration: (out.at(-1)?.at ?? 0) + 6000 }
}

const SPEAKING = 'Someone speaking (not captioned)' // the recording keeps no name for people who did not opt in

export function stateAt(tl, at) {
  const s = { lines: [], captioned: 0, called: null, chat: [], sentAt: -Infinity, i: -1 }
  tl.events.forEach((e, i) => {
    if (e.at > at) return
    s.i = i
    if (e.type === 'consent') s.captioned = e.captioned ?? s.captioned
    else if (e.type === 'caption') s.lines.push(`${e.speaker ?? 'Someone'}: ${e.text ?? ''}`)
    else if (e.type === 'speaking') { if (s.lines.at(-1) !== SPEAKING) s.lines.push(SPEAKING) }
    else if (e.type === 'called') s.called = { asker: e.asker ?? 'Someone', question: e.question ?? '', replies: (e.replies ?? []).slice(0, 3), by: e.by, at: e.at, i }
    else if (e.type === 'tap' && s.called) { // a tap with no question before it came from the manual path; nothing to show
      s.chat.push({ to: s.called.asker, text: e.reply ?? s.called.replies[e.index] ?? '', at: e.at })
      s.called = null; s.sentAt = e.at
    }
  })
  if (s.lines.length > 30) s.lines = s.lines.slice(-30)
  // call clock: real time of the last event plus what has played since, never past the next event
  const last = tl.events[s.i], next = tl.events[s.i + 1]
  s.real = last ? Math.min(last.t + (at - last.at), next ? next.t : Infinity) : 0
  return s
}

// What the glasses showed at replay time `at`.
export function screenAt(tl, at, channel) {
  const s = stateAt(tl, at)
  if (s.called) {
    // the wearer scrolls with the ring to the reply they tap, then taps
    const tap = tl.events.slice(s.called.i + 1).find(e => e.type === 'tap' || e.type === 'called')
    const target = tap?.type === 'tap' ? Math.min(Math.max(0, tap.index | 0), 3) : 0
    let sel = 0, pressed = false
    if (tap?.type === 'tap') {
      sel = Math.max(0, Math.min(target, target - Math.floor((tap.at - 450 - at) / 550)))
      pressed = at > tap.at - 260
    }
    return { screen: 'called', asker: s.called.asker, question: s.called.question, replies: s.called.replies, sel, pressed, state: s }
  }
  if (at - s.sentAt < SENT_MS) return { screen: 'sent', text: `Sent to #${channel}`, state: s }
  return { screen: 'captions', header: `#${channel} . ${s.captioned} captioned`, lines: s.lines, state: s }
}

export const clock = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
