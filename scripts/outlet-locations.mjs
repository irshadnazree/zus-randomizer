// Classify venue context, not whether the cafe is a detached building.
// Street-facing shoplots count as standalone shops. Ground floor alone does
// not prove standalone: named host venues are considered first.
import { readFileSync } from 'node:fs'

export const locationTypes = ['inside-building', 'standalone-shop']
export const evidenceBases = ['address', 'official-venue', 'inferred', 'unknown']
const overrides = JSON.parse(readFileSync(new URL('../src/data/outlet-location-overrides.json', import.meta.url), 'utf8'))
const venues = JSON.parse(readFileSync(new URL('../src/data/outlet-location-venues.json', import.meta.url), 'utf8'))
for (const entry of [...overrides, ...venues]) {
  if (!locationTypes.includes(entry.locationType) || !entry.detail?.trim()
    || entry.basis !== undefined && !evidenceBases.includes(entry.basis)
    || entry.sourceUrl !== undefined && !/^https?:\/\//.test(entry.sourceUrl)
    || (entry.basis ?? 'official-venue') === 'official-venue' && !entry.sourceUrl) {
    throw new Error(`Invalid location evidence entry: ${JSON.stringify(entry)}`)
  }
}
for (const entry of overrides) {
  if (!entry.chain || !entry.name || !entry.address) throw new Error('Location overrides must identify the chain, full name and full address.')
}
for (const entry of venues) {
  if (!Array.isArray(entry.aliases) || !entry.aliases.length || entry.aliases.some((alias) => typeof alias !== 'string' || !alias.trim())) {
    throw new Error('Venue evidence must have non-empty name aliases.')
  }
}
const key = (chain, row) => JSON.stringify([chain, row.name, row.address])
const byOutlet = new Map(overrides.map((entry) => [key(entry.chain, entry), entry]))
if (byOutlet.size !== overrides.length) throw new Error('Duplicate location overrides')

const normalize = (text) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
const result = (type, basis, detail, sourceUrl) => ({
  locationType: type,
  locationTypeEvidence: { basis, detail, ...(sourceUrl ? { sourceUrl } : {}) },
})

export function classifyOutlet(chain, row) {
  const override = byOutlet.get(key(chain, row))
  if (override) return result(override.locationType, override.basis, override.detail, override.sourceUrl)
  const name = normalize(row.name.replace(/^(?:zus coffee|zus coffee dt|zus coffee - dt|luckin coffee|the coffee bean & tea leaf|san francisco coffee|ready-to zus)\s*-?\s*/i, ''))
  const address = normalize(row.address)
  const text = `${name} | ${address}`
  const hostText = text.replace(/\b(?:jalan|jln|lorong|taman|persiaran)\s+(?:menara|wisma|tower|hospital|university|universiti|residence)\b/g, '')

  const venue = venues.find((entry) => entry.aliases.some((alias) => text.includes(normalize(alias))))
  // Drive-through and explicitly identified shoplots take precedence below.

  // A drive-through cafe can be in a mall's grounds without being a mall unit.
  if (/\bdrive[- ]?(?:thru|through)\b|\bdt\b/.test(name)) {
    return result('standalone-shop', 'inferred', 'The outlet name identifies a drive-through cafe; treated as a separately accessed shop.')
  }
  if (/\bshop[- ]?lots?\b|\bshophouses?\b|\bretail shops?\b/.test(text)) {
    return result('standalone-shop', 'address', 'The outlet listing identifies a shoplot or retail shop.')
  }
  if (venue) return result(venue.locationType, venue.basis ?? 'official-venue', venue.detail, venue.sourceUrl)

  // Never interpret a road/neighbourhood called Universiti as a campus.
  const other = [
    [/\bhospital\b|\bmedical (?:centre|center)\b|\bpusat perubatan\b|\bklinik\b/, 'hospital or medical facility'],
    [/\bairport\b|\bklia\s*2?\b|\bskypark terminal\b/, 'airport'],
    [/\bhotel\b|\bholiday inn\b/, 'hotel'],
    [/\buniversity\b|\buniversiti (?:teknologi|sains|teknikal|tunku|malaysia|malaya|putra|kebangsaan|islam|sultan)\b|\bunitar\b|\bcollege\b|\b(?:uitm|upm|ukm|utar|iium|unimas|umk|utm)\b|\bcampus\b/, 'university or education facility'],
    [/\b(?:lrt|mrt|ktm)\b|\b(?:railway|bus) (?:station|terminal)\b|\bpenang sentral\b/, 'transport station or terminal'],
    [/\b(?:apartment|apartments|condominium|residences?|residensi|service suites|serviced suites|pangsapuri|kondominium)\b/, 'residential or mixed-use residential development'],
    [/\bsales gallery\b|\bgaleri jualan\b/, 'property sales gallery'],
  ]
  // Mall sub-units take precedence over the surrounding mixed-use address.
  const mall = /\b\w*mall\b|\bshopping (?:centre|center|complex|gallery)\b|\bpusat beli[- ]?belah\b|\bkompleks membeli[- ]?belah\b|\bpremium outlets?\b|\boutlet (?:park|mall)\b/
  if (mall.test(address)) return result('inside-building', 'address', 'The address explicitly names a mall, shopping centre, or outlet shopping centre.')
  if (mall.test(name)) return result('inside-building', 'address', 'The official outlet name identifies a mall or shopping centre.')
  // Supermarket buildings with leased retail units are included in mall retail.
  if (/\baeon\b|\blotus(?:'|\?)?s\b|\bmydin\b|\btesco\b|\bgiant\b|\bc[- ]mart\b|\bsogo\b/.test(name)) {
    return result('inside-building', 'inferred', 'The outlet is listed at a supermarket or department-store retail venue; included with shopping centres.')
  }
  for (const [pattern, venue] of other) {
    if (pattern.test(hostText)) return result('inside-building', 'address', `The listing identifies a ${venue}.`)
  }
  if (/^(?:dt )?(?:petron(?:as)?|shell|caltex|bhp(?:etrol)?)\b/.test(name)
    || /\b(?:petrol|petronas|caltex|shell|bhpetrol) (?:service )?station\b/.test(address)) {
    return result('inside-building', 'address', 'The listing identifies a cafe at a petrol station.')
  }
  if (/\b(?:office|corporate) (?:building|tower|centre|center|park|office)\b|\boffice lobby\b|\boffice \d\b/.test(text)) {
    return result('inside-building', 'address', 'The listing explicitly identifies an office building or corporate office venue.')
  }
  if (/\bfood truck\b/.test(text)) return result('standalone-shop', 'address', 'The outlet listing explicitly identifies a self-contained food-truck cafe.')
  if (/\b(?:rsa|r&r)\b|kawasan rehat|rest (?:stop|area)/.test(text)) {
    return result('inside-building', 'address', 'The outlet is listed at a motorway rest-area facility.')
  }
  // All host-building types belong to the same group; never interpret Plaza
  // or Square alone as proof of an interior (many are street-shop districts).
  if (/\bmenara\b|\bwisma\b|\btower\b|\blobby\b|\bbangunan\b/.test(hostText)) {
    return result('inside-building', 'address', 'The listing identifies a unit in a named tower, Wisma, Menara, or building lobby.')
  }
  if (/\b(?:lower ground|concourse|level [1-9])\b/.test(address)) {
    return result(null, 'unknown', 'Review the host venue or unit address to establish whether this is a street-facing shop.')
  }
  if (/\b(?:pusat (?:perniagaan|komersial|perdagangan)|commercial centre|commercial center|business centre|business center)\b/.test(address)
    && /\b(?:no[.:]?\s*\d|lot\s*\d|sublot\s*(?:no\.?\s*)?\d|\d+-g\b)/.test(address)) {
    return result('standalone-shop', 'inferred', 'A numbered retail shoplot in a commercial/business district; the district name does not establish a mall interior.')
  }
  if (/(?:^|[, ])(?:(?:no\.?|lot|ptd?|hs\s*\(?d\)?|hsm)\s*)?[a-z]{0,3}[- ]?\d+[a-z\d\s()&/.,-]*\b/.test(address)
    && /\b(?:jalan|jln|j\.?ln|lorong|lrg|persiaran|persisiran|lebuh|leboh|lebuhraya|jln\.|susur|susuran)\b/.test(address)) {
    return result('standalone-shop', 'inferred', 'The address is a numbered street/shoplot address without a named host building; standalone includes street-facing shoplots.')
  }
  if (/\b(?:ground floor|gf|aras bawah|tingkat bawah)\b/.test(address)
    && /\b(?:no[.:]?\s*\d|lot\s*\d|pt\s*\d|plot\s*\d|sublot\s*(?:no\.?\s*)?\d)/.test(address)) {
    return result('standalone-shop', 'inferred', 'A separately numbered ground-floor shop/land-plot address without an identified host building.')
  }
  return result(null, 'unknown', 'The available listing does not establish the venue type.')
}

export const classifyOutlets = (chain, rows) => rows.map((row) => ({ ...row, ...classifyOutlet(chain, row) }))
