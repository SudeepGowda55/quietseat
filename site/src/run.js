import { gsap, reduced } from './common.js'
import { makeLens } from './lens.js'
import { CHANNEL } from '../site.config.js'

const $ = s => document.querySelector(s)
const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replace(/\+/g, '-').replace(/\//g, '_')
const out = $('#b-out')
function build() {
  const names = $('#b-names').value.split(',').map(s => s.trim()).filter(Boolean).join(',')
  out.textContent = [
    'DISCORD_TOKEN=<your bot token>',
    `DISCORD_GUILD_ID=${$('#b-guild').value.trim() || '<your server ID>'}`,
    `QS_ALIASES=${names}`,
    'QS_WHISPER=http://127.0.0.1:8178',
    $('#b-llm').checked ? 'QS_LLM=http://127.0.0.1:8179' : '# QS_LLM unset: built-in replies',
    `QS_PAIR_TOKEN=${token}`,
    ...($('#b-rec').checked ? ['QS_RECORD=session.json'] : []),
  ].join('\n')
  if (!reduced) gsap.fromTo(out, { opacity: .55 }, { opacity: 1, duration: .3 })
}
document.querySelectorAll('.builder input').forEach(i => i.addEventListener('input', build))
build()

document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
  const pre = b.parentElement.querySelector('pre')
  const text = [...pre.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('c'))).map(n => n.textContent).join('').trim()
  try { await navigator.clipboard.writeText(text); b.textContent = 'Copied' } catch { b.textContent = 'Select and copy' }
  setTimeout(() => (b.textContent = 'Copy'), 1600)
}))

// the glasses app's own start-up screens (glasses/src/main.ts), looping
const lens = makeLens($('#head-lens'))
const steps = [
  [1800, { screen: 'status', text: 'Quiet Seat\n\nConnecting...' }],
  [3200, { screen: 'status', text: 'Quiet Seat\n\nLooking for the bot on your laptop...\nws://192.168.1.20:8787' }],
  [3200, { screen: 'captions', header: `#${CHANNEL} . 0 captioned`, lines: [] }],
]
let k = 0
const next = () => { const [ms, screen] = steps[k]; lens.draw(screen); k = (k + 1) % steps.length; setTimeout(next, ms) }
next()
