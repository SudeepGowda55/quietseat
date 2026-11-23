import { gsap, ScrollTrigger, reduced, loadSession } from './common.js'
import { timeline, screenAt, clock } from './replay.js'
import { makeLens } from './lens.js'
import { WEARER, CHANNEL, TIME_ZONE, ALIASES } from '../site.config.js'
import { mentions } from '../../bot/src/names.js'
import { consentCard, replyMsg, author, esc } from './discord.js'

const worldReady = reduced ? null : import('./world.js') // start fetching the 3D chunk while the page sets up

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]

const session = await loadSession()
const tl = timeline(session)
const channel = session.channel || CHANNEL, wearer = session.wearer || WEARER
const date = new Date(session.started).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE })
$$('[data-date]').forEach(el => (el.textContent = date))
$$('[data-channel]').forEach(el => (el.textContent = channel))
const E = tl.events
const first = type => E.find(e => e.type === type)

// ?t=<ms into the real call> freezes both lenses at that moment (for screenshots)
const seekReal = new URLSearchParams(location.search).get('t')
const atOfReal = t => { let at = 0; E.forEach((e, i) => { if (e.t <= t) at = e.at + Math.min(t - e.t, (E[i + 1]?.at ?? Infinity) - e.at) }); return at }
const frozen = seekReal === null ? null : atOfReal(Number(seekReal))

// ---- discord pieces, exactly what the bot posts ----
const consent = consentCard(wearer)
const reply = m => replyMsg(wearer, m)

// ---- seats in the call bar: captioned speakers, then the people who did not opt in, then you ----
const speakers = [...new Set(E.flatMap(e => e.type === 'caption' ? [e.speaker] : e.type === 'called' ? [e.asker] : []).filter(Boolean))].slice(0, 4)
const someone = E.some(e => e.type === 'speaking') ? speakers.length : -1
const seats = [...speakers.map(name => ({ name, kind: 0 })), ...(someone >= 0 ? [{ name: 'Someone', kind: 1 }] : [])]
const bar = $('.call-bar')
bar.innerHTML = seats.map(s => `<div class="seat${s.kind ? ' off' : ''}"><span class="av">${esc(s.name[0])}</span>${esc(s.name)}</div>`).join('') +
  `<div class="seat you"><span class="av">${esc(wearer[0])}</span>you</div>`
const seatEls = $$('.seat', bar)
const REPLY = 5

function levelsAt(at) {
  const lv = seats.map(() => .2).concat([0, 0, 0, 0, 0, 0]).slice(0, 6) // a faint murmur from every seat
  for (const e of E) {
    if (e.type === 'caption') {
      const k = speakers.indexOf(e.speaker), d = Math.min(Math.max((e.text ?? '').length * 55, 900), 3200)
      if (k >= 0 && at > e.at - d - 450 && at < e.at - 250) lv[k] = 1
    } else if (e.type === 'speaking' && someone >= 0 && at >= e.at && at < e.at + 2200) lv[someone] = 1
    else if (e.type === 'tap' && at >= e.at && at < e.at + 1900) lv[REPLY] = 1
  }
  return lv
}

// ---- the stage lens: autonomous replay in the hero, scripted moments while the story is scrolled ----
const stageLens = makeLens($('#stage-lens'))
const called = first('called'), tap = E.find(e => e.type === 'tap' && called && e.at > called.at)
const askerIdx = called ? speakers.indexOf(called.asker) : -1
const chapterAt = {
  1: (first('speaking') ?? first('caption') ?? E[0])?.at + 150,
  2: called ? called.at - 1 : E.at(-1)?.at,
  3: called ? called.at + 60 : E.at(-1)?.at,
}
const store = { p: 0 }
let chapter = -1, heroStart = performance.now(), world = null, lastLevels = [], lastScreen = ''

if (called) {
  const q = esc(called.question).split(/(\s+)/).map(w => (mentions(w, ALIASES) ? `<mark>${w}</mark>` : w)).join('')
  $('[data-question]').innerHTML = `“${q}” <span class="label">${esc(called.asker)}</span>`
  $('[data-side="3"]').innerHTML = `${author('Drafted on the laptop', false)}<div class="small">${called.by === 'llm' ? 'by the 1.5B language model, checked for invented facts' : 'built-in replies (the model did not answer in time)'}</div>
    <ol style="margin:8px 0 0;padding-left:0;list-style:none">${called.replies.map((r, i) => `<li><span class="small">${['accept', 'decline', 'ask'][i]}</span> ${esc(r)}</li>`).join('')}</ol>`
}
$('[data-side="1"]').innerHTML = consent
if (tap) $('[data-side="4"]').innerHTML = reply({ to: called.asker, text: tap.reply ?? called.replies[tap.index] })

function setChapter(c) {
  if (c === chapter) return
  const prev = chapter; chapter = c
  const show = c === 0 ? $('.hero-copy') : $(`.chapter[data-ch="${c}"]`)
  const hide = prev === -1 ? $$('.chapter') : [prev === 0 ? $('.hero-copy') : $(`.chapter[data-ch="${prev}"]`)]
  gsap.to(hide, { autoAlpha: 0, y: -24, duration: .35, ease: 'power2.in', overwrite: true })
  gsap.fromTo(show, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .6, delay: prev === -1 ? 0 : .25, ease: 'power3.out', overwrite: true })
  $$('.side > *').forEach(el => gsap.to(el, { autoAlpha: Number(el.dataset.side) === c ? 1 : 0, y: Number(el.dataset.side) === c ? 0 : 12, duration: .45, delay: .2, overwrite: true }))
  gsap.to('.scroll-hint', { autoAlpha: c === 0 ? 1 : 0, duration: .3 })
  if (world && c === 3) { const r = $('#stage-lens').getBoundingClientRect(); world.ripple(r.left + r.width / 2, r.top + r.height / 2) }
}

function stageFrame() {
  const p = store.p
  setChapter(p < .55 ? 0 : Math.min(4, Math.floor(p + .45)))
  let at, lv
  if (chapter === 0) {
    at = frozen ?? (performance.now() - heroStart) % tl.duration
    lv = levelsAt(at)
  } else {
    if (chapter === 4 && tap) at = tap.at - 900 + Math.min(1, Math.max(0, p - 3.5)) * 1800
    else at = chapterAt[Math.min(chapter, 3)]
    const t = performance.now() / 1000
    lv = [0, 0, 0, 0, 0, 0]
    if (chapter === 1 && someone >= 0) lv[someone] = 1
    if (chapter === 2) speakers.forEach((_, k) => (lv[k] = Math.floor(t / 1.8) % speakers.length === k ? 1 : 0))
    if (chapter === 3 && askerIdx >= 0) lv[askerIdx] = .5
    if (chapter === 4) lv[REPLY] = 1
  }
  const s = screenAt(tl, at, channel)
  stageLens.draw(s)
  $('[data-clock]').textContent = clock(s.state.real)
  lv.forEach((v, i) => {
    if (i < seatEls.length - 1) seatEls[i].classList.toggle('talk', v > .5)
    if (world) {
      world.set(i, v)
      if (v > .5 && !(lastLevels[i] > .5) && i < seats.length) { const r = seatEls[i].querySelector('.av').getBoundingClientRect(); world.ripple(r.left + r.width / 2, r.top + r.height / 2) }
    }
  })
  if (world && s.screen === 'called' && lastScreen !== 'called') { const r = $('#stage-lens').getBoundingClientRect(); world.ripple(r.left + r.width / 2, r.top + r.height / 2) }
  lastScreen = s.screen; lastLevels = lv
}

// the story: the stage pins and scrolling walks it through consent, captions, the question and the tap
const stage = $('#stage')
gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top top', end: () => `+=${innerHeight * 4.2}`, pin: true, scrub: .6, invalidateOnRefresh: true,
  onUpdate: () => world?.story(store.p) } }).to(store, { p: 4.6, ease: 'none', duration: 4.6 })
gsap.ticker.add(stageFrame)

// ---- 3D world ----
function layoutWorld() {
  if (!world) return
  const lens = $('#stage-lens').getBoundingClientRect()
  const pts = seatEls.slice(0, seats.length).map((el, i) => { const r = el.querySelector('.av').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, kind: seats[i].kind } })
  const asker = askerIdx >= 0 ? pts[askerIdx] : pts[0]
  world.layout(pts, lens, asker)
}
if (worldReady) {
  worldReady.then(({ createWorld }) => {
    const canvas = $('.world')
    world = createWorld(canvas)
    layoutWorld()
    world.play()
    requestAnimationFrame(() => canvas.classList.add('on'))
    new IntersectionObserver(([e]) => (e.isIntersecting ? world.play() : world.pause())).observe(stage)
    addEventListener('resize', () => { world.resize(); layoutWorld() })
    ScrollTrigger.addEventListener('refresh', layoutWorld)
    document.fonts?.ready.then(layoutWorld)
  }).catch(err => console.warn('3D world unavailable', err))
}

// ---- replay player ----
const playerLens = makeLens($('#player-lens'))
const range = $('.track input'), fill = $('.track .fill'), head = $('.track .head'), clk = $('.clock'), msgs = $('.discord-msgs'), now = $('.now'), playBtn = $('.play')
range.max = tl.duration
$('.ticks').innerHTML = E.map(e => `<i class="tick ${e.type}" style="left:${(e.at / tl.duration) * 100}%"></i>`).join('')
let pAt = frozen ?? 0, playing = frozen === null, visible = false, lastT = performance.now(), chatKey = ''
const first1 = (wearer.split(' ')[0])
const say = e => !e ? '' : ({
  consent: () => `${e.captioned} ${e.captioned === 1 ? 'person' : 'people'} pressed Caption me.`,
  caption: () => `Captioned: ${e.speaker}.`,
  speaking: () => 'Someone who did not opt in is speaking: shown, not captioned.',
  called: () => `${e.asker} asked ${first1} by name. Replies by ${e.by === 'llm' ? 'the 1.5B model on the laptop' : 'the built-in set'}.`,
  tap: () => `Tapped on the R1 ring: posted to #${channel}.`,
})[e.type]?.() ?? ''

const pauseIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
const playIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z"/></svg>'
const setPlaying = v => { playing = v; playBtn.innerHTML = v ? pauseIcon : playIcon; playBtn.setAttribute('aria-label', v ? 'Pause' : 'Play') }
setPlaying(playing)
playBtn.addEventListener('click', () => setPlaying(!playing))
range.addEventListener('input', () => { pAt = Number(range.value) })

function playerFrame() {
  const t = performance.now(), dt = t - lastT; lastT = t
  if (playing && visible) pAt = (pAt + dt) % tl.duration
  const s = screenAt(tl, pAt, channel)
  playerLens.draw(s)
  const f = (pAt / tl.duration) * 100
  fill.style.width = `${f}%`; head.style.left = `${f}%`; range.value = pAt
  clk.textContent = `call time ${clock(s.state.real)}`
  const key = s.state.chat.length
  if (key !== chatKey) {
    chatKey = key
    msgs.innerHTML = `<div class="dc-card">${consent}</div>` + s.state.chat.map((m, i) => `<div class="dc-msg${i === s.state.chat.length - 1 ? ' fresh' : ''}">${reply(m)}</div>`).join('')
  }
  const line = say(E[s.state.i])
  if (now.textContent !== line) now.textContent = line
}
new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: .2 }).observe($('.player'))
gsap.ticker.add(playerFrame)

// ---- latency ruler: scroll speaks a sentence, then the caption and the question land at their measured times ----
const ruler = $('.ruler')
let rulerP = 0
function drawRuler() {
  const W = ruler.clientWidth, small = W < 600, H = small ? 220 : 250
  const x0 = 8, x1 = W - 8, xs = s => x0 + ((s + 2) / 5) * (x1 - x0) // -2 s .. 3 s
  const base = small ? 120 : 140, play = xs(-2 + rulerP * 5)
  let bars = ''
  for (let i = 0; i < 46; i++) {
    const s = -2 + (i / 46) * 2, x = xs(s), h = 10 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * .43)) * (small ? 44 : 70)
    bars += `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${Math.max(2, (x1 - x0) / 140).toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${x < play ? 'var(--ink)' : 'rgba(36,20,27,.18)'}"/>`
  }
  const on = s => play >= xs(s)
  const fs = small ? 12 : 13
  ruler.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${bars}
    <line x1="${x0}" x2="${x1}" y1="${base + 1}" y2="${base + 1}" stroke="var(--ink)" stroke-width="1.5"/>
    <line x1="${xs(0)}" x2="${xs(0)}" y1="${base - 100}" y2="${base + 40}" stroke="var(--ink)" stroke-dasharray="3 4"/>
    <text x="${xs(0) - 6}" y="${base + 34}" text-anchor="end" font-size="${fs}">sentence ends</text>
    <rect x="${xs(1.4)}" y="${base - 46}" width="${(xs(2.5) - xs(1.4)) * Math.min(1, Math.max(0, (play - xs(1.4)) / (xs(2.5) - xs(1.4))))}" height="40" rx="8" fill="var(--ink)"/>
    <rect x="${xs(1.4)}" y="${base - 46}" width="${xs(2.5) - xs(1.4)}" height="40" rx="8" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
    <text x="${xs(1.95)}" y="${base - 20}" text-anchor="middle" font-size="${fs}" style="fill:${play > xs(1.95) ? 'var(--velvet-light)' : 'var(--ink)'}">question + replies</text>
    <circle cx="${xs(.5)}" cy="${base - 26}" r="${on(.5) ? 9 : 4}" fill="${on(.5) ? 'var(--ink)' : 'none'}" stroke="var(--ink)" stroke-width="1.5"/>
    <text x="${xs(.5)}" y="${base - 46}" text-anchor="middle" font-size="${fs}">caption</text>
    ${[-2, -1, 0, 1, 2, 3].map(s => `<text x="${xs(s)}" y="${base + 62}" text-anchor="${s === -2 ? 'start' : s === 3 ? 'end' : 'middle'}" font-size="${fs}">${s > 0 ? '+' : ''}${s} s</text>`).join('')}
    <line x1="${play}" x2="${play}" y1="${base - 110}" y2="${base + 44}" stroke="var(--ink)" stroke-width="2"/>
  </svg>`
}
drawRuler()
addEventListener('resize', drawRuler)
ScrollTrigger.create({ trigger: ruler, start: 'top 85%', end: 'bottom 35%', scrub: .4, onUpdate: st => { rulerP = reduced ? 1 : st.progress; drawRuler() } })
if (reduced) { rulerP = 1; drawRuler() }
