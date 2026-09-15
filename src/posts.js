// Drop a markdown file with frontmatter into src/posts/ to publish it.
//   title, date, author (comma-separated), description, order (higher = first), unreleased
const raw = import.meta.glob('./posts/*.md', { eager: true, query: '?raw', import: 'default' })

// Outline: every `## Heading` in a post becomes a section in the margin outline.
export const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const plain = (md) => md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim()
const sectionsOf = (body) =>
  [...body.matchAll(/^## +(.+)$/gm)].map(([, h]) => ({ id: slugify(plain(h)), label: plain(h) }))

const parse = (path, src) => {
  const [, fm = '', body = src] = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) || []
  const meta = Object.fromEntries(
    fm.split('\n').filter((l) => l.includes(':')).map((l) => {
      const i = l.indexOf(':')
      const v = l.slice(i + 1).trim()
      return [l.slice(0, i).trim(), v === 'true' ? true : v === 'false' ? false : v]
    }),
  )
  return { slug: path.split('/').pop().replace('.md', ''), ...meta, body, sections: sectionsOf(body) }
}

export const posts = Object.entries(raw)
  .map(([p, s]) => parse(p, s))
  .filter((p) => !p.unreleased)
  .sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0) || new Date(b.date) - new Date(a.date))

export const getPost = (slug) => posts.find((p) => p.slug === slug)
