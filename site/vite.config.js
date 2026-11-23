import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SITE } from './site.config.js'
import { nav, foot, head } from './src/partials.js'

const PAGES = { main: '', how: 'how-it-works/', privacy: 'privacy/', run: 'run/' }

const site = {
  name: 'quietseat-site',
  transformIndexHtml: (html, ctx) => {
    const path = ctx.path.replace(/index\.html$/, '')
    return html.replace('<!--head-->', head).replaceAll('%SITE%', SITE).replace('<!--nav-->', nav(path)).replace('<!--foot-->', foot)
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n` })
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.values(PAGES).map(p => `  <url><loc>${SITE}/${p}</loc></url>`).join('\n')}\n</urlset>\n` })
    const session = JSON.parse(readFileSync(resolve(import.meta.dirname, 'public/session.json'), 'utf8'))
    if (session.note) console.warn(`\n\x1b[41m\x1b[37m session.json is development data \x1b[0m ${session.note}\n`)
  },
}

export default defineConfig({
  plugins: [site],
  server: { fs: { allow: ['..'] } }, // the name rules are imported from ../bot/src
  build: { target: 'es2022', rollupOptions: { input: Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [k, resolve(import.meta.dirname, p, 'index.html')])) } },
})
