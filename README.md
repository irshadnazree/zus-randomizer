# ZUS Roulette

Can't decide which ZUS Coffee to go to? Spin and let fate pick one for you.

Live at **https://kopi.ruxera.com**

Built with [Hono](https://hono.dev) (JSX, server-rendered) on Cloudflare Workers and styled with [Tailwind CSS](https://tailwindcss.com) v4.

## Features

- Random pick from every ZUS Coffee outlet in Malaysia
- Filter by state
- Near mode: pick within 2–25 km of your current location or any place you type (geocoded via OpenStreetMap)
- Near public transport: only pick outlets within 500 m of a mapped train station or bus stop; combines with state and location filters
- Blurred slot-style reel, with tick sounds, a win chime and confetti on the pick (sound can be muted)
- One-tap Google Maps and Waze directions
- Server-rendered outlet directory by state, with addresses and directions
- About page with how-to instructions, state directory links, FAQs, and data source notes

## Search and answer-engine discovery

- `/about` explains how the randomizer works and contains the visible FAQs and source notes.
- `/outlets` links to every state/territory represented in the saved dataset. Each `/outlets/:state` page renders all matching names, addresses, and map links without JavaScript.
- Each page has a unique title, description, production canonical URL, Open Graph metadata, and a 1200 × 630 PNG social preview. Query variants of the randomizer canonicalize to `/`.
- `/sitemap.xml` is generated from the same state data; `/robots.txt` allows crawling and advertises the sitemap. No artificial `lastmod` dates are emitted.
- JSON-LD describes the website, free randomizer, visible FAQ answers, directory lists, and breadcrumbs. Outlet schema only includes known names, addresses, coordinates, and map links. It does not invent reviews, hours, or current operating status.
- Unknown pages return HTTP 404 with `noindex`; trailing slashes redirect permanently. API responses have `X-Robots-Tag: noindex`, and random responses are never cached, including errors.
- FAQs and source links explain the saved-data limitations and unofficial status. Structured data supports understanding; it does not guarantee rich results or AI citations.

Verify the running server without starting another one:

```sh
pnpm run typecheck
pnpm run build
pnpm exec cf deploy --prebuilt --dry-run
node scripts/check-seo.mjs http://localhost:8787
```

After deploying, submit `https://kopi.ruxera.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools. Inspect the homepage and a state page to verify indexing. Search-engine and AI visibility depends on crawling, indexing, and relevance; it cannot be confirmed by local checks.

## Development

Use Node.js 22 (see `.node-version`) and pnpm 11.9.0.

```sh
pnpm install
pnpm run dev        # cf builds CSS + vendor assets before starting
pnpm run typecheck
pnpm run build
```

Project commands use the Cloudflare `cf` CLI. Deployment settings live in `cloudflare.config.ts`; the existing Wrangler bundler is retained internally, with asset generation, minification, and the public asset directory configured in `wrangler.config.ts`. Builds write the deployable Worker and assets to `.cloudflare/output/v0/`.

`pnpm run cf-typegen` generates runtime and binding types in `.cloudflare/types/index.d.ts`. Typecheck regenerates these types automatically, and generated Cloudflare files are ignored by Git.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/random?state=&lat=&lng=&place=&radius=&transit=true` | One random outlet matching the optional filters |
| `GET /api/outlets?state=&lat=&lng=&place=&radius=&transit=true` | All outlets matching the optional filters |

`place` is free text (e.g. `Bangsar`) and takes precedence over `lat`/`lng`.
`transit=true` enables the public transport filter. Matching outlets include `publicTransport` with the nearest mapped stop and its straight-line `distanceKm`.

## Outlet data

Outlets live in `src/data/outlets.json`, grouped into separate arrays by coffee chain:

- `zus-coffee` — ZUS Coffee
- `luckin-coffee` — Luckin Coffee
- `coffee-bean-tea-leaf` — The Coffee Bean & Tea Leaf
- `san-francisco-coffee` — San Francisco Coffee

Every outlet keeps the same `name`, `address`, `city`, `state`, `lat`, and `lng` fields. Unknown cities or coordinates are `null`; no coordinates are guessed. `src/outlets.ts` exports `outletsByChain` for access to each chain. The current ZUS randomizer, directory, and transit snapshot use the `zus-coffee` group.

Each outlet also has a `locationType` with exactly two groups:

- `standalone-shop`: street-facing shops/shoplots and separately accessed drive-through cafes. This includes row shops; it does not require a detached building.
- `inside-building`: outlets hosted within malls/shopping centres, office buildings, airports, hospitals, hotels, universities, residential retail buildings and other facilities. Managed shopping venues can include open-air outlet centres.

`locationTypeEvidence` records the basis (`address`, `official-venue`, or `inferred`), an explanation and, where applicable, a source URL. These are classifications of the saved listings, not a survey of every entrance. Address-only and ambiguous street-shop/drive-through cases are explicitly marked `inferred`.

Refreshes apply the same classification rules automatically. Named venue evidence lives in `src/data/outlet-location-venues.json`; individual exceptions in `src/data/outlet-location-overrides.json` match the chain, full name and full address so an address change cannot silently inherit an old exception. A refresh with an unresolved location fails before replacing the saved chain.

After reviewing venue evidence or exceptions, reclassify the saved snapshot without fetching new outlets:

```sh
pnpm run classify-outlets
pnpm run check-outlets
```

Refresh one chain at a time; each command preserves the other groups:

```sh
pnpm run fetch-outlets
pnpm run fetch-outlets:luckin
pnpm run fetch-outlets:cbtl
pnpm run fetch-outlets:sf
```

Refresh all chains sequentially and validate the dataset:

```sh
pnpm run fetch-outlets:all
pnpm run check-outlets
```

Run refresh commands sequentially to avoid concurrent writers. The new-chain fetchers also accept `--output <path>` to save a standalone array for inspection without changing the shared dataset. Official sources and snapshot coverage are recorded in `src/data/outlet-sources.json`. These are saved listings, not a guarantee of current operating status.

Nearby transport lives in `src/data/transit.json`, a local snapshot derived from [OpenStreetMap](https://www.openstreetmap.org/copyright) data (ODbL). Refresh it after updating outlets:

```sh
pnpm fetch-transit
```

The refresh uses Overpass to find Malaysian rail stations and bus stops, excluding mapped private, disused, and freight-only stops. Matches are tied to outlet names and coordinates so changed outlets must be refreshed. Distances are straight-line estimates, not walking routes; map coverage and service availability may vary. No transport API is called during a spin.

## Deployment

Pushes to `main` are built and deployed by Cloudflare Workers Builds. Preview builds and preview URLs are disabled; the Worker is only served from `kopi.ruxera.com`.

Configure Workers Builds with build command `pnpm run build` and deploy command `pnpm exec cf deploy --prebuilt` so it uploads the generated Build Output.

For a local deployment, run `pnpm exec cf auth login` if needed, then `pnpm run deploy`. That command builds and deploys the project. To validate an existing build without uploading, run `pnpm exec cf deploy --prebuilt --dry-run`.

---

Unofficial fan project. Not affiliated with ZUS Coffee.
