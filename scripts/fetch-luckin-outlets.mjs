#!/usr/bin/env node
/**
 * Refresh Malaysian Luckin Coffee outlets from the official ordering website.
 * Source: https://in.luckincoffee.com/?tenant=LKMY
 * Locator: POST /api/capi/resource/locate/shop/inCityPage
 *
 * Reproduces the site's public H5 locator transport: pageConfig supplies its
 * encryption key and the first 16 UTF-8 bytes encrypt/decrypt AES-128-ECB with
 * PKCS#7 padding and URL-safe base64. No account, credentials or API key needed.
 * cityMid:null is the site's "All Cities" selection; start/limit/hasMore are
 * followed to exhaustion. Only publicly listed, active pickup outlets are kept.
 * Addresses, cities, states and coordinates come directly from the locator.
 * Coverage is the public locator, not a promise that every physical outlet is
 * listed. Temporarily closed outlets remain included when their status is 1.
 * This API is undocumented and may change; any malformed response fails before
 * writing. Checked 2026-10-13: 159 active outlets, all with source coordinates.
 *
 * Usage: node scripts/fetch-luckin-outlets.mjs [--output /tmp/outlets.json]
 * Default: replace only luckin-coffee in the grouped outlet data.
 */
import { createCipheriv, createDecipheriv } from "node:crypto";
import { writeFile } from "node:fs/promises";

const ORIGIN = "https://in.luckincoffee.com";
const SITE_URL = `${ORIGIN}/?tenant=LKMY`;
const LOCATOR_PATH = "/api/capi/resource/locate/shop/inCityPage";
const STATES = new Set([
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka",
  "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang",
  "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu",
]);

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeState(value) {
  const state = clean(value).replace(/^Wilayah Persekutuan\s+/i, "");
  const aliases = { Penang: "Pulau Pinang", Malacca: "Melaka" };
  const normalized = aliases[state] ?? state;
  if (!STATES.has(normalized)) throw new Error(`Unrecognized Malaysian state: ${value}`);
  return normalized;
}

async function fetchResponse(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response;
}

async function createLocator() {
  const response = await fetchResponse(SITE_URL);
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]).join("; ");
  const html = await response.text();
  const configMatch = html.match(/window\.pageConfig\s*=\s*'([^']+)'/);
  if (!configMatch) throw new Error("Luckin website pageConfig is missing");
  const config = JSON.parse(Buffer.from(configMatch[1], "base64").toString("utf8"));
  const encryptionKey = config.cfcenter?.encryptKey;
  if (typeof encryptionKey !== "string" || !encryptionKey) throw new Error("Luckin website transport key is missing");
  const key = Buffer.alloc(16);
  Buffer.from(encryptionKey, "utf8").copy(key, 0, 0, 16);

  const bundleMatch = html.match(/src="([^"]*\/js\/default\.[^"]+\.js)"/);
  if (!bundleMatch) throw new Error("Luckin website app bundle is missing");
  const bundleUrl = new URL(bundleMatch[1], ORIGIN).href;
  const bundle = await (await fetchResponse(bundleUrl)).text();
  const appVersion = bundle.match(/appVersion:"([^"]+)"/)?.[1];
  if (!appVersion) throw new Error("Luckin website app version is missing");

  return async (start) => {
    const payload = {
      appVersion, type: 1, keyword: "", lngLatParam: null,
      operationMode: 1, cityMid: null, start, limit: 100,
    };
    const cipher = createCipheriv("aes-128-ecb", key, null);
    const q = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]).toString("base64url");
    const response = await fetchResponse(`${ORIGIN}${LOCATOR_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "Accept-Language": "en-US",
        "X-LK-Tenant": "LKMY", encrypt: "true", cookie: cookies,
      },
      body: JSON.stringify({ q }),
    });
    const envelope = await response.json();
    if (typeof envelope.data !== "string") throw new Error("Luckin locator response is missing encrypted data");
    const decipher = createDecipheriv("aes-128-ecb", key, null);
    const result = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64url")), decipher.final(),
    ]).toString("utf8"));
    if (result.code !== 1 || result.result !== "SUCCESS") throw new Error(`Luckin locator failed: ${result.msg ?? result.code}`);
    const page = result.content;
    if (!Array.isArray(page?.shopList) || typeof page.hasMore !== "boolean" || page.start !== start || !Number.isInteger(page.limit) || page.limit <= 0) {
      throw new Error("Luckin locator pagination response is invalid");
    }
    return page;
  };
}

async function fetchOutlets() {
  const locator = await createLocator();
  const outlets = new Map();
  let start = 0;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const page = await locator(start);
    for (const shop of page.shopList) {
      if (shop.status !== 1) continue;
      const name = clean(shop.shopName);
      const address = clean(shop.address);
      if (!shop.shopNo?.startsWith("MY") || !name || !address) throw new Error("Luckin locator returned an invalid Malaysian outlet");
      const rawLat = shop.locationLatitude;
      const rawLng = shop.locationLongitude;
      const lat = rawLat !== null && rawLat !== "" ? Number(rawLat) : NaN;
      const lng = rawLng !== null && rawLng !== "" ? Number(rawLng) : NaN;
      const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && lat > 0 && lat < 8 && lng > 99 && lng < 120;
      const row = {
        name: `Luckin Coffee - ${name}`, address,
        city: clean(shop.cityName) || null,
        state: normalizeState(shop.administrativeAreaName),
        lat: hasCoordinates ? lat : null, lng: hasCoordinates ? lng : null,
      };
      if (outlets.has(shop.shopNo) && JSON.stringify(outlets.get(shop.shopNo)) !== JSON.stringify(row)) {
        throw new Error(`Luckin outlet ${shop.shopNo} changed during pagination; retry refresh`);
      }
      outlets.set(shop.shopNo, row);
    }
    if (!page.hasMore) {
      if (!outlets.size) throw new Error("Luckin locator returned no outlets");
      return [...outlets.values()].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
    }
    if (!page.shopList.length) throw new Error("Luckin locator hasMore returned an empty page");
    start += page.limit;
  }
  throw new Error("Luckin locator exceeded pagination safety limit");
}

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output" || !args[1])) {
  throw new Error("Usage: node scripts/fetch-luckin-outlets.mjs [--output <path>]");
}
const outlets = await fetchOutlets();
if (args.length) {
  await writeFile(args[1], `${JSON.stringify(outlets, null, 2)}\n`);
} else {
  const { writeOutletChain } = await import("./outlet-data.mjs");
  await writeOutletChain("luckin-coffee", outlets);
}
console.log(`Luckin Coffee: ${outlets.length} outlets; ${outlets.filter((row) => row.lat !== null).length} with coordinates. Source: ${SITE_URL}`);
