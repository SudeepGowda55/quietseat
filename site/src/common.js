// Shared on every page: smooth scroll, the lens-takeover page transition, the caret cursor, caption-cadence headlines.
import './styles.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)
export { gsap, ScrollTrigger }
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const og = new URLSearchParams(location.search).has('og') // link-preview render: no cursor, no dev badge
if (og) document.documentElement.classList.add('og')
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !og

// smooth scroll on gsap's ticker, wired to ScrollTrigger
export let lenis = null
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085 })
  window.__lenis = lenis
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(t => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
}
const onScroll = () => document.documentElement.classList.toggle('scrolled', scrollY > 30)
addEventListener('scroll', onScroll, { passive: true }); onScroll()
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const el = document.querySelector(a.getAttribute('href'))
  if (!el) return
  e.preventDefault()
  lenis ? lenis.scrollTo(el, { offset: -20 }) : el.scrollIntoView()
}))

// caption-cadence reveal: words arrive at speaking pace, faint first, then set, with a caret leading
function caption(el) {
  if (el.dataset.done) return
  el.dataset.done = 1
  const words = []
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment()
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return
        if (/^\s+$/.test(part)) return frag.append(part) // spaces stay outside the word boxes
        const w = document.createElement('span'); w.className = 'w'; w.textContent = part; frag.append(w); words.push(w)
      })
      n.replaceWith(frag)
    } else if (n.nodeType === 1) walk(n)
  })
  walk(el)
  if (reduced) return words.forEach(w => w.classList.add('set'))
  const caret = document.createElement('span'); caret.className = 'cc'; caret.setAttribute('aria-hidden', 'true')
  let t = 120
  words.forEach((w, i) => {
    setTimeout(() => { w.classList.add('heard'); w.after(caret) }, t)
    setTimeout(() => w.classList.add('set'), t + 260)
    t += 90 + w.textContent.length * 34 + (/[,.?!:]$/.test(w.textContent) ? 260 : 0)
    if (i === words.length - 1) setTimeout(() => caret.remove(), t + 700)
  })
}
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return
  if (e.target.matches('[data-caption]')) caption(e.target); else e.target.classList.add('in')
  io.unobserve(e.target)
}), { rootMargin: '0px 0px -8% 0px' })
export const watch = root => root.querySelectorAll('[data-caption], .rv').forEach(el => io.observe(el))
watch(document)

// press feedback: an R1-ring tap ripple inside buttons
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn, .play')
  if (!b || reduced) return
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2
  const dot = document.createElement('span'); dot.className = 'tap'
  Object.assign(dot.style, { left: `${e.clientX - r.left}px`, top: `${e.clientY - r.top}px`, width: `${s}px`, height: `${s}px` })
  b.append(dot); setTimeout(() => dot.remove(), 600)
})

// lens takeover: a black G2 display opens from the clicked link, types where you are going, then the new page closes it
const wipe = document.querySelector('.lens-wipe'), wipeText = document.querySelector('.lens-wipe-text')
const typeInto = (text, ms) => new Promise(res => {
  let i = 0
  const step = () => { wipeText.textContent = text.slice(0, ++i); i < text.length ? setTimeout(step, ms) : res() }
  step()
})
const pageName = href => ({ '/': 'Story', '/how-it-works/': 'How it works', '/privacy/': 'Privacy', '/run/': 'Run it' })[new URL(href, location.href).pathname] ?? 'Quiet Seat'
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]')
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return
  const url = new URL(a.href, location.href)
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname) return
  e.preventDefault()
  if (reduced) return void (location.href = url.href)
  const x = e.clientX || innerWidth / 2, y = e.clientY || innerHeight / 2
  const w = 120, h = 60, top = y - h / 2, left = x - w / 2
  wipeText.textContent = ''
  gsap.set(wipe, { visibility: 'visible', clipPath: `inset(${top}px ${innerWidth - left - w}px ${innerHeight - top - h}px ${left}px round 14px)` })
  gsap.to(wipe, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: .55, ease: 'power3.inOut', onComplete: async () => {
    await typeInto(`#${pageName(url.href)}\n> opening`, 22)
    try { sessionStorage.setItem('qs-arrive', pageName(url.href)) } catch {}
    location.href = url.href
  } })
})
if (document.documentElement.classList.contains('arriving')) {
  let name = ''
  try { name = sessionStorage.getItem('qs-arrive') || ''; sessionStorage.removeItem('qs-arrive') } catch {}
  wipeText.textContent = `#${name}\n> opening`
  gsap.set(wipe, { visibility: 'visible', clipPath: 'inset(0px 0px 0px 0px round 0px)' })
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('arriving')
    const cx = innerWidth / 2, cy = innerHeight * .42
    gsap.to(wipe, { clipPath: `inset(${cy}px ${cx - 1}px ${innerHeight - cy - 2}px ${cx - 1}px round 14px)`, duration: .7, delay: .18, ease: 'power3.inOut', onComplete: () => gsap.set(wipe, { visibility: 'hidden' }) })
  })
}
addEventListener('pageshow', e => { if (e.persisted) gsap.set(wipe, { visibility: 'hidden' }) }) // back/forward cache

// caret cursor: a text caret with a voice level that rises with pointer speed; over a control it becomes
// the rounded selection box the G2 draws around the chosen reply
if (fine && !reduced) {
  document.documentElement.classList.add('has-caret')
  const caret = document.querySelector('.caret'), bars = [...caret.querySelectorAll('s')], box = document.querySelector('.sel-box')
  let x = innerWidth / 2, y = innerHeight / 2, px = x, py = y, cx = x, cy = y, level = 0, target = null
  const boxState = { x: 0, y: 0, w: 0, h: 0 }
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY })
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a, button, input, [data-magnetic], .track')
    target = t
    box.classList.toggle('show', !!t)
    box.classList.toggle('on-dark', !!t?.closest('.discord, .dc-card, .cmd, .lens-frame'))
  })
  addEventListener('pointerdown', e => {
    box.classList.add('press'); setTimeout(() => box.classList.remove('press'), 180)
    const r = document.createElement('div'); r.className = 'ring-tap'; r.style.left = `${e.clientX}px`; r.style.top = `${e.clientY}px`
    document.body.append(r); setTimeout(() => r.remove(), 520)
  })
  gsap.ticker.add(() => {
    const speed = Math.hypot(x - px, y - py); px = x; py = y
    level += (Math.min(speed / 26, 1) - level) * .18
    cx += (x - cx) * .5; cy += (y - cy) * .5
    caret.style.transform = `translate(${cx}px, ${cy}px)`
    bars.forEach((b, i) => { b.style.height = `${2 + level * 12 * (0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 90 + i * 1.7)))}px` })
    caret.style.opacity = target ? 0 : ''
    if (target) {
      const r = target.getBoundingClientRect(), pad = 6
      boxState.x += (r.left - pad - boxState.x) * .3; boxState.y += (r.top - pad - boxState.y) * .3
      boxState.w += (r.width + pad * 2 - boxState.w) * .3; boxState.h += (r.height + pad * 2 - boxState.h) * .3
    } else { boxState.x = x - 10; boxState.y = y - 12; boxState.w = 20; boxState.h = 24 }
    box.style.transform = `translate(${boxState.x}px, ${boxState.y}px)`
    box.style.width = `${boxState.w}px`; box.style.height = `${boxState.h}px`
  })
  // magnetic controls
  document.querySelectorAll('[data-magnetic], .btn, .play').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect()
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * .22, y: (e.clientY - r.top - r.height / 2) * .3, duration: .35, ease: 'power3.out' })
    })
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, .45)' }))
  })
}

// session.json loader shared by pages that show the recorded call
export async function loadSession() {
  const session = await (await fetch('/session.json', { cache: 'no-cache' })).json()
  if (session.note) document.documentElement.classList.add('is-dev')
  return session
}
