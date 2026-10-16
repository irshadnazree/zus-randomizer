import type { Outlet } from './outlets'

export function directions(outlet: Outlet) {
  const hasCoords = outlet.lat != null && outlet.lng != null
  const query = hasCoords ? `${outlet.lat},${outlet.lng}` : `${outlet.name}, ${outlet.address}`
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    waze: hasCoords
      ? `https://waze.com/ul?ll=${outlet.lat},${outlet.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(`${outlet.name} ${outlet.address}`)}&navigate=yes`,
  }
}
