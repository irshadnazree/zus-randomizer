import data from './data/outlets.json'

export type Outlet = {
  name: string
  address: string
  city: string | null
  state: string
  lat: number | null
  lng: number | null
}

export const outlets = data as Outlet[]

export const states = [...new Set(outlets.map((o) => o.state))]
  .sort()
  .map((name) => ({ name, count: outlets.filter((o) => o.state === name).length }))

export const hasCoordinates = outlets.some((o) => o.lat != null && o.lng != null)

const toRad = (deg: number) => (deg * Math.PI) / 180

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

type Filter = { state?: string; near?: { lat: number; lng: number; radiusKm: number } }

export function filterOutlets({ state, near }: Filter) {
  return outlets.filter((o) => {
    if (state && o.state !== state) return false
    if (near) {
      if (o.lat == null || o.lng == null) return false
      if (distanceKm(near.lat, near.lng, o.lat, o.lng) > near.radiusKm) return false
    }
    return true
  })
}

export function pick<T>(items: T[], n = 1): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}
