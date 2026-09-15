import { useEffect, useLayoutEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Analytics } from '@vercel/analytics/react'
import logoUrl from './assets/logo.svg'
import logoGreenUrl from './assets/logo-green.svg'
import logoPaperUrl from './assets/logo-paper.svg'
import { posts, getPost, slugify } from './posts'
import FilmRoll from './components/FilmRoll'
import { alreadyStepped, gotoFrame, takeStep } from './film'
import { TextLink, Content, Display, Text, Meta } from './components/ui'
import Outline from './components/Outline'

// Always start at the top on refresh instead of restoring the old scroll position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// "blog" is the carousel screen: scroll to it and wind back to the newest post.
const scrollToId = (id, behavior = 'smooth', post) => {
  // "blog" winds the carousel to `post` (a slug) if given, otherwise the newest post.
  if (id === 'blog') gotoFrame(Math.max(0, posts.findIndex((p) => p.slug === post)), behavior === 'instant')
  document.getElementById(id === 'blog' ? 'film' : id)?.scrollIntoView({ behavior })
}

const NAV = [
  { label: 'Home', id: 'home' },
  { label: 'Blog', id: 'blog' },
  { label: 'API', href: 'https://app.gsi.company' },
  { label: 'RoboCap', href: 'https://robocap.io' },
]

function useSectionNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // On a post page, go home first, then scroll.
  return (id) => (e) => {
    e.preventDefault()
    if (pathname !== '/') navigate('/', { state: { scrollTo: id } })
    else if (id === 'home') window.scrollTo({ top: 0, behavior: 'smooth' })
    else scrollToId(id)
  }
}

function NavLinks() {
  const go = useSectionNav()
  return NAV.map((n) => (
    <TextLink key={n.label} variant="quiet" href={n.href ?? `/#${n.id}`} onClick={n.id && go(n.id)}>
      {n.label}
    </TextLink>
  ))
}

function Navbar() {
  const go = useSectionNav()
  return (
    <nav className="fixed top-4 inset-x-0 z-50">
      <Content>
        <div className="glass rounded-full pl-6 pr-8 h-16 flex items-center justify-between">
          <a href="/" onClick={go('home')} aria-label="Home" className="group type-body">
            <img src={logoUrl} alt="" className="size-[1.25em] group-hover:hidden" />
            <img src={logoGreenUrl} alt="" className="size-[1.25em] hidden group-hover:block" />
          </a>
          <div className="flex gap-4 sm:gap-8"><NavLinks /></div>
        </div>
      </Content>
    </nav>
  )
}

function Landing() {
  return (
    <section id="home" className="snap-start snap-always relative h-svh overflow-hidden bg-ink">
      {/* B-roll: full-screen, muted, looping. WebM (VP9) is smaller; MP4 (H.264) covers Safari/older browsers. */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        poster="/broll.jpg"
        autoPlay muted loop playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/broll.webm" type="video/webm" />
        <source src="/broll.mp4" type="video/mp4" />
      </video>
      {/* Paper-ink logo stamped over the footage, slowly dissolving */}
      <img
        src={logoPaperUrl}
        alt=""
        className="animate-logo-dissolve absolute inset-0 m-auto w-[min(24vw,24vh)] pointer-events-none"
      />
      <button
        onClick={() => scrollToId('film')}
        aria-label="Scroll down"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer text-paper/80 hover:text-paper animate-bounce text-2xl"
      >
        ↓
      </button>
    </section>
  )
}

// Placeholder art until posts set `cover:` (image or .mp4) in their frontmatter.
const MONETS = ['/thumbnails/water-lilies.jpg', '/thumbnails/parliament-sunset.jpg', '/thumbnails/impression-sunrise.jpg']

const FRAMES = posts.map((p, i) => ({
  id: p.slug,
  label: p.date,
  title: p.title,
  body: p.description,
  cover: p.cover || MONETS[i % MONETS.length],
  to: `/blogs/${p.slug}`,
}))

// On home the footer lives inside the second screen (see FilmRoll); elsewhere it ends the page.
function Footer({ home }) {
  return (
    <footer className={home ? 'border-t border-rule py-8' : 'border-t border-rule py-16'}>
      <Content>
        <Meta className="text-right">© {new Date().getFullYear()} Grounded Superintelligence</Meta>
      </Content>
    </footer>
  )
}

function SiteFooter() {
  return useLocation().pathname === '/' ? null : <Footer />
}

function Home() {
  const { state } = useLocation()
  useEffect(() => { document.title = 'GSI' }, [])
  // Arriving from another page: jump straight to the section before the first paint.
  useLayoutEffect(() => {
    if (state?.scrollTo && state.scrollTo !== 'home') {
      scrollToId(state.scrollTo, 'instant', state.post)
      // Clear it so a refresh doesn't scroll there again (history state survives reloads).
      window.history.replaceState({ ...window.history.state, usr: null }, '')
    } else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [state])
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('snap-screens')
    // Wheel/trackpad: one gesture = one screen (landing ↔ about, blog & footer). Touch uses CSS snapping.
    const screens = () => [...document.querySelectorAll('#home, #film')]
    let target = 0
    let targetUntil = 0
    const onWheel = (e) => {
      if (e.defaultPrevented) return // the carousel consumed it
      e.preventDefault()
      if (alreadyStepped(e) || !takeStep(e, 1)) return
      const els = screens()
      const tops = els.map((el) => el.getBoundingClientRect().top + window.scrollY)
      const cur = tops.reduce((b, t, i) => (Math.abs(t - window.scrollY) < Math.abs(tops[b] - window.scrollY) ? i : b), 0)
      const from = performance.now() < targetUntil ? target : cur
      target = Math.max(0, Math.min(els.length - 1, from + Math.sign(e.deltaY)))
      targetUntil = performance.now() + 800
      if (els[target].tagName === 'FOOTER') window.scrollTo({ top: html.scrollHeight, behavior: 'smooth' })
      else els[target].scrollIntoView({ behavior: 'smooth' })
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      html.classList.remove('snap-screens')
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
  return <><Landing /><FilmRoll id="film" frames={FRAMES} footer={<Footer home />} /></>
}

// Plain text of rendered heading children, to derive the same id as the outline.
const textOf = (node) =>
  typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : textOf(node?.props?.children ?? '')

// Which section the reader is in: the last `## heading` above 40% of the viewport.
function useActiveSection(sections) {
  const [active, setActive] = useState(sections[0]?.id)
  useEffect(() => {
    const onScroll = () => {
      let current = sections[0]?.id
      for (const { id } of sections) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])
  return active
}

function Post() {
  const post = getPost(useParams().slug)
  const sections = post?.sections ?? []
  const activeSection = useActiveSection(sections)
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = post ? `${post.title} — GSI` : 'GSI'
  }, [post])
  const back = <TextLink variant="quiet" to="/" state={{ scrollTo: 'blog', post: post?.slug }}>← Back to blog</TextLink>

  if (!post) return <Content className="pt-32 pb-16"><Text>Post not found. {back}</Text></Content>
  return (
    <article className="pt-32 pb-16">
      <Content>
        <div className="relative">
        {sections.length > 0 && (
          <Outline
            label="Sections"
            sticky
            items={sections.map((sec) => ({
              key: sec.id,
              label: sec.label,
              active: sec.id === activeSection,
              onSelect: () => document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' }),
            }))}
          />
        )}
        <div className="type-body mb-8">{back}</div>
        <Display>{post.title}</Display>
        <Meta className="mt-2">{post.author} · {post.date}</Meta>
        <div className="prose mt-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h2: ({ children }) => <h2 id={slugify(textOf(children))} className="scroll-mt-32">{children}</h2>,
              // External links and files (e.g. a PDF report) open in a new tab.
              a: ({ href, id, className, children }) => {
                const newTab = /^https?:/.test(href) || /\.pdf$/i.test(href)
                return <a href={href} id={id} className={className} {...(newTab && { target: '_blank', rel: 'noopener noreferrer' })}>{children}</a>
              },
              // Wide tables scroll sideways instead of stretching the page.
              table: ({ children }) => <div className="overflow-x-auto my-8"><table>{children}</table></div>,
            }}
          >
            {post.body}
          </ReactMarkdown>
        </div>
        <div className="type-body mt-16">{back}</div>
        </div>
      </Content>
    </article>
  )
}

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blogs/:slug" element={<Post />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <SiteFooter />
      <Analytics />
    </>
  )
}
