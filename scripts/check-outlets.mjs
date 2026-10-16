// Validate every chain before shipping or after refreshing the saved data.
import { readFile } from 'node:fs/promises'
import { chainIds, outletDataPath, validateOutlets } from './outlet-data.mjs'

const data = JSON.parse(await readFile(outletDataPath, 'utf8'))
if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Expected outlet groups keyed by coffee chain.')
for (const chain of chainIds) {
  const rows = data[chain]
  validateOutlets(rows)
  const inside = rows.filter((row) => row.locationType === 'inside-building').length
  const standalone = rows.filter((row) => row.locationType === 'standalone-shop').length
  const inferred = rows.filter((row) => row.locationTypeEvidence.basis === 'inferred').length
  console.log(`${chain}: ${rows.length} outlets, ${inside} inside buildings, ${standalone} standalone shops; ${inferred} inferred classifications; ${rows.filter((row) => row.lat !== null).length} with coordinates`)
}
