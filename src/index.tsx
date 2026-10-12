import { type Context, Hono } from 'hono'
import { geocode, type Place } from './geocode'
import { Page } from './page'
import { distanceKm, filterOutlets, hasCoordinates, outlets, pick, states } from './outlets'

type Env = { Bindings: CloudflareBindings }

const app = new Hono<Env>()

app.get('/', (c) => c.html(<Page states={states} total={outlets.length} hasCoordinates={hasCoordinates} />))

type Filter = { state?: string; near?: { lat: number; lng: number; radiusKm: number }; origin?: Place }

/** Reads state, radius, and either lat/lng or a free-text `place` (geocoded) from the query string. */
async function parseFilter(c: Context<Env>): Promise<Filter | { error: string }> {
  const q = (key: string) => c.req.query(key)?.trim() || undefined
  const state = q('state')
  const radius = Number(q('radius') ?? 5)
  const radiusKm = Number.isFinite(radius) && radius > 0 ? Math.min(radius, 100) : 5

  const place = q('place')
  if (place) {
    const origin = await geocode(place, c.executionCtx)
    if (!origin) return { error: `Couldn't find "${place}" in Malaysia. Try a town, mall, or landmark.` }
    return { state, near: { lat: origin.lat, lng: origin.lng, radiusKm }, origin }
  }

  const lat = Number(q('lat'))
  const lng = Number(q('lng'))
  if (q('lat') && q('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { state, near: { lat, lng, radiusKm } }
  }
  return { state }
}

app.get('/api/outlets', async (c) => {
  const filter = await parseFilter(c)
  if ('error' in filter) return c.json(filter, 400)
  const pool = filterOutlets(filter)
  return c.json({ total: pool.length, outlets: pool })
})

app.get('/api/random', async (c) => {
  const filter = await parseFilter(c)
  if ('error' in filter) return c.json(filter, 400)
  const pool = filterOutlets(filter)
  if (pool.length === 0) {
    const where = filter.origin ? ` within ${filter.near?.radiusKm} km of ${filter.origin.label}` : ''
    return c.json({ error: `No ZUS outlets match that filter${where}. Try a bigger radius.` }, 404)
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
    origin: filter.origin?.label ?? null,
    poolSize: pool.length,
    // Names to flash through before landing on the pick.
    reel: [...pick(pool.filter((o) => o !== outlet), 15).map((o) => o.name), outlet.name],
  })
})

app.notFound((c) => c.redirect('/'))

export default app
