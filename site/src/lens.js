// Draws one G2 screen (576 x 288, green on black) the way glasses/src/main.ts lays it out:
// captions = header 0..36 + body from 40; question = text 0..110 + reply list from 112 (40 px per item, selected item boxed).
import { ascii, fit } from './replay.js'

export const W = 576, H = 288
const FONT = '22.7px Abel, "Arial Narrow", sans-serif' // matched against Even Hub simulator 0.9.5 screenshots
const PITCH = 27
const BRIGHT = '#4cf05a', DIM = '#2a9a37'

export function makeLens(canvas) {
  const ctx = canvas.getContext('2d')
  let last = null, scale = 1

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth || W
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w / 2 * dpr)
    scale = canvas.width / W
    if (last) draw(last, true)
  }

  function wrap(text, width) {
    const rows = []
    for (const para of text.split('\n')) {
      let row = ''
      for (const word of para.split(' ')) {
        const next = row ? `${row} ${word}` : word
        if (ctx.measureText(next).width > width && row) { rows.push(row); row = word } else row = next
      }
      rows.push(row)
    }
    return rows
  }

  function text(rows, x, y, color) {
    ctx.fillStyle = color
    rows.forEach((r, i) => ctx.fillText(r, x, y + i * PITCH))
  }

  function draw(s, force = false) {
    const key = JSON.stringify({ ...s, state: undefined })
    if (!force && key === last?.key) return
    last = { ...s, key }
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    ctx.font = FONT; ctx.textBaseline = 'top'
    ctx.shadowColor = 'rgba(76,240,90,.35)'; ctx.shadowBlur = 3 * scale // the waveguide's slight bloom
    if (s.screen === 'captions') {
      text([ascii(s.header)], 5, 5, BRIGHT)
      const body = ascii(fit(s.lines)) || 'Nobody has spoken yet.'
      const rows = wrap(body, W - 10).slice(-9)
      rows.forEach((r, i) => text([r], 5, 46 + i * PITCH, / speaking \(not captioned\)$/.test(r) ? DIM : BRIGHT))
    } else if (s.screen === 'called') {
      text(wrap(ascii(`${s.asker.toUpperCase()} ASKED YOU:\n${s.question}`), W - 10).slice(0, 4), 5, 5, BRIGHT)
      ;[...s.replies, 'Dismiss'].forEach((r, i) => {
        const y = 124 + i * 40
        if (i === s.sel) {
          ctx.lineWidth = 1.6; ctx.strokeStyle = BRIGHT
          ctx.beginPath(); ctx.roundRect(4, y - 2, W - 8, 40, 9); ctx.stroke()
          if (s.pressed) { ctx.fillStyle = 'rgba(76,240,90,.22)'; ctx.fill() }
        }
        text([ascii(r)], 15, y + 7, i === s.sel ? BRIGHT : DIM)
      })
    } else {
      text(wrap(ascii(s.text), W - 10), 5, 5, BRIGHT)
    }
  }

  resize()
  new ResizeObserver(resize).observe(canvas)
  document.fonts?.load(FONT).then(() => last && draw(last, true))
  return { draw }
}
