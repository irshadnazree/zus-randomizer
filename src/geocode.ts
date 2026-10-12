export type Place = { label: string; lat: number; lng: number }

const USER_AGENT = 'zus-randomizer/1.0 (+https://kopi.ruxera.com)'
const CACHE_SECONDS = 60 * 60 * 24 * 7

async function nominatim(q: string): Promise<Place | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=my&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const [hit] = (await res.json()) as {
    name?: string
    display_name: string
    lat: string
    lon: string
    address?: Record<string, string>
  }[]
  if (!hit) return null
  const a = hit.address ?? {}
  const area = a.suburb ?? a.city ?? a.town ?? a.village ?? a.county ?? a.state
  const name = hit.name || hit.display_name.split(', ')[0]
  return { label: [name, area].filter((x, i, arr) => x && arr.indexOf(x) === i).join(', '), lat: Number(hit.lat), lng: Number(hit.lon) }
}

async function photon(q: string): Promise<Place | null> {
  // Bounding box around Malaysia (Peninsular + Borneo).
  const url = `https://photon.komoot.io/api/?limit=1&bbox=99.6,0.8,119.3,7.4&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const { features } = (await res.json()) as {
    features: { properties: { name?: string; city?: string; countrycode?: string }; geometry: { coordinates: [number, number] } }[]
  }
  const hit = features.find((f) => f.properties.countrycode === 'MY')
  if (!hit) return null
  const { name, city } = hit.properties
  const [lng, lat] = hit.geometry.coordinates
  return { label: [name, city].filter((x, i, a) => x && a.indexOf(x) === i).join(', ') || q, lat, lng }
}

/** Resolve free text like "Bangsar" or "Sunway Pyramid" to coordinates in Malaysia. Cached for a week. */
export async function geocode(query: string, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Place | null> {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120)
  const cacheKey = new Request(`https://kopi.ruxera.com/__geocode/v2?q=${encodeURIComponent(q)}`)
  const cache = caches.default
  const cached = await cache.match(cacheKey)
  if (cached) return cached.json()

  let place: Place | null
  try {
    place = await nominatim(q)
  } catch {
    place = await photon(q)
  }

  const response = new Response(JSON.stringify(place), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
  })
  ctx.waitUntil(cache.put(cacheKey, response))
  return place
}
