import { ViteReactSSG } from 'vite-react-ssg'
import { routes, getRoutesToPrerender } from './routes'
import './index.css'

// Pages are rendered to HTML at build time and hydrated in the browser, so crawlers,
// link previews and anything that doesn't run JavaScript see the real content.
export const createRoot = ViteReactSSG({ routes })

// vite-react-ssg asks which dynamic routes to generate (one HTML file per post).
export function includedRoutes() {
  return getRoutesToPrerender()
}
