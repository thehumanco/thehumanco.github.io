import Layout, { Home, Post } from './App'
import { posts } from './posts'

export const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'blogs/:slug', element: <Post /> },
      { path: '*', element: <Home /> },
    ],
  },
]

// Which URLs to render to static HTML at build time.
export function getRoutesToPrerender() {
  return ['/', ...posts.map((p) => `/blogs/${p.slug}`)]
}
