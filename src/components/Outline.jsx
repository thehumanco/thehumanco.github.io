// Outline: the index that hangs in the left margin beside the content body (xl screens).
// Titles on a rail; the active entry's title is green, and a green marker slides
// along the rail to it. Other titles darken on hover.
// Place inside a `relative` wrapper around the content it outlines. `sticky` keeps it in view
// while a long page (an essay) scrolls.
import { useLayoutEffect, useRef, useState } from 'react'

export default function Outline({ label, items, sticky = false }) {
  const listRef = useRef(null)
  const [marker, setMarker] = useState(null)
  const activeIndex = items.findIndex((item) => item.active)

  // Measure the active entry so the marker can slide to it (half the 12px gap above and below).
  useLayoutEffect(() => {
    const measure = () => {
      const li = listRef.current?.children[activeIndex]
      setMarker(li ? { top: li.offsetTop - 6, height: li.offsetHeight + 12 } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeIndex, items.length])

  // Hangs in the left margin on xl+; below that there's no margin for it, so it's hidden.
  return (
    <nav aria-label={label} className="hidden xl:block xl:absolute xl:right-full xl:inset-y-0 xl:mr-8 xl:w-44">
      <div className={sticky ? 'sticky top-1/2 -translate-y-1/2' : 'h-full flex items-start justify-end pt-1.5'}>
        <div className="relative">
          <ol ref={listRef} className="space-y-3 text-left pr-3">
            {items.map((item) => (
              <li key={item.key} className="relative">
                <button
                  onClick={item.onSelect}
                  className={`type-small !text-xs text-left cursor-pointer transition-colors duration-500 ${item.active ? '!text-accent' : 'hover:!text-ink'}`}
                >
                  {item.label}
                </button>
                {/* Grey rail segment for this entry (spans half the gap above and below) */}
                <span className="absolute -right-3 -inset-y-1.5 w-px bg-rule" />
              </li>
            ))}
          </ol>
          {marker && (
            <span
              className="absolute right-0 w-px bg-accent transition-[top,height] duration-500 ease-in-out"
              style={{ top: marker.top, height: marker.height }}
            />
          )}
        </div>
      </div>
    </nav>
  )
}
