// Shared grouped-dataset writer. Each refresh replaces only its own chain.
import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { classifyOutlets, locationTypes, evidenceBases } from './outlet-locations.mjs'

export const outletDataPath = fileURLToPath(new URL('../src/data/outlets.json', import.meta.url))
export const chainIds = ['zus-coffee', 'luckin-coffee', 'coffee-bean-tea-leaf', 'san-francisco-coffee']
export const states = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya', 'Labuan']

export function validateOutlets(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('No outlets; existing data was not changed.')
  const seen = new Set()
  for (const row of rows) {
    if (typeof row.name !== 'string' || !row.name.trim() || typeof row.address !== 'string' || !row.address.trim()
      || !states.includes(row.state) || !(row.city === null || typeof row.city === 'string')) {
      throw new Error(`Invalid outlet: ${JSON.stringify(row)}`)
    }
    if (!locationTypes.includes(row.locationType)) {
      throw new Error(`Unclassified outlet: ${row.name}. Review its name/address and add a venue or exact outlet override before refreshing.`)
    }
    const evidence = row.locationTypeEvidence
    if (!evidence || !evidenceBases.includes(evidence.basis) || evidence.basis === 'unknown'
      || typeof evidence.detail !== 'string' || !evidence.detail.trim()
      || evidence.sourceUrl !== undefined && !/^https?:\/\//.test(evidence.sourceUrl)) {
      throw new Error(`Invalid location evidence: ${row.name}`)
    }
    const noCoords = row.lat === null && row.lng === null
    if (!noCoords && !(Number.isFinite(row.lat) && Number.isFinite(row.lng)
      && row.lat >= 0.5 && row.lat <= 7.5 && row.lng >= 99 && row.lng <= 120)) {
      throw new Error(`Invalid Malaysian coordinates: ${row.name}`)
    }
    const key = JSON.stringify([row.name.toLowerCase(), row.address.toLowerCase()])
    if (seen.has(key)) throw new Error(`Duplicate outlet: ${row.name}`)
    seen.add(key)
  }
}

export async function writeOutletChain(chainId, rows) {
  if (!chainIds.includes(chainId)) throw new Error(`Unknown chain: ${chainId}`)
  rows = classifyOutlets(chainId, rows)
  validateOutlets(rows)
  let data
  try {
    data = JSON.parse(await readFile(outletDataPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    data = {}
  }
  // Migrate the original ZUS-only array on its first refresh.
  if (Array.isArray(data)) data = { 'zus-coffee': data }
  if (!data || typeof data !== 'object') throw new Error('Invalid grouped outlet dataset.')
  data[chainId] = [...rows].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name))
  const ordered = Object.fromEntries(chainIds.filter((id) => data[id]).map((id) => [id, data[id]]))
  const temporary = `${outletDataPath}.${process.pid}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(ordered, null, 2) + '\n')
    await rename(temporary, outletDataPath)
  } finally {
    await rm(temporary, { force: true })
  }
}
