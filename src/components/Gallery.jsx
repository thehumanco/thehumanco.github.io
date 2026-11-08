// Blog screen: the About blurb, then every post as a painting-topped card.
// Scrolls like an ordinary page, so it holds 8 posts as happily as 3.
import { Link } from 'react-router-dom'
import { Content, TextLink } from './ui'

const API_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header'
const DATA_FORM = 'https://forms.gle/q4L2SrzejspumE819'

const pad = (n) => String(n).padStart(2, '0')
// "September 2026" -> "Sep 2026"
const shortDate = (d = '') => d.replace(/^([A-Za-z]{3})[a-z]+/, '$1')

function Cover({ src, label, date }) {
  const isVideo = /\.(mp4|webm|mov)$/i.test(src || '')
  return (
    <div className="grain relative aspect-[3/2] overflow-hidden rounded-lg bg-ink">
      <div className="painted absolute inset-0">
        {isVideo ? (
          <video src={src} className="h-full w-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="vignette" aria-hidden="true" />
      {/* Plate label, the way a gallery labels a work, on its own soft wash */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-ink/55 to-transparent"
        aria-hidden="true"
      />
      <span className="absolute bottom-3 left-4 z-10 type-small tabular-nums text-paper">{label}</span>
      <span className="absolute bottom-3 right-4 z-10 type-small tabular-nums text-paper">{date}</span>
    </div>
  )
}

export default function Gallery({ id, posts, footer }) {
  return (
    <section id={id} className="pt-24">
      <Content>
        <div className="mb-24">
          <p className="type-body">
            Grounded Superintelligence is a human-centric robotics platform, vertically integrated
            over operations, hardware, and AI models. We are a team of full-stack roboticists
            who believe that great robotics begins with great data at Internet scale. We are backed by Pieter
            Abbeel, Lerrel Pinto, Rob Fergus, Milan Kovac, Thomas Wolf, Naval Ravikant, and others.
          </p>
          <p className="type-body mt-4">
            Reach out to us at <TextLink href="mailto:hello@gsi.company">hello@gsi.company</TextLink>
            <span className="mx-2 text-muted"> · </span>
            <TextLink href={API_FORM}>Get an API invite code</TextLink>
            <span className="mx-2 text-muted"> · </span>
            <TextLink href={DATA_FORM}>Become a data partner</TextLink>
          </p>
        </div>

        <ul className="grid gap-x-8 gap-y-16 sm:grid-cols-2">
          {posts.map((p, i) => (
            <li key={p.slug} id={p.slug} className="scroll-mt-24">
              <Link to={`/blogs/${p.slug}`} className="group block">
                <Cover src={p.cover} label={pad(posts.length - i)} date={shortDate(p.date)} />
                <h3 className="type-card mt-5">{p.title}</h3>
                {p.description && <p className="type-body mt-2 text-muted">{p.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
        <div className="h-24" />
      </Content>
      {footer}
    </section>
  )
}
