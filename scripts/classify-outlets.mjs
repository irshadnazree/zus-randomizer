// Reclassify the saved snapshot without fetching outlets or changing base data.
import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { outletDataPath, chainIds, validateOutlets } from './outlet-data.mjs'
import { classifyOutlets } from './outlet-locations.mjs'

const data = JSON.parse(await readFile(outletDataPath, 'utf8'))
if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Expected grouped outlet data')
for (const chain of chainIds) {
  data[chain] = classifyOutlets(chain, data[chain])
  validateOutlets(data[chain])
}
const temporary = `${outletDataPath}.${process.pid}.tmp`
try {
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n')
  await rename(temporary, outletDataPath)
} finally {
  await rm(temporary, { force: true })
}
console.log(`Classified ${Object.values(data).flat().length} outlets into inside-building or standalone-shop.`)
