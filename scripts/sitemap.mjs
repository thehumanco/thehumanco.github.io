// Writes dist/sitemap.xml and dist/robots.txt after the build, one URL per prerendered page.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SITE = 'https://gsi.company'
const postsDir = 'src/posts'
const dist = 'dist'

const isPublished = (src) => !/^unrelease[d]?:\s*true\s*$/m.test(src)
const slugs = readdirSync(postsDir)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => isPublished(readFileSync(join(postsDir, f), 'utf8')))
  .map((f) => f.replace(/\.md$/, ''))

const today = new Date().toISOString().slice(0, 10)
const urls = ['/', ...slugs.map((s) => `/blogs/${s}`)]
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`).join('\n')}
</urlset>
`
writeFileSync(join(dist, 'sitemap.xml'), xml)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
// Vercel serves 404.html for unknown paths; the app takes over from there.
writeFileSync(join(dist, '404.html'), readFileSync(join(dist, 'index.html'), 'utf8'))
console.log(`sitemap.xml: ${urls.length} urls`)
