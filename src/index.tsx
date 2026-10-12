import { type Context, Hono } from 'hono'
import { geocode, type Place } from './geocode'
import { About } from './about'
import { Directory, NotFound } from './directory'
import { Page } from './page'
import { distanceKm, filterOutlets, hasCoordinates, outlets, pick, states } from './outlets'
import { SITE_URL, statePath } from './seo'

type Env = { Bindings: CloudflareBindings }

const app = new Hono<Env>()

// Normalize trailing slashes without sending local development requests to production.
app.use('*', async (c, next) => {
  const path = c.req.path
  if (path.length > 1 && path.endsWith('/') && (c.req.method === 'GET' || c.req.method === 'HEAD')) {
    const url = new URL(c.req.url)
    return c.redirect(`/${path.replace(/^\/+|\/+$/g, '')}${url.search}`, 301)
  }
  await next()
  if (c.res.headers.get('Content-Type')?.includes('text/html')) {
    c.header('Cache-Control', c.res.status === 200 ? 'public, max-age=0, must-revalidate' : 'no-store')
  }
})

app.get('/', (c) => {
  const selectedState = states.find((state) => state.name === c.req.query('state'))?.name
  return c.html(<Page states={states} total={outlets.length} hasCoordinates={hasCoordinates} selectedState={selectedState} />)
})

app.get('/about', (c) => c.html(<About />))

app.get('/outlets', (c) => c.html(<Directory />))
app.get('/outlets/:state', (c) => {
  const state = states.find((region) => statePath(region.name) === c.req.path)
  return state ? c.html(<Directory state={state.name} />) : c.html(<NotFound />, 404)
})

app.get('/robots.txt', (c) => {
  c.header('Cache-Control', 'public, max-age=3600')
  return c.text(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
})

app.get('/sitemap.xml', (c) => {
  const paths = ['/', '/about', '/outlets', ...states.map((state) => statePath(state.name))]
  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=3600')
  // No fabricated lastmod timestamps: URLs and counts always follow the saved dataset.
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`).join('')}</urlset>`)
})

// APIs are fetchable by crawlers, but should not compete with human-readable pages.
app.use('/api/*', async (c, next) => {
  c.header('X-Robots-Tag', 'noindex')
  await next()
})

type Filter = { state?: string; near?: { lat: number; lng: number; radiusKm: number }; origin?: Place; transit?: boolean }

/** Reads state, transit, radius, and either lat/lng or a free-text `place` (geocoded) from the query string. */
async function parseFilter(c: Context<Env>): Promise<Filter | { error: string }> {
  const q = (key: string) => c.req.query(key)?.trim() || undefined
  const state = q('state')
  const transit = q('transit') === 'true'
  const radius = Number(q('radius') ?? 5)
  const radiusKm = Number.isFinite(radius) && radius > 0 ? Math.min(radius, 100) : 5

  const place = q('place')
  if (place) {
    const origin = await geocode(place, c.executionCtx)
    if (!origin) return { error: `Couldn't find "${place}" in Malaysia. Try a town, mall, or landmark.` }
    return { state, transit, near: { lat: origin.lat, lng: origin.lng, radiusKm }, origin }
  }

  const lat = Number(q('lat'))
  const lng = Number(q('lng'))
  if (q('lat') && q('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { state, transit, near: { lat, lng, radiusKm } }
  }
  return { state, transit }
}

app.get('/api/outlets', async (c) => {
  const filter = await parseFilter(c)
  if ('error' in filter) return c.json(filter, 400)
  const pool = filterOutlets(filter)
  return c.json({ total: pool.length, outlets: pool })
})

app.get('/api/random', async (c) => {
  c.header('Cache-Control', 'no-store')
  const filter = await parseFilter(c)
  if ('error' in filter) return c.json(filter, 400)
  const pool = filterOutlets(filter)
  if (pool.length === 0) {
    const where = filter.origin ? ` within ${filter.near?.radiusKm} km of ${filter.origin.label}` : ''
    const suggestion = filter.transit
      ? 'Try another state, a bigger radius, or turn off the public transport filter.'
      : 'Try another state or a bigger radius.'
    return c.json({ error: `No ZUS outlets match that filter${where}. ${suggestion}` }, 404)
  }
  const [outlet] = pick(pool)
  const distance =
    filter.near && outlet.lat != null && outlet.lng != null
      ? distanceKm(filter.near.lat, filter.near.lng, outlet.lat, outlet.lng)
      : null
  return c.json({
    outlet,
    distanceKm: distance,
    origin: filter.origin?.label ?? null,
    poolSize: pool.length,
    // Names to flash through before landing on the pick.
    reel: [...pick(pool.filter((o) => o !== outlet), 15).map((o) => o.name), outlet.name],
  })
})

app.notFound((c) => {
  c.header('X-Robots-Tag', 'noindex')
  return c.html(<NotFound />, 404)
})

export default app
