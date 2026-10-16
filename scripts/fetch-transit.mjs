#!/usr/bin/env node
// Refresh nearby public transport from OpenStreetMap. Node 20+, no dependencies.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outletsByChain = JSON.parse(await readFile(new URL('../src/data/outlets.json', import.meta.url), 'utf8'))
// The current randomizer and transport snapshot cover ZUS Coffee.
const outlets = outletsByChain['zus-coffee']
const maxDistanceKm = 0.5
const query = `[out:json][timeout:90];
area["ISO3166-1"="MY"]["admin_level"="2"]->.my;
(
  nwr["highway"="bus_stop"](area.my);
  nwr["amenity"="bus_station"](area.my);
  nwr["railway"~"^(station|halt|tram_stop)$"](area.my);
  nwr["public_transport"="platform"]["bus"="yes"](area.my);
);out center tags;`

// An optional raw Overpass response allows reproducible offline regeneration.
const input = process.argv[2]
let data
if (input) {
  data = JSON.parse(await readFile(input, 'utf8'))
} else {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'zus-randomizer/1.0 (+https://zus.ruxera.com)' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error(`Overpass ${response.status}; existing data was not changed.`)
  data = await response.json()
}
if (data.remark || !Array.isArray(data.elements) || !data.elements.length) {
  throw new Error(`Incomplete Overpass response: ${data.remark ?? 'no stops'}; existing data was not changed.`)
}

const stops = data.elements.flatMap((element) => {
  const tags = element.tags ?? {}
  if (['disused', 'abandoned', 'construction', 'proposed'].some((key) => tags[key] === 'yes') || tags.access === 'private') return []
  const { lat, lon: lng } = element.center ?? element
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const type = ['station', 'halt', 'tram_stop'].includes(tags.railway) ? 'rail' : 'bus'
  // Exclude freight-only stations.
  if (type === 'rail' && (tags.usage === 'industrial' || tags.usage === 'military' || tags.freight === 'yes' && tags.passenger === 'no')) return []
  return [{ id: `${element.type}/${element.id}`, name: tags['name:en'] || tags.name || tags.ref || (type === 'rail' ? 'Train station' : 'Bus stop'), type, lat, lng }]
})

function distanceKm(a, b) {
  const rad = (degrees) => degrees * Math.PI / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

const matches = outlets.flatMap((outlet) => {
  if (outlet.lat == null || outlet.lng == null) return []
  let nearest = null
  let distance = maxDistanceKm
  for (const stop of stops) {
    // Skip distant stops before calculating the great-circle distance.
    if (Math.abs(stop.lat - outlet.lat) > 0.005 || Math.abs(stop.lng - outlet.lng) > 0.005) continue
    const km = distanceKm(outlet, stop)
    if (km <= distance) { nearest = stop; distance = km }
  }
  return nearest ? [{ outlet: { name: outlet.name, lat: outlet.lat, lng: outlet.lng }, stop: nearest, distanceKm: distance }] : []
})
if (!matches.length) throw new Error('No nearby stops found; existing data was not changed.')

const output = new URL('../src/data/transit.json', import.meta.url)
await writeFile(output, JSON.stringify({
  source: 'https://www.openstreetmap.org',
  license: 'ODbL-1.0',
  updatedAt: data.osm3s?.timestamp_osm_base ?? new Date().toISOString(),
  maxDistanceKm,
  matches,
}, null, 2) + '\n')
console.log(`Matched ${matches.length}/${outlets.length} outlets to ${stops.length} mapped stops. Wrote ${fileURLToPath(output)}`)
