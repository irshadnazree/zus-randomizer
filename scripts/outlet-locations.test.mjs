import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { classifyOutlet } from './outlet-locations.mjs'
import { validateOutlets } from './outlet-data.mjs'

const classify = (name, address) => classifyOutlet('zus-coffee', { name, address })
const data = JSON.parse(readFileSync(new URL('../src/data/outlets.json', import.meta.url), 'utf8'))

test('numbered ground-floor mall premises stay in the building group', () => {
  assert.equal(classify('ZUS Coffee - Example Mall', 'No 3, Ground Floor, Example Shopping Mall, Jalan Maju, Johor').locationType, 'inside-building')
})

test('airports, hospitals, hotels, campuses and offices share one group', () => {
  for (const venue of ['International Airport', 'Specialist Hospital', 'Example Hotel', 'Example University', 'Corporate Office Tower']) {
    assert.equal(classify(`ZUS Coffee - ${venue}`, `Unit G-3, Ground Floor, ${venue}, Jalan Maju, Johor`).locationType, 'inside-building', venue)
  }
})

test('ordinary street shops and shoplots stay standalone', () => {
  assert.equal(classify('ZUS Coffee - Street Shop', 'No 12, Ground Floor, Jalan Maju 2, Johor').locationType, 'standalone-shop')
  assert.equal(classify('ZUS Coffee - Example Shoplot', 'Unit 8, Example Retail Shop, Jalan Maju, Johor').locationType, 'standalone-shop')
})

test('university, hospital and tower words in street names do not establish a host building', () => {
  for (const road of ['Jalan Universiti', 'Jalan Hospital', 'Jalan Menara Gading']) {
    assert.equal(classify('ZUS Coffee - Street Shop', `No 12, Ground Floor, ${road}, Johor`).locationType, 'standalone-shop', road)
  }
  assert.equal(classify('ZUS Coffee - Taman Universiti', 'No 8, Jalan Pendidikan 8, Taman Universiti, Johor').locationType, 'standalone-shop')
})

test('a drive-through in mall grounds stays separately accessed', () => {
  const location = classify('ZUS Coffee - Example Mall Drive Thru', 'Lot DT1, Example Mall, Jalan Maju, Johor')
  assert.equal(location.locationType, 'standalone-shop')
  assert.equal(location.locationTypeEvidence.basis, 'inferred')
})

test('reviewed mall-adjacent and mixed-use branches follow their actual address context', () => {
  const cases = [
    ['coffee-bean-tea-leaf', 'The Coffee Bean & Tea Leaf - Ampang Point', 'standalone-shop'],
    ['coffee-bean-tea-leaf', 'The Coffee Bean & Tea Leaf - Pandan Indah Shoplot', 'standalone-shop'],
    ['san-francisco-coffee', "San Francisco Coffee - Arcoris Mon't Kiara", 'inside-building'],
    ['san-francisco-coffee', 'San Francisco Coffee - St. Mary Place', 'inside-building'],
    ['san-francisco-coffee', 'San Francisco Coffee - Gamuda Walk', 'inside-building'],
    ['luckin-coffee', 'Luckin Coffee - Menara U Sek 13', 'inside-building'],
  ]
  for (const [chain, name, expected] of cases) {
    const row = data[chain].find((row) => row.name === name)
    assert.ok(row, name)
    assert.equal(classifyOutlet(chain, row).locationType, expected, name)
  }
})

test('an exact outlet exception does not follow the name to a different address', () => {
  const row = data['zus-coffee'].find((row) => row.name === 'ZUS Coffee - Found8 KL Sentral')
  assert.equal(classifyOutlet('zus-coffee', row).locationType, 'inside-building')
  const moved = { ...row, address: 'No 12, Ground Floor, Jalan Maju, Johor' }
  assert.equal(classifyOutlet('zus-coffee', moved).locationType, 'standalone-shop')
})

test('unresolved new outlets fail validation instead of being forced into a group', () => {
  const row = { name: 'New cafe', address: 'Location not specified', city: null, state: 'Johor', lat: null, lng: null }
  const location = classifyOutlet('zus-coffee', row)
  assert.equal(location.locationType, null)
  assert.throws(() => validateOutlets([{ ...row, ...location }]), /Unclassified outlet/)
})
