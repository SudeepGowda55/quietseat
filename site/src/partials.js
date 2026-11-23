// Shared nav and footer, put into every page at build time by vite.config.js.
import { REPO } from '../site.config.js'

const LINKS = [['/', 'Story'], ['/how-it-works/', 'How it works'], ['/privacy/', 'Privacy'], ['/run/', 'Run it']]
const GH = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>'
export const MARK = '<svg class="mark" viewBox="0 0 40 24" aria-hidden="true"><rect x="1" y="1" width="38" height="22" rx="6" fill="#0b0a0b"/><rect x="7" y="8" width="17" height="2.2" rx="1.1" fill="#4cf05a"/><rect x="7" y="13.5" width="25" height="2.2" rx="1.1" fill="#2a9a37"/></svg>'

export const nav = path => `<header class="nav">
  <a class="brand" href="/" data-magnetic>${MARK}<span>Quiet Seat</span></a>
  <nav aria-label="Pages"><ul>${LINKS.map(([href, label]) => `<li><a href="${href}"${path === href ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}</ul></nav>
  <a class="gh" href="${REPO}" target="_blank" rel="noreferrer" aria-label="GitHub repository" data-magnetic>${GH}</a>
</header>`

export const foot = `<footer class="foot">
  <div class="foot-row">
    <a class="brand" href="/">${MARK}<span>Quiet Seat</span></a>
    <p>Built by team Matcrypt (Sudeep and Manvith) for the Heads Up: Even Realities hackathon, Messaging &amp; News track, on Even Realities G2 glasses and the R1 ring. MIT licence.</p>
    <a class="foot-gh" href="${REPO}" target="_blank" rel="noreferrer">Source on GitHub</a>
  </div>
</footer>
<div class="lens-wipe" aria-hidden="true"><p class="lens-wipe-text"></p></div>
<div class="caret" aria-hidden="true"><i></i><b><s></s><s></s><s></s><s></s><s></s></b></div>
<div class="sel-box" aria-hidden="true"></div>`

export const head = `<meta property="og:type" content="website">
<meta property="og:site_name" content="Quiet Seat">
<meta property="og:image" content="%SITE%/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta property="og:image:alt" content="Quiet Seat: the G2 glasses display replaying a Discord call">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="%SITE%/og.png">
<meta name="theme-color" content="#cfb3ad">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Abel&family=Atkinson+Hyperlegible+Mono:wght@400;500&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap" rel="stylesheet">
<script>try{if(sessionStorage.getItem('qs-arrive'))document.documentElement.classList.add('arriving')}catch(e){}</script>`
