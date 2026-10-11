#!/usr/bin/env node
// Regenerates src/data/outlets.json from the ZUS Coffee website (zuscoffee.com).
//
// Source: the WordPress REST API behind https://zuscoffee.com/our-stores/.
//   Each outlet is a WP post in a child category of "Store" (id 53), with the
//   street address as the post body and a Google Maps short link in
//   acf.direction_link. Coordinates are obtained by resolving that short link
//   (reading the 302 Location header; the place pin is in "!3d<lat>!4d<lng>").
//
// Usage: node scripts/fetch-outlets.mjs [--no-coords]
// Requires Node 20+. No dependencies.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://zuscoffee.com/wp-json/wp/v2';
const STORE_CATEGORY_ID = 53;
const UA = 'Mozilla/5.0 (compatible; zus-randomizer-dataset/1.0)';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/outlets.json');
const WITH_COORDS = !process.argv.includes('--no-coords');
const COORD_CONCURRENCY = 3;
const DELAY_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) return { json: await res.json(), headers: res.headers };
      if (res.status === 400) return null; // WP returns 400 past the last page
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} ${url}`);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await sleep(1000 * (i + 1));
  }
  throw new Error(`Failed: ${url}`);
}

// ---------- text helpers ----------
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}
function htmlToText(html) {
  return decode(html.replace(/<br\s*\/?>/gi, ', ').replace(/<\/p>\s*<p[^>]*>/gi, ', ').replace(/<[^>]+>/g, ' '))
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,(\s*,)+/g, ',')
    .trim()
    .replace(/^[,\s]+|[,.\s]+$/g, '');
}
function titleCaseIfShouting(s) {
  if (/[a-z]/.test(s)) return s;
  return s
    .toLowerCase()
    .replace(/[a-z][a-z']*/g, (w) => (w.length <= 3 && !/[aeiouy]/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
}
// Most posts are titled "ZUS Coffee - <place>", but some are just an ALL-CAPS place name
// (e.g. "PERMAS JAYA, JOHOR"); normalise those to "ZUS Coffee - Permas Jaya".
function cleanName(t) {
  let n = htmlToText(t);
  if (!/zus/i.test(n)) {
    const stateRe = new RegExp(',\\s*(' + STATES.join('|') + ')$', 'i');
    n = 'ZUS Coffee - ' + titleCaseIfShouting(n.replace(stateRe, ''));
  }
  return n;
}

// ---------- state / city ----------
const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis',
  'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya', 'Labuan',
];
const STATE_ALIASES = [
  [/\b(?:wilayah persekutuan|w\.?\s?p\.?)\s*,?\s*kuala lumpur\b/i, 'Kuala Lumpur'],
  [/\b(?:wilayah persekutuan|w\.?\s?p\.?)\s*,?\s*putrajaya\b/i, 'Putrajaya'],
  [/\b(?:wilayah persekutuan|w\.?\s?p\.?)\s*,?\s*labuan\b/i, 'Labuan'],
  [/\bkuala lumpur\b|\bk\.?l\.?\b/i, 'Kuala Lumpur'],
  [/\bputrajaya\b/i, 'Putrajaya'],
  [/\blabuan\b/i, 'Labuan'],
  [/\bpulau pinang\b|\bpenang\b|\bp\.?\s?pinang\b/i, 'Pulau Pinang'],
  [/\bnegeri sembilan\b|\bn\.?\s?sembilan\b/i, 'Negeri Sembilan'],
  [/\bmelaka\b|\bmalacca\b/i, 'Melaka'],
  [/\bjohor\b|\bjohore\b/i, 'Johor'],
  [/\bkedah\b/i, 'Kedah'],
  [/\bkelantan\b/i, 'Kelantan'],
  [/\bpahang\b/i, 'Pahang'],
  [/\bperak\b/i, 'Perak'],
  [/\bperlis\b/i, 'Perlis'],
  [/\bsabah\b/i, 'Sabah'],
  [/\bsarawak\b/i, 'Sarawak'],
  [/\bselangor\b/i, 'Selangor'],
  [/\bterengganu\b|\btrengganu\b/i, 'Terengganu'],
];
function stateFromPostcode(pc) {
  const n = Number(pc);
  const R = [
    [1000, 2799, 'Perlis'], [5000, 9999, 'Kedah'], [10000, 14999, 'Pulau Pinang'], [15000, 18499, 'Kelantan'],
    [20000, 24999, 'Terengganu'], [25000, 28999, 'Pahang'], [30000, 36999, 'Perak'], [39000, 39999, 'Pahang'],
    [40000, 48999, 'Selangor'], [49000, 49999, 'Pahang'], [50000, 60999, 'Kuala Lumpur'], [62000, 62999, 'Putrajaya'],
    [63000, 68199, 'Selangor'], [69000, 69999, 'Pahang'], [70000, 73999, 'Negeri Sembilan'], [75000, 78999, 'Melaka'],
    [79000, 86999, 'Johor'], [87000, 87999, 'Labuan'], [88000, 91999, 'Sabah'], [93000, 98999, 'Sarawak'],
  ];
  return R.find(([a, b]) => n >= a && n <= b)?.[2] ?? null;
}
const CAT_STATE = {
  63: 'Johor', 55: 'Kedah', 57: 'Kelantan', 62: 'Melaka', 61: 'Negeri Sembilan', 60: 'Pahang', 56: 'Pulau Pinang',
  58: 'Perak', 54: 'Perlis', 72: 'Sabah', 73: 'Sarawak', 59: 'Terengganu',
};

function parseState(address, catIds) {
  // 1) State name in the tail of the address (last 2 comma segments)
  const segs = address.split(',').map((s) => s.trim()).filter(Boolean);
  const tail = segs.slice(-2).join(', ');
  for (const [re, st] of STATE_ALIASES) if (re.test(tail) && re.source !== '\\bk\\.?l\\.?\\b') return { state: st, how: 'tail' };
  // 2) Postcode
  const pcs = [...address.matchAll(/(?<!(?:lot|pt|plot|no\.?)\s*)\b(\d{5})\b/gi)].map((m) => m[1]);
  if (pcs.length) {
    const st = stateFromPostcode(pcs[pcs.length - 1]);
    if (st) return { state: st, how: 'postcode' };
  }
  // 3) State name anywhere in the address
  for (const [re, st] of STATE_ALIASES) if (re.test(address)) return { state: st, how: 'anywhere' };
  // 4) Category (single-state categories only)
  for (const c of catIds) if (CAT_STATE[c]) return { state: CAT_STATE[c], how: 'category' };
  return { state: null, how: 'none' };
}

const STATE_SUFFIX = new RegExp(
  '[\\s,]+(?:' + [...STATES, 'Penang', 'Malacca', 'Wilayah Persekutuan', 'Darul Ehsan', 'Darul Ridzuan', 'Darul Takzim', 'Darul Makmur', 'Darul Naim', 'Darul Aman', 'Malaysia'].join('|') + ')(?:[\\s,]+(?:Darul \\w+|Malaysia))*$',
  'i',
);
const NOT_A_CITY = /^(jalan|jln|lorong|lrg|persiaran|lebuh|lebuhraya|taman|kampung|kg|menara|level|lot|no\b|unit|seksyen|section|east|west|north|south|block|blok|off|pusat|dataran|bandar baru|bandar utama|desa|ground|pt\b|sublot)/i;
const CITY_FIXES = { malacca: 'Melaka', georgetown: 'George Town', 'kota bahru': 'Kota Bharu', klia: 'KLIA', 'kota setar': 'Alor Setar', usm: 'Gelugor' };
function normaliseCity(c, state) {
  c = c.replace(/^[^A-Za-z]+/, '').replace(/[.,]+$/, '').replace(/\s+/g, ' ').trim();
  // Strip a trailing state name, but keep towns named after one ("Kuala Terengganu", "Kuala Perlis").
  for (let prev; prev !== c; ) {
    prev = c;
    const stripped = c.replace(STATE_SUFFIX, '').trim();
    if (!/^(kuala|kota|pulau|bandar|sungai|teluk|tanjung)$/i.test(stripped)) c = stripped;
  }
  c = c.replace(/^Daerah\s+/i, '');
  if (/^(wilayah persekutuan|wp)$/i.test(c)) return state;
  if (/^(malaysia|penang|survey lot|section)$/i.test(c) || /[@]/.test(c)) return null;
  c = titleCaseIfShouting(c);
  c = CITY_FIXES[c.toLowerCase()] ?? c;
  if (!c || /\d/.test(c)) return null;
  if (STATES.includes(c) && !['Kuala Lumpur', 'Putrajaya', 'Labuan', 'Melaka'].includes(c)) return null;
  return c;
}
function parseCity(address, state) {
  const flat = address.replace(/\s+/g, ' ');
  // Text right after the last postcode, up to the next comma: "81100 Johor Bahru, Johor"
  const after = [...flat.matchAll(/\b\d{5}\b[,\s]*([^,\d]*)/g)].pop();
  if (after) {
    const c = normaliseCity(after[1], state);
    if (c && !/^(jalan|jln|lorong|persiaran|lot|no\b|level|unit|seksyen)/i.test(c)) return c;
  }
  // "<City> <postcode>" at the end of a comma segment: "Mersing 86800"
  const before = [...flat.matchAll(/(?:^|,)\s*([^,\d]+?)\s*,?\s*\b\d{5}\b/g)].pop();
  if (before) {
    const c = normaliseCity(before[1], state);
    if (c && !NOT_A_CITY.test(c) && c.split(' ').length <= 3) return c;
  }
  // Segment just before a trailing state name
  const segs = flat.split(',').map((x) => x.trim()).filter(Boolean);
  const last = segs[segs.length - 1] ?? '';
  if (segs.length >= 2 && STATE_ALIASES.some(([re]) => re.test(last))) {
    const c = normaliseCity(segs[segs.length - 2], state);
    if (c && !NOT_A_CITY.test(c) && c.split(' ').length <= 3) return c;
  }
  // City-states / single-city regions
  return ['Kuala Lumpur', 'Putrajaya', 'Labuan', 'Melaka'].includes(state) ? state : null;
}

// Posts whose source data is wrong/incomplete and can't be resolved from the address text.
// (Subang Parade is filed under the Perlis category on zuscoffee.com and its address has no state;
// it is the Subang Jaya mall in Selangor.)
const OVERRIDES = {
  'zus coffee - subang parade': { state: 'Selangor', city: 'Subang Jaya' },
};

const CLOSED_RE = /\b(permanently closed|temporarily closed|closed down|ceased operation|no longer operat)/i;

// ---------- coordinates ----------
async function resolveCoords(link) {
  if (!link) return null;
  for (let hop = 0, url = link; hop < 4; hop++) {
    let res;
    try {
      res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA } });
    } catch {
      return null;
    }
    const loc = res.headers.get('location');
    const hay = loc ?? url;
    const pin = hay.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? hay.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/) ?? hay.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (pin) return { lat: Number(pin[1]), lng: Number(pin[2]) };
    if (!loc) return null;
    url = new URL(loc, url).href;
  }
  return null;
}
// Generous per-state bounding boxes [minLat, maxLat, minLng, maxLng]; used to discard map links
// on zuscoffee.com that point at the wrong place.
const BBOX = {
  Johor: [1.1, 3.0, 102.4, 104.5], Kedah: [5.0, 6.8, 99.5, 101.0], Kelantan: [4.5, 6.4, 101.2, 102.7],
  Melaka: [2.0, 2.5, 101.8, 102.7], 'Negeri Sembilan': [2.3, 3.2, 101.5, 102.8], Pahang: [2.4, 4.9, 101.3, 104.0],
  Perak: [3.6, 5.9, 100.0, 101.9], Perlis: [6.3, 6.8, 99.9, 100.5], 'Pulau Pinang': [5.1, 5.6, 100.1, 100.6],
  Sabah: [4.0, 7.6, 115.0, 119.5], Sarawak: [0.8, 5.2, 109.4, 115.8], Selangor: [2.5, 3.9, 100.7, 101.9],
  Terengganu: [4.0, 5.9, 102.3, 103.6], 'Kuala Lumpur': [3.0, 3.3, 101.5, 101.85], Putrajaya: [2.85, 3.05, 101.6, 101.75],
  Labuan: [5.1, 5.5, 115.0, 115.4],
};
const inState = (c, state) => {
  const b = BBOX[state];
  return !!c && !!b && c.lat >= b[0] && c.lat <= b[1] && c.lng >= b[2] && c.lng <= b[3];
};

// ---------- main ----------
async function fetchAllPosts() {
  const cats = (await getJson(`${BASE}/categories?parent=${STORE_CATEGORY_ID}&per_page=100&_fields=id,name,slug,count`)).json;
  console.error('State categories:', cats.map((c) => `${c.slug}(${c.count})`).join(' '));
  const posts = new Map();
  for (const c of cats) {
    for (let page = 1; ; page++) {
      const r = await getJson(`${BASE}/posts?categories=${c.id}&per_page=100&page=${page}&_fields=id,title,content,categories,acf,link`);
      if (!r) break;
      for (const p of r.json) posts.set(p.id, p);
      const totalPages = Number(r.headers.get('x-wp-totalpages') ?? 1);
      if (page >= totalPages) break;
      await sleep(DELAY_MS);
    }
  }
  // Posts attached directly to the parent "Store" category
  for (let page = 1; ; page++) {
    const r = await getJson(`${BASE}/posts?categories=${STORE_CATEGORY_ID}&per_page=100&page=${page}&_fields=id,title,content,categories,acf,link`);
    if (!r) break;
    for (const p of r.json) posts.set(p.id, p);
    if (page >= Number(r.headers.get('x-wp-totalpages') ?? 1)) break;
  }
  return [...posts.values()];
}

async function main() {
  const posts = await fetchAllPosts();
  console.error(`Fetched ${posts.length} store posts`);

  const rows = [];
  const stats = { closed: 0, foreign: 0, noState: 0, noAddress: 0, how: {} };
  for (const p of posts) {
    const name = cleanName(p.title.rendered);
    const address = htmlToText(p.content.rendered);
    if (CLOSED_RE.test(name) || CLOSED_RE.test(address)) { stats.closed++; continue; }
    if (!address) stats.noAddress++;
    const { state, how } = parseState(address, p.categories);
    stats.how[how] = (stats.how[how] ?? 0) + 1;
    if (!state) { stats.noState++; console.error('No state:', name, '|', address); continue; }
    const ov = OVERRIDES[name.toLowerCase()];
    const catState = p.categories.map((c) => CAT_STATE[c]).find(Boolean);
    if (catState && catState !== (ov?.state ?? state)) console.error(`  note: ${name} categorised ${catState} but address says ${ov?.state ?? state}`);
    rows.push({ name, address, city: ov?.city ?? parseCity(address, ov?.state ?? state), state: ov?.state ?? state, lat: null, lng: null, _link: p.acf?.direction_link || null });
  }

  if (WITH_COORDS) {
    let i = 0, done = 0;
    const worker = async () => {
      while (i < rows.length) {
        const r = rows[i++];
        const c = await resolveCoords(r._link);
        if (inState(c, r.state)) { r.lat = c.lat; r.lng = c.lng; }
        else if (c) console.error(`  discarded out-of-state coords for ${r.name} (${r.state}): ${c.lat},${c.lng}`);
        if (++done % 100 === 0) console.error(`  coords ${done}/${rows.length}`);
        await sleep(DELAY_MS);
      }
    };
    await Promise.all(Array.from({ length: COORD_CONCURRENCY }, worker));
  }

  // dedupe: same name + address, or same name + same coordinates
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const keys = [`${r.name.toLowerCase()}|${r.address.toLowerCase()}`];
    if (r.lat != null) keys.push(`${r.name.toLowerCase()}|${r.lat}|${r.lng}`);
    if (keys.some((k) => seen.has(k))) { console.error('dup:', r.name, '|', r.address); continue; }
    keys.forEach((k) => seen.add(k));
    const { _link, ...rest } = r;
    out.push(rest);
  }
  out.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  const perState = {};
  for (const o of out) perState[o.state] = (perState[o.state] ?? 0) + 1;
  console.error('Stats:', JSON.stringify(stats));
  console.error(`Wrote ${out.length} outlets to ${OUT}`);
  console.error('Per state:', JSON.stringify(perState));
  console.error(`With coordinates: ${out.filter((o) => o.lat != null).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
