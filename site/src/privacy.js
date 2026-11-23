import { loadSession, gsap, reduced } from './common.js'
import { makeLens } from './lens.js'
import { consentCard } from './discord.js'
import { CHANNEL, WEARER } from '../site.config.js'

const $ = s => document.querySelector(s)
const session = await loadSession()
const wearer = session.wearer || WEARER, channel = session.channel || CHANNEL
$('[data-card]').innerHTML = consentCard(wearer, false).replace(/<div class="dc-btns">[\s\S]*$/, '')
$('[data-card-rec]').innerHTML = consentCard(wearer, true)

// The same person, opted in or not: live, the glasses name them but show no words. A recording drops even the name.
const line = session.events.find(e => e.type === 'caption') ?? { speaker: 'Sam', text: 'Can everyone see my screen?' }
const lens = makeLens($('#privacy-lens')), on = $('[data-on]'), off = $('[data-off]'), explain = $('[data-explain]')
function set(yes) {
  on.setAttribute('aria-pressed', yes); off.setAttribute('aria-pressed', !yes)
  lens.draw({ screen: 'captions', header: `#${channel} . ${yes ? 1 : 0} captioned`, lines: [yes ? `${line.speaker}: ${line.text}` : `${line.speaker} speaking (not captioned)`] })
  explain.textContent = yes
    ? `${line.speaker} pressed Caption me: their words reach the glasses about half a second after they finish.`
    : `${line.speaker} did not: the glasses show only that they are speaking. Their audio is never decoded.`
  if (!reduced) gsap.fromTo('#privacy-lens', { opacity: .3 }, { opacity: 1, duration: .4 })
}
on.addEventListener('click', () => set(true))
off.addEventListener('click', () => set(false))
set(true)
