import { loadSession, gsap, ScrollTrigger, reduced } from './common.js'
import { timeline, screenAt } from './replay.js'
import { makeLens } from './lens.js'
import { consentCard, esc } from './discord.js'
import { CHANNEL, WEARER, ALIASES, TIME_ZONE } from '../site.config.js'
import { mentions, isQuestion, addressed, calledBy } from '../../bot/src/names.js'
import { builtIn } from '../../bot/src/drafts.js'

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]

// ---- name tester, running the bot's own rules ----
const input = $('#say'), verdict = $('.verdict'), checks = $('.checks')
const examples = ['Hey Sudhi, are you free for the design review at 4?', 'Did Sudeep push the fix?', 'Sudip can you take the deploy tonight', 'Sudeepa, can you check the logs?', 'Sudeep pushed the fix this morning.', 'Any thoughts, Sudeep?']
$('.chips').innerHTML = examples.map(e => `<button type="button">${esc(e)}</button>`).join('')
$$('.chips button').forEach(b => b.addEventListener('click', () => { input.value = b.textContent; test() }))
function test() {
  const t = input.value, rows = [
    [mentions(t, ALIASES), 'Says one of your names'],
    [isQuestion(t), 'Is a question'],
    [addressed(t, ALIASES), 'Is said to you, not about you'],
  ]
  const hit = calledBy(t, ALIASES)
  checks.innerHTML = rows.map(([ok, label]) => `<li class="${ok ? 'yes' : ''}">${label}: ${ok ? 'yes' : 'no'}</li>`).join('')
  verdict.textContent = hit ? 'The glasses switch to this question.' : 'This stays a caption.'
  if (hit) checks.insertAdjacentHTML('beforeend', `<li class="yes">Built-in replies if the model is slow: ${builtIn(t).map(r => `“${esc(r)}”`).join(', ')}</li>`)
  if (!reduced) gsap.fromTo(checks.children, { opacity: 0, x: -8 }, { opacity: 1, x: 0, stagger: .06, duration: .35 })
}
input.addEventListener('input', test)
test()

// ---- screens drawn from the recorded call ----
const session = await loadSession()
const tl = timeline(session), E = tl.events, channel = session.channel || CHANNEL
$('[data-consent]').innerHTML = consentCard(session.wearer || WEARER)
const called = E.find(e => e.type === 'called'), tap = called && E.find(e => e.type === 'tap' && e.at > called.at)
const screens = {
  status: { screen: 'status', text: 'Quiet Seat\n\nConnecting...' },
  captions: screenAt(tl, called ? called.at - 1 : tl.duration, channel),
  called: called ? screenAt(tl, called.at + 10, channel) : null,
  'called-sel': called ? { ...screenAt(tl, called.at + 10, channel), sel: tap && tap.index > 0 ? tap.index : 1, pressed: false } : null, // show the ring moved off the first reply
  sent: { screen: 'sent', text: `Sent to #${channel}` },
}
const date = new Date(session.started).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE })
$$('[data-date]').forEach(el => (el.textContent = date))
const head = makeLens($('#head-lens')), t0 = performance.now()
gsap.ticker.add(() => head.draw(screenAt(tl, (performance.now() - t0) % tl.duration, channel)))
$$('canvas[data-screen]').forEach(c => { const s = screens[c.dataset.screen]; if (s) makeLens(c).draw(s) })

// scroll-linked: the screens grid tilts flat and settles as it scrolls into view
if (!reduced) $$('.screens figure').forEach((f, i) => gsap.fromTo(f, { rotateX: 18, y: 60, transformPerspective: 900 }, { rotateX: 0, y: 0, ease: 'none', scrollTrigger: { trigger: f, start: 'top 95%', end: 'top 45%', scrub: .5 } }))
ScrollTrigger.refresh()
