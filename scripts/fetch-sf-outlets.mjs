#!/usr/bin/env node
// Fetches every outlet listed by the official Malaysian SF Coffee locator:
// https://sfcoffee.com/our-stores/
// No dependencies; Node 20+. This is a locator snapshot, not a claim that the
// official site includes every operating store or is always up to date.
// Coordinates come from its hidden map markers. Where a marker exactly copies
// a Google Maps viewport center, use the explicit destination pin in that same
// official direction URL instead (never use the viewport as the outlet pin).
// This corrects known old markers such as Wisma Consplant and Quill 18.
// Some markers/destination pins represent the host building rather than a shop
// entrance. Short links are not resolved: the Toppen link incorrectly duplicates
// Southville City's link, while its official hidden marker is in Johor Bahru.
// Usage: node scripts/fetch-sf-outlets.mjs [--output /tmp/zus-sf-outlets.json]
// Default output updates only the san-francisco-coffee group in outlets.json.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE = 'https://sfcoffee.com/our-stores/';
const STATES = new Set(['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya', 'Labuan']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ndash: '–', mdash: '—' };

function cleanText(value) {
  return value.replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ').trim();
}

function required(block, pattern, label) {
  const match = block.match(pattern);
  if (!match) throw new Error(`Official SF locator is missing ${label}; refusing an incomplete refresh.`);
  return cleanText(match[1]);
}

function parseCity(address, state) {
  if (state === 'Kuala Lumpur' || state === 'Putrajaya' || state === 'Labuan') return state;
  // Cities are extracted only when explicitly named in the published address.
  const known = ['Bandar Baru Nilai', 'Petaling Jaya', 'Sungai Buloh', 'Shah Alam', 'Butterworth', 'George Town', 'Bayan Lepas', 'Cyberjaya', 'Johor Bahru', 'Dengkil', 'Subang Jaya', 'Ara Damansara'];
  return known.find((city) => new RegExp(`\\b${city}\\b`, 'i').test(address)) ?? null;
}

function validPair(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 0 && lat <= 8 && lng >= 99 && lng <= 120;
}

function coordinates(block) {
  const marker = block.match(/<span class="lat">\s*([^<]+)<\/span>\s*<span class="lng">\s*([^<]+)<\/span>/);
  let lat = marker ? Number(marker[1]) : null;
  let lng = marker ? Number(marker[2]) : null;
  const link = block.match(/<a href="([^"]+)" class="vc_general vc_btn3"/);
  const url = link ? cleanText(link[1]) : '';
  const viewport = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  const placePins = [...url.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  const destinationPins = [...url.matchAll(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g)];
  const destination = placePins.length
    ? { lat: Number(placePins.at(-1)[1]), lng: Number(placePins.at(-1)[2]) }
    : destinationPins.length
      ? { lat: Number(destinationPins.at(-1)[2]), lng: Number(destinationPins.at(-1)[1]) }
      : null;
  const copiedViewport = viewport && Math.abs(lat - Number(viewport[1])) < 1e-7 && Math.abs(lng - Number(viewport[2])) < 1e-7;
  if ((!validPair(lat, lng) || copiedViewport) && destination && validPair(destination.lat, destination.lng)) {
    ({ lat, lng } = destination);
  } else if (copiedViewport || !validPair(lat, lng)) {
    lat = null;
    lng = null;
  }
  return { lat, lng };
}

const args = process.argv.slice(2);
let output = null;
if (args.length) {
  if (args.length !== 2 || args[0] !== '--output' || !args[1]) throw new Error('Usage: node scripts/fetch-sf-outlets.mjs [--output <path>]');
  output = resolve(args[1]);
}

const response = await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; coffee-randomizer-outlets/1.0)' }, signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${SOURCE}`);
const html = await response.text();
const blocks = html.split('<div class="store-container">').slice(1);
if (!blocks.length) throw new Error('No SF Coffee stores found; the official locator markup may have changed.');
const seen = new Set();
const outlets = blocks.map((block) => {
  const name = `San Francisco Coffee - ${required(block, /<h3 class="name">([\s\S]*?)<\/h3>/, 'name')}`;
  const address = required(block, /<p class="address address-value">([\s\S]*?)<\/p>/, `address for ${name}`);
  const sourceState = required(block, /<p class="state">([\s\S]*?)<\/p>/, `state for ${name}`);
  const state = sourceState === 'Penang' ? 'Pulau Pinang' : sourceState;
  if (!STATES.has(state)) throw new Error(`Unrecognized Malaysian state ${state} for ${name}.`);
  const key = `${name}|${address}`;
  if (seen.has(key)) throw new Error(`Duplicate official SF Coffee outlet: ${name}.`);
  seen.add(key);
  return { name, address, city: parseCity(address, state), state, ...coordinates(block) };
}).sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(outlets, null, 2)}\n`);
} else {
  const { writeOutletChain } = await import('./outlet-data.mjs');
  await writeOutletChain('san-francisco-coffee', outlets);
}
console.log(`SF Coffee: ${outlets.length} outlets; ${outlets.filter((outlet) => outlet.lat !== null && outlet.lng !== null).length} with coordinates. Source: ${SOURCE}`);
