// Blog screen: a carousel you scroll (left) that drives a flickering, grainy thumbnail (right).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, TextLink } from './ui'
import Outline from './Outline'
import { alreadyStepped, gotoFrame, takePendingFrame, takeStep } from '../film'

const pad = (n) => String(n).padStart(2, '0')

// One painting stretched across both panels (side by side on desktop, stacked on phones) (equal widths): each panel shows its
// share of an image spanning both panels plus the 2rem gap. Stacked on phones, each shows it whole.
// Keyed on src so the flick replays on change.
function Painting({ src, video, side }) {
  // Phones: panels stack (two 14rem panels, 1rem gap), so the painting spans 29rem tall.
  const cls = `animate-flick absolute w-full h-[29rem] md:top-0 md:h-full max-w-none object-cover ${side === 'left' ? 'top-0 md:left-0 md:w-[calc(200%+2rem)]' : 'bottom-0 md:left-auto md:right-0 md:w-[calc(200%+2rem)]'}`
  return (
    <div className="painted absolute inset-0" aria-hidden="true">
      {video
        ? <video key={src} src={src} className={cls} autoPlay muted loop playsInline />
        : <img key={src} src={src} alt="" className={cls} />}
    </div>
  )
}


export default function FilmRoll({ id, frames, footer }) {
  const navigate = useNavigate()
  const rollRef = useRef(null)
  const [active, setActive] = useState(0)
  const [offsets, setOffsets] = useState([])

  // Track which frame sits in the gate, and how far each frame is from it (for the drum curve).
  useEffect(() => {
    const roll = rollRef.current
    // Where the roll is heading (so settling doesn't pull it back mid-animation).
    let target = 0
    let targetUntil = 0
    const update = () => {
      const mid = roll.scrollTop + roll.clientHeight / 2
      const d = [...roll.children].slice(1, -1).map((el) => (el.offsetTop + el.offsetHeight / 2 - mid) / el.offsetHeight)
      setOffsets(d)
      // While winding to a post, it's already the active one (outline marker moves right away).
      setActive(performance.now() < targetUntil ? target : d.reduce((best, v, i) => (Math.abs(v) < Math.abs(d[best]) ? i : best), 0))
    }
    update()
    roll.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const frameEls = () => [...roll.children].slice(1, -1)
    const centerOn = (i, behavior = 'smooth') => {
      const el = frameEls()[i]
      if (el) roll.scrollTo({ top: el.offsetTop - (roll.clientHeight - el.offsetHeight) / 2, behavior })
    }
    const nearest = () => {
      const mid = roll.scrollTop + roll.clientHeight / 2
      const d = frameEls().map((el) => Math.abs(el.offsetTop + el.offsetHeight / 2 - mid))
      return d.indexOf(Math.min(...d))
    }
    const heading = () => (performance.now() < targetUntil ? target : nearest())
    const go = (i, instant = false) => {
      target = Math.max(0, Math.min(frameEls().length - 1, i))
      targetUntil = performance.now() + 700
      setActive(target)
      centerOn(target, instant ? 'instant' : 'smooth')
    }
    const goto = (e) => { takePendingFrame(); go(e.detail.index, e.detail.instant) }
    // A jump requested before this carousel mounted (coming back from an essay).
    const pending = takePendingFrame()
    if (pending) go(pending.index, true)

    // Wheel/trackpad: one swipe = one post. At either end, a new swipe hands off to the page.
    let lastMove = 0
    const onWheel = (e) => {
      const dir = Math.sign(e.deltaY)
      const from = heading()
      const atEnd = (dir < 0 && from === 0) || (dir > 0 && from === frameEls().length - 1)
      // Hand off to the page only on a clearly new swipe: trackpad momentum can look like a
      // fresh swipe, so keep swallowing for a moment after the carousel last moved.
      const settling = performance.now() - lastMove < 900
      if (atEnd && !settling && !alreadyStepped(e)) return
      e.preventDefault()
      if (!atEnd && takeStep(e)) { go(from + dir); lastMove = performance.now() }
      else if (settling) lastMove = Math.max(lastMove, performance.now() - 600) // still scrolling: extend
    }
    // Touch: one swipe = one post, matching the trackpad. A long drag keeps stepping every
    // SWIPE_AGAIN px, the way a big flick does on the wheel. At either end the page scrolls.
    const SWIPE = 28       // px of drag that commits the first step
    const SWIPE_AGAIN = 90 // px of further drag per extra step
    let touchY = 0
    let dragged = 0
    let touchSteps = 0
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY
      dragged = 0
      touchSteps = 0
    }
    const onTouchMove = (e) => {
      const y = e.touches[0].clientY
      const dy = touchY - y // dragging up scrolls down
      touchY = y
      const dir = Math.sign(dy)
      const from = heading()
      const atEnd = (dir < 0 && from === 0) || (dir > 0 && from === frameEls().length - 1)
      if (atEnd && touchSteps === 0) return // let the page take over
      e.preventDefault()
      if (atEnd) return
      dragged += dy
      const want = Math.abs(dragged) < SWIPE ? 0 : 1 + Math.floor((Math.abs(dragged) - SWIPE) / SWIPE_AGAIN)
      if (want > touchSteps) {
        touchSteps = want
        go(from + dir)
        lastMove = performance.now()
      }
    }
    // Keyboard / leftover scrolling: settle on a whole post once scrolling stops.
    let settle
    const onScroll = () => {
      clearTimeout(settle)
      settle = setTimeout(() => centerOn(heading()), 140)
    }
    window.addEventListener('film:goto', goto)
    roll.addEventListener('wheel', onWheel, { passive: false })
    roll.addEventListener('touchstart', onTouchStart, { passive: true })
    roll.addEventListener('touchmove', onTouchMove, { passive: false })
    roll.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      roll.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('film:goto', goto)
      roll.removeEventListener('wheel', onWheel)
      roll.removeEventListener('touchstart', onTouchStart)
      roll.removeEventListener('touchmove', onTouchMove)
      roll.removeEventListener('scroll', onScroll)
      clearTimeout(settle)
    }
  }, [])

  const cover = frames[active]?.cover
  const isVideo = /\.(mp4|webm|mov)$/i.test(cover || '')

  return (
    <section id={id} className="snap-start snap-always min-h-svh flex flex-col pt-24">
      <div className="flex-1 flex items-center pb-8">
      {/* Content body stays centered; the post index hangs in the left margin when there's room. */}
      <Content>
        {/* About spans both panels */}
        <div className="mb-16">
          <p className="type-body">
            Grounded Superintelligence is a human-centric robotics platform, vertically integrated
            over operations, hardware, and AI models. We are a team of full-stack roboticists
            who believe that great robotics begins with great data at Internet scale. We are backed by Pieter
            Abbeel, Lerrel Pinto, Rob Fergus, Milan Kovac, Thomas Wolf, Naval Ravikant, and others.
          </p>
          <p className="type-body mt-4">
            Reach out to us at <TextLink href="mailto:hello@gsi.company">hello@gsi.company</TextLink>
            <span className="mx-3 text-muted">·</span>
            <TextLink href="https://docs.google.com/forms/d/e/1FAIpQLSdhS6DJrr3Es1JmTYO9cbKfbrTtg8QuwaZKF_PQqaLSFTiotQ/viewform?usp=header">Get an API invite code</TextLink>
            <span className="mx-3 text-muted">·</span>
            <TextLink href="https://forms.gle/q4L2SrzejspumE819">Become a data partner</TextLink>
          </p>
        </div>
        <div className="relative">
        <Outline
          label="Posts"
          items={frames.map((f, i) => ({ key: f.id, label: f.title, active: i === active, onSelect: () => gotoFrame(i) }))}
        />
        <div className="grid gap-4 md:gap-8 md:grid-cols-2">
        {/* Carousel — sits on the left half of the painting */}
        <div className="grain relative h-56 md:h-auto md:aspect-[3/2] w-full min-w-0 md:max-h-[calc(100svh-27rem)] md:min-h-72 overflow-hidden rounded-lg bg-ink [perspective:900px]">
          <Painting src={cover} video={isVideo} side="left" />
          <div className="vignette" aria-hidden="true" />
          <div ref={rollRef} className="no-scrollbar relative h-full overflow-y-auto px-3 sm:px-5">
            <div className="h-[12.5%]" />
            {frames.map((f, i) => {
              const o = offsets[i] ?? i
              return (
                <div
                  key={f.id}
                  className="snap-center h-[75%] py-2"
                  style={{
                    transform: `rotateX(${Math.max(-60, Math.min(60, -o * 28))}deg)`,
                    opacity: Math.max(0.25, 1 - Math.abs(o) * 0.55),
                  }}
                >
                  <button
                    // Centered card opens the post; any other card winds the carousel to it.
                    onClick={() => {
                      if (i !== active || !f.to) return gotoFrame(i)
                      // Remember this post on the home entry, so Back returns to it in the carousel.
                      window.history.replaceState({ ...window.history.state, usr: { scrollTo: 'blog', post: f.id } }, '')
                      navigate(f.to)
                    }}
                    className={`group h-full w-full text-left rounded-sm p-4 sm:p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 ease-out cursor-pointer ${i === active ? 'bg-paper shadow-xl hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl' : 'bg-paper/60 hover:bg-paper/80'}`}
                  >
                    <span className="type-small tabular-nums">{pad(frames.length - i)}<span className="mx-3">·</span>{f.label}</span>
                    <span className="block type-card line-clamp-2 mb-1.5">{f.title}</span>
                    {/* Body fills the remaining space and fades out if it runs long */}
                    {f.body && (
                      <span className="block flex-1 min-h-0 overflow-hidden type-body [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                        {f.body}
                      </span>
                    )}
                    {f.to && (
                      <span className={`type-body ${i === active ? '' : 'invisible'}`}>
                        <span className="underline underline-offset-4 decoration-1 transition-colors group-hover:text-accent group-hover:decoration-2">Read</span>
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
            <div className="h-[12.5%]" />
          </div>
        </div>

        {/* Right half of the painting */}
        <div className="grain relative h-56 md:h-auto md:aspect-[3/2] w-full min-w-0 md:max-h-[calc(100svh-27rem)] md:min-h-72 overflow-hidden rounded-lg bg-ink">
          <Painting src={cover} video={isVideo} side="right" />
          <div className="vignette" aria-hidden="true" />
          <span className="absolute z-10 left-4 bottom-4 type-small text-paper/80 tabular-nums">
            {pad(frames.length - active)}/{pad(frames.length)}
          </span>
        </div>
        </div>
        </div>
      </Content>
      </div>
      {footer}
    </section>
  )
}
