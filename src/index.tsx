import { Hono } from 'hono'
import { Page } from './page'
import { distanceKm, filterOutlets, hasCoordinates, outlets, pick, states } from './outlets'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/', (c) => c.html(<Page states={states} total={outlets.length} hasCoordinates={hasCoordinates} />))

function parseFilter(q: (key: string) => string | undefined) {
  const state = q('state') || undefined
  const lat = Number(q('lat'))
  const lng = Number(q('lng'))
  const radiusKm = Number(q('radius') ?? 5)
  const near =
    q('lat') && q('lng') && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, radiusKm: Number.isFinite(radiusKm) && radiusKm > 0 ? Math.min(radiusKm, 100) : 5 }
      : undefined
  return { state, near }
}

app.get('/api/outlets', (c) => {
  const pool = filterOutlets(parseFilter((k) => c.req.query(k)))
  return c.json({ total: pool.length, outlets: pool })
})

app.get('/api/random', (c) => {
  const filter = parseFilter((k) => c.req.query(k))
  const pool = filterOutlets(filter)
  if (pool.length === 0) {
    return c.json({ error: 'No ZUS outlets match that filter.' }, 404)
  }
  const [outlet] = pick(pool)
  const distance =
    filter.near && outlet.lat != null && outlet.lng != null
      ? distanceKm(filter.near.lat, filter.near.lng, outlet.lat, outlet.lng)
      : null
  c.header('Cache-Control', 'no-store')
  return c.json({
    outlet,
    distanceKm: distance,
    poolSize: pool.length,
    // Names to flash through before landing on the pick.
    reel: [...pick(pool.filter((o) => o !== outlet), 15).map((o) => o.name), outlet.name],
  })
})

app.notFound((c) => c.redirect('/'))

export default app
