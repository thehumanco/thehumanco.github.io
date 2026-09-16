// Design-system primitives. Compose pages from these instead of ad-hoc styling.
// Spacing scale: 1 · 2 · 4 · 8 · 16 · 32 (Tailwind units, i.e. 4–128px). Don't use values in between.
import { Link as RouterLink } from 'react-router-dom'

const cx = (...c) => c.filter(Boolean).join(' ')

const linkStyles = {
  // Body-text link: underlined; underline thickens and turns green on hover.
  inline: 'underline underline-offset-4 decoration-1 transition-colors hover:text-accent hover:decoration-2',
  // Navigation / quiet link: no underline until hover.
  quiet: 'underline-offset-4 decoration-1 transition-colors hover:underline hover:text-accent hover:decoration-2',
  // Navbar link: a warm pill marks the section you're on; the rest take one on hover.
  pill: 'rounded-full px-3 py-1.5 transition-colors hover:bg-ink/8 hover:font-medium',
  pillActive: 'rounded-full px-3 py-1.5 bg-ink/15 font-medium transition-colors',
  // Block link (cards, rows): no underline; children handle hover via group-hover.
  block: 'group block',
}

// Bold on hover without the text reflowing: a hidden bold copy reserves the wider width.
const Steady = ({ children }) => (
  <span className="grid">
    <span className="col-start-1 row-start-1 font-medium invisible" aria-hidden="true">{children}</span>
    <span className="col-start-1 row-start-1">{children}</span>
  </span>
)

export const TextLink = ({ href, to, variant = 'inline', className, children, ...rest }) => {
  const cls = cx(linkStyles[variant], className)
  if (variant === 'pill' || variant === 'pillActive') children = <Steady>{children}</Steady>
  if (to) return <RouterLink to={to} className={cls} {...rest}>{children}</RouterLink>
  const ext = /^https?:/.test(href)
  return (
    <a href={href} className={cls} {...(ext && { target: '_blank', rel: 'noopener noreferrer' })} {...rest}>
      {children}
    </a>
  )
}

export const Container = ({ className, children }) => (
  <div className={cx('w-full max-w-5xl mx-auto px-4 sm:px-8', className)}>{children}</div>
)

// Content body: centered, narrower on xl screens to leave room for the Outline in the margin.
// Home and essay pages share it so their margins match.
export const Content = ({ className, children }) => (
  <Container className={cx('relative xl:max-w-[min(58rem,calc(100vw-34rem))]', className)}>{children}</Container>
)

// Two-column section: small label in the margin, content on the right. Stacks on mobile.
export const Section = ({ id, label, className, children }) => (
  <section id={id} className={cx('scroll-mt-16 py-16 border-t border-rule', className)}>
    <Container className="grid gap-8 md:grid-cols-[12rem_1fr]">
      <h2 className="type-heading">{label}</h2>
      <div className="max-w-2xl">{children}</div>
    </Container>
  </section>
)

const tag = (as, cls) => ({ className, children, ...rest }) => {
  const Tag = as
  return <Tag className={cx(cls, className)} {...rest}>{children}</Tag>
}

export const Display = tag('h1', 'type-display')
export const Title = tag('h3', 'type-title')
export const Text = tag('p', 'type-body mb-4 last:mb-0')
export const Meta = tag('div', 'type-small')
