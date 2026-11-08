import { useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Analytics } from '@vercel/analytics/react'
import logoUrl from './assets/logo.svg'
import logoBoldUrl from './assets/logo-bold.svg'
import logoPaperUrl from './assets/logo-paper.svg'
import { posts, getPost, slugify } from './posts'
import Gallery from './components/Gallery'
import { TextLink, Content, Display, Text, Meta } from './components/ui'
import Outline from './components/Outline'

// Always start at the top on refresh instead of restoring the old scroll position.
// (Guarded: pages are prerendered in Node, where there is no history.)
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

// "blog" is the gallery below the landing screen; `post` (a slug) targets one card in it.
const scrollToId = (id, behavior = 'smooth', post) => {
  const target = (id === 'blog' && post && document.getElementById(post)) || document.getElementById(id)
  target?.scrollIntoView({ behavior })
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

// Which nav item the reader is on: the landing screen or the blog screen on the home page,
// and nothing on an individual post (its own section outline marks where you are instead).
function useCurrentNav() {
  const { pathname } = useLocation()
  const [current, setCurrent] = useState('home')
  useEffect(() => {
    if (pathname !== '/') return setCurrent(null)
    const onScroll = () => {
      const film = document.getElementById('film')
      setCurrent(film && film.getBoundingClientRect().top < window.innerHeight * 0.5 ? 'blog' : 'home')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])
  return current
}

function NavLinks() {
  const go = useSectionNav()
  const current = useCurrentNav()
  return NAV.map((n) => (
    <TextLink
      key={n.label}
      variant={n.id && n.id === current ? 'pillActive' : 'pill'}
      href={n.href ?? `/#${n.id}`}
      onClick={n.id && go(n.id)}
    >
      {n.label}
    </TextLink>
  ))
}

function Navbar() {
  const go = useSectionNav()
  // The bar sits at the top of the page and scrolls away, rather than following the viewport.
  return (
    <nav className="absolute top-4 inset-x-0 z-50">
      <Content>
        <div className="glass rounded-full pl-6 pr-8 h-16 flex items-center justify-between">
          <a href="/" onClick={go('home')} aria-label="Home" className="group type-body">
            {/* Thicker strokes on hover, matching the nav links bolding */}
            <img src={logoUrl} alt="" className="size-[1.25em] group-hover:hidden" />
            <img src={logoBoldUrl} alt="" className="size-[1.25em] hidden group-hover:block" />
          </a>
          <div className="flex gap-1 sm:gap-2"><NavLinks /></div>
        </div>
      </Content>
    </nav>
  )
}

function Landing() {
  return (
    <section id="home" className="relative h-svh overflow-hidden bg-ink">
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
        onClick={() => scrollToId('blog')}
        aria-label="Scroll down"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer text-paper/80 hover:text-paper animate-bounce text-2xl"
      >
        ↓
      </button>
    </section>
  )
}

// Placeholder art until posts set `cover:` (image or .mp4) in their frontmatter.
// One painting per post (keyed by slug, so adding a post doesn't reshuffle the others).
const MONETS = {
  'robocap-10k': '/thumbnails/the-coalmen.jpg',
  'the-robocap-for-robot-learning': '/thumbnails/water-lilies.jpg',
  'the-human-centric-robotics-platform': '/thumbnails/parliament-sunset.jpg',
  'the-robotics-data-pareto-frontier': '/thumbnails/poppy-field.jpg',
  'the-human-company': '/thumbnails/impression-sunrise.jpg',
}

const FRAMES = posts.map((p) => ({
  ...p,
  cover: p.cover || MONETS[p.slug] || '/thumbnails/water-lilies.jpg',
}))

// On home the footer lives inside the second screen (see FilmRoll); elsewhere it ends the page.
// Small icons, drawn at the text's own size so they sit with the type.
const SOCIALS = [
  {
    label: 'Email us',
    href: 'mailto:hello@gsi.company',
    path: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    stroke: true,
  },
  {
    label: 'GSI on X',
    href: 'https://x.com/GroundedSI',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
]

function Footer({ home }) {
  return (
    <footer className={home ? 'py-8' : 'py-16'}>
      <Content>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                {...(/^https?:/.test(s.href) && { target: '_blank', rel: 'noopener noreferrer' })}
                className="text-muted transition-colors hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" {...(s.stroke
                  ? { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
                  : { fill: 'currentColor' })}>
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
          <Meta>© {new Date().getFullYear()} Grounded Superintelligence</Meta>
        </div>
      </Content>
    </footer>
  )
}

function SiteFooter() {
  return useLocation().pathname === '/' ? null : <Footer />
}

const SITE_DESCRIPTION =
  'Grounded Superintelligence is the human-centric robotics platform, vertically integrated over operations, hardware, and AI models.'

// Title, description and link-preview tags, rendered into the HTML at build time.
function PageHead({ title, description, url }) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:type" content={url === 'https://gsi.company/' ? 'website' : 'article'} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href={url} />
    </Head>
  )
}

function Home() {
  const { state } = useLocation()
  // Arriving from another page: jump straight to the section before the first paint.
  useLayoutEffect(() => {
    if (state?.scrollTo && state.scrollTo !== 'home') {
      scrollToId(state.scrollTo, 'instant', state.post)
      // Clear it so a refresh doesn't scroll there again (history state survives reloads).
      window.history.replaceState({ ...window.history.state, usr: null }, '')
    } else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [state])
  return (
    <>
      <PageHead title="GSI" description={SITE_DESCRIPTION} url="https://gsi.company/" />
      <Landing />
      <Gallery id="blog" posts={FRAMES} footer={<Footer home />} />
    </>
  )
}

// Plain text of rendered heading children, to derive the same id as the outline.
const textOf = (node) =>
  typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : textOf(node?.props?.children ?? '')

// Which section the reader is in: the last `## heading` above 40% of the viewport,
// or the title (TITLE_ID) before the first heading is reached.
const TITLE_ID = 'post-title'
function useActiveSection(sections) {
  const [active, setActive] = useState(TITLE_ID)
  useEffect(() => {
    const onScroll = () => {
      let current = TITLE_ID
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
  // Start at the top before the first paint, so the post never appears mid-scroll.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [post])
  const back = <TextLink variant="quiet" to="/" state={{ scrollTo: 'blog', post: post?.slug }}>← Back to blog</TextLink>

  if (!post) return <Content className="pt-32 pb-16"><Text>Post not found. {back}</Text></Content>
  return (
    <article className="pt-32 pb-16">
      <PageHead
        title={`${post.title} — GSI`}
        description={post.description || SITE_DESCRIPTION}
        url={`https://gsi.company/blogs/${post.slug}`}
      />
      <Content>
        <div className="relative">
        {sections.length > 0 && (
          <Outline
            label="Sections"
            sticky
            // The essay title leads the outline, then each `##` section.
            items={[
              { key: TITLE_ID, label: post.title, active: activeSection === TITLE_ID, onSelect: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
              ...sections.map((sec) => ({
                key: sec.id,
                label: sec.label,
                active: sec.id === activeSection,
                onSelect: () => document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' }),
              })),
            ]}
          />
        )}
        <div className="type-body mb-8">{back}</div>
        <Display id={TITLE_ID}>{post.title}</Display>
        <Meta className="mt-2">{post.author}<span className="mx-2"> · </span>{post.date}</Meta>
        <div className="prose mt-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h2: ({ children }) => <h2 id={slugify(textOf(children))} className="scroll-mt-32">{children}</h2>,
              // External links and standalone files/pages (a PDF, the report viewer) open in a new tab.
              a: ({ href, id, className, children }) => {
                const newTab = /^https?:/.test(href) || /\.(pdf|html)$/i.test(href)
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

// Shared chrome around every route (see routes.jsx).
export default function Layout() {
  return (
    <>
      <Navbar />
      <main><Outlet /></main>
      <SiteFooter />
      <Analytics />
    </>
  )
}

export { Home, Post }
