#!/usr/bin/env node
// Regenerate Malaysian Coffee Bean & Tea Leaf outlets from the official locator.
// Source: https://www.coffeebean.com.my/amlocator
// The locator's jsonLocations JSON contains all items, totalRecords, addresses,
// detail-page links, and the chain's map pins. Detail pages expose the city as
// the first component of their destination-point address (city, street, zip).
// Coverage is the published locator, not a guarantee that every operating cafe
// is listed. The source currently lists Peninsular Malaysian cafes only. Pins
// are official-source coordinates, not independently surveyed coordinates;
// missing/zero/invalid pins become null. No external geocoder is used.
// Sabah, Sarawak, and Labuan remain an unresolved coverage gap: no usable
// official current listing was found; coffeebeaneastmalaysia.com is parked.
// Usage: node scripts/fetch-cbtl-outlets.mjs [--output /tmp/outlets.json]
// Requires Node 20+. No dependencies. Without --output, update this chain only.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE = 'https://www.coffeebean.com.my/amlocator';
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
if (args.length !== 0 && (args.length !== 2 || outputIndex !== 0)) {
  throw new Error('Usage: node scripts/fetch-cbtl-outlets.mjs [--output <path>]');
}
if (outputIndex >= 0 && !args[outputIndex + 1]) throw new Error('--output requires a path');
const output = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function fetchText(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; coffee-outlet-dataset/1.0)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep((attempt + 1) * 750);
    }
  }
}

const entities = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", reg: '®',
};
function decode(value) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&([a-z]+);/gi, (match, key) => entities[key.toLowerCase()] ?? match);
}
function plain(value) {
  return decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Read one JSON value without evaluating executable site code.
function readJsonValue(html, marker) {
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`Official locator no longer contains ${marker}`);
  const remainder = html.slice(index + marker.length).trimStart();
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let cursor = 0; cursor < remainder.length; cursor++) {
    const character = remainder[cursor];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{' || character === '[') depth++;
    else if (character === '}' || character === ']') {
      depth--;
      if (depth === 0) return JSON.parse(remainder.slice(0, cursor + 1));
    }
  }
  throw new Error('Truncated official locator JSON');
}

const states = [
  ['Federal Territories Kuala Lumpur', 'Kuala Lumpur'],
  ['Federal Territories Putrajaya', 'Putrajaya'],
  ['Federal Territories Labuan', 'Labuan'],
  ['Negeri Sembilan', 'Negeri Sembilan'], ['Pulau Pinang', 'Pulau Pinang'],
  ['Kuala Lumpur', 'Kuala Lumpur'], ['Terengganu', 'Terengganu'],
  ['Selangor', 'Selangor'], ['Kelantan', 'Kelantan'], ['Malacca', 'Melaka'],
  ['Melaka', 'Melaka'], ['Pahang', 'Pahang'], ['Putrajaya', 'Putrajaya'],
  ['Penang', 'Pulau Pinang'], ['Johor', 'Johor'], ['Kedah', 'Kedah'],
  ['Perak', 'Perak'], ['Perlis', 'Perlis'], ['Sabah', 'Sabah'], ['Sarawak', 'Sarawak'],
];

// Verified contradictions against official venue maps, audited 2026-10-13.
// Reject the observed wrong pair, not every future pin for the same outlet.
// U Hotel: https://uhotelpenang.com/contact/ (5.3514063, 100.2955580).
// Tebrau: https://aeonmallmy.com/mall/aeon-mall-tebrau-city/contact
//         (1.5495756, 103.7943787).
// East Coast Mall: https://www.capitaland.com/en/find-a-property/global-property-listing/retail/east-coast-mall.html
//                 (3.8189210, 103.3263960).
// The source's East Coast Mall 2 street text also wrongly duplicates Kuantan
// City Mall. Preserve that published address without inventing a replacement.
// Genting kiosk: same mall address as outlet 199, yet source pins differ ~3.2km.
// Raja Uda: source pin is ~12.9km from #17 on the same named street, independently
// listed by ZUS at https://zuscoffee.com/2022/08/20/raja-uda-butterworth-penang/.
// These inconsistent/uncertain pins are null rather than guessed replacements.
const wrongPins = new Map([
  [487, [3.91702437, 103.32330174]],
  [560, [5.53061710, 100.39131417]],
  [590, [5.44567087, 100.26987207]],
  [640, [3.43065729, 101.79456988]],
  [712, [1.66353397, 103.79904095]],
]);

function stateFromAddress(address, item) {
  // These corrections resolve absent or contradictory locator region metadata.
  // Sentul is KL; the source explicitly gives Selangor in the Traders Square
  // street address; the Indera Mahkota address explicitly names Kuala Kuantan.
  const corrections = { 409: 'Kuala Lumpur', 493: 'Selangor', 599: 'Pahang' };
  if (corrections[item.id]) return corrections[item.id];
  const withoutZip = address.replace(/\s+\d{5}$/, '');
  for (const [sourceState, state] of states) {
    if (withoutZip.endsWith(sourceState)) return state;
  }
  for (const [sourceState, state] of states) {
    if (withoutZip.includes(sourceState)) return state;
  }
  throw new Error(`Cannot establish Malaysian state for ${item.name}: ${address}`);
}

const locator = readJsonValue(await fetchText(SOURCE), 'jsonLocations:');
if (!Array.isArray(locator.items) || locator.items.length !== Number(locator.totalRecords)) {
  throw new Error(`Incomplete official locator: ${locator.items?.length} items / ${locator.totalRecords} records`);
}
if (new Set(locator.items.map((item) => item.id)).size !== locator.items.length) {
  throw new Error('Official locator returned duplicate outlet IDs');
}

let next = 0;
const rows = new Array(locator.items.length);
const cityWarnings = [];
async function worker() {
  while (next < locator.items.length) {
    const index = next++;
    const item = locator.items[index];
    const popup = item.popup_html;
    const address = plain(popup.split('</h3>')[1]?.split('<div class="amlocator-description"')[0] ?? '');
    if (!address) throw new Error(`Missing address for ${item.name}`);
    const link = popup.match(/class="amlocator-link"\s+href="([^"]+)"/);
    let city = null;
    if (link) {
      try {
        const detail = await fetchText(decode(link[1]));
        const destination = detail.match(/<input\b[^>]*data-amlocator-js="destination-point"[^>]*>/)?.[0];
        const value = destination?.match(/\bvalue="([^"]*)"/)?.[1];
        // The official destination address has structured city first; a blank
        // or generic state-only city is represented as unknown instead.
        const first = value ? decode(value).split(',')[0].trim() : '';
        if (first && !['Johor', 'Kedah', 'Kelantan', 'Negeri Sembilan', 'Pahang',
          'Perak', 'Perlis', 'Penang', 'Pulau Pinang', 'Selangor', 'Terengganu',
          'Sabah', 'Sarawak'].includes(first)) {
          city = first === 'Malacca' ? 'Melaka' : first;
        }
      } catch (error) {
        cityWarnings.push(`${item.name}: ${error.message}`);
      }
    }
    const latitude = Number(item.lat);
    const longitude = Number(item.lng);
    const wrongPin = wrongPins.get(item.id);
    const knownWrong = wrongPin && Math.abs(latitude - wrongPin[0]) < 0.000001
      && Math.abs(longitude - wrongPin[1]) < 0.000001;
    const validPin = Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= 0.5 && latitude <= 7.5 && longitude >= 99 && longitude <= 120
      && !knownWrong;
    const state = stateFromAddress(address, item);
    if (!city && ['Kuala Lumpur', 'Putrajaya', 'Labuan'].includes(state)) city = state;
    rows[index] = {
      name: `The Coffee Bean & Tea Leaf - ${plain(item.name)}`,
      address,
      city,
      state,
      lat: validPin ? latitude : null,
      lng: validPin ? longitude : null,
    };
    await sleep(80);
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
rows.sort((left, right) => left.state.localeCompare(right.state) || left.name.localeCompare(right.name));

if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`);
} else {
  const { writeOutletChain } = await import('./outlet-data.mjs');
  await writeOutletChain('coffee-bean-tea-leaf', rows);
}
for (const warning of cityWarnings) console.warn(`City unavailable: ${warning}`);
console.log(`Coffee Bean & Tea Leaf: ${rows.length} outlets, ${rows.filter((row) => row.lat !== null).length} official map pins, ${rows.filter((row) => row.city !== null).length} cities. Source: ${SOURCE}`);
