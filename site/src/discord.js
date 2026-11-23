// The two messages the bot posts in the call's chat (bot/src/index.js), shown the way Discord shows them.
import { MARK } from './partials.js'

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
export const author = (name = 'Quiet Seat', app = true) => `<div class="dc-who"><span class="dc-av">${MARK}</span>${name}${app ? ' <span class="dc-app">APP</span>' : ''}</div>`

export const consentCard = (wearer, recording = true) => `${author()}<div><b>Quiet Seat</b> shows live captions of this call on <b>${esc(wearer)}</b>'s glasses, because they can't play the audio right now. Speech is turned into text on their laptop; no audio or transcript is saved, and nothing leaves that laptop. Only people who press <b>Caption me</b> are captioned. You can stop any time.</div>
  ${recording ? `<div class="small" style="margin-top:6px"><b>This call is being recorded for Quiet Seat's public demo video and website:</b> only the captions of people who press Caption me, the question, the replies and the tap. People who do not opt in appear only as "Someone speaking".</div>` : ''}
  <div class="dc-btns"><span class="primary">Caption me</span><span>No thanks / stop</span></div>`

export const replyMsg = (wearer, m) => `${author()}<div><b>${esc(wearer)}</b> (via Quiet Seat, to <span class="dc-mention">@${esc(m.to)}</span>): ${esc(m.text)}</div>`
