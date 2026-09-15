// Jump the carousel to a post from elsewhere (margin index, navbar).
// `instant` jumps without animating. The last request is remembered so a carousel that mounts
// afterwards (e.g. arriving on the home page from an essay) can start on that post.
let pendingFrame = null
export const gotoFrame = (index, instant = false) => {
  pendingFrame = { index, instant }
  window.dispatchEvent(new CustomEvent('film:goto', { detail: pendingFrame }))
}
export const takePendingFrame = () => {
  const p = pendingFrame
  pendingFrame = null
  return p
}

// Wheel gesture handling shared by the carousel and the page.
//
// A gesture is a run of wheel events with no pause longer than PAUSE_MS (a trackpad swipe plus
// its momentum tail, or a burst of mouse-wheel notches). Its first event takes one step, so an
// ordinary swipe lands on exactly one post. Only a big flick earns more: one extra step each
// time the gesture's total travel passes another FLICK_EVERY px beyond FLICK_START.
// Direction reversal always starts a new gesture, and so does a fresh swipe landing on top of
// the previous one's momentum tail: a sudden surge well above the recent (decaying) deltas.
const PAUSE_MS = 200      // gap between events that ends a gesture
const FLICK_START = 1600  // px of travel before a gesture can take a second step
const FLICK_EVERY = 900   // px of further travel per extra step
const MIN_STEP_MS = 180   // spacing between steps within one flick
const SURGE_RATIO = 3.5   // delta this many times the recent minimum = a new swipe
const SURGE_MIN = 6       // ...and at least this big (ignores jitter)
const SURGE_AGE_MS = 250  // ...and the current gesture is at least this old
const WINDOW = 8          // recent deltas remembered

let lastEvent = null
let lastTime = 0
let lastDir = 0
let travelled = 0
let steps = 0
let lastStep = 0
let gestureStart = 0
let recent = []

const observe = (e) => {
  if (e === lastEvent) return // the carousel and page listeners see the same event
  lastEvent = e
  const now = performance.now()
  const dir = Math.sign(e.deltaY)
  const abs = Math.abs(e.deltaY)
  const surge = recent.length >= 3 && abs >= SURGE_MIN && abs > SURGE_RATIO * Math.min(...recent) && now - gestureStart > SURGE_AGE_MS
  if (now - lastTime > PAUSE_MS || (dir && dir !== lastDir) || surge) {
    travelled = 0
    steps = 0
    gestureStart = now
    recent = []
  }
  recent = [...recent.slice(-(WINDOW - 1)), abs]
  lastTime = now
  if (dir) lastDir = dir
  travelled += abs
}

const allowedSteps = (max) =>
  Math.min(max, 1 + Math.max(0, Math.floor((travelled - FLICK_START) / FLICK_EVERY) + (travelled >= FLICK_START ? 1 : 0)))

// True when the caller should take a step now. `max` caps steps per gesture (the page uses 1).
export const takeStep = (e, max = Infinity) => {
  observe(e)
  const now = performance.now()
  if (Math.abs(e.deltaY) < 1 || steps >= allowedSteps(max)) return false
  if (steps > 0 && now - lastStep < MIN_STEP_MS) return false
  steps += 1
  lastStep = now
  return true
}

// True if this event belongs to a gesture that already stepped (so it should be swallowed).
export const alreadyStepped = (e) => {
  observe(e)
  return steps > 0
}
