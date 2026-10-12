# ZUS Roulette

Can't decide which ZUS Coffee to go to? Spin and let fate pick one for you.

Live at **https://zus.ruxera.com**

Built with [Hono](https://hono.dev) (JSX, server-rendered) on Cloudflare Workers and styled with [Tailwind CSS](https://tailwindcss.com) v4.

## Features

- Random pick from every ZUS Coffee outlet in Malaysia
- Filter by state
- Near mode: pick within 2–25 km of your current location or any place you type (geocoded via OpenStreetMap)
- Blurred slot-style reel, with tick sounds, a win chime and confetti on the pick (sound can be muted)
- One-tap Google Maps and Waze directions
- Server-rendered outlet directory by state, with addresses and directions

## Search and answer-engine discovery

- `/outlets` links to every state/territory represented in the saved dataset. Each `/outlets/:state` page renders all matching names, addresses, and map links without JavaScript.
- Each page has a unique title, description, production canonical URL, Open Graph metadata, and a 1200 × 630 PNG social preview. Query variants of the randomizer canonicalize to `/`.
- `/sitemap.xml` is generated from the same state data; `/robots.txt` allows crawling and advertises the sitemap. No artificial `lastmod` dates are emitted.
- JSON-LD describes the website, free randomizer, visible FAQ answers, directory lists, and breadcrumbs. Outlet schema only includes known names, addresses, coordinates, and map links. It does not invent reviews, hours, or current operating status.
- Unknown pages return HTTP 404 with `noindex`; trailing slashes redirect permanently. API responses have `X-Robots-Tag: noindex`, and random responses are never cached, including errors.
- FAQs and source links explain the saved-data limitations and unofficial status. Structured data supports understanding; it does not guarantee rich results or AI citations.

Verify the running server without starting another one:

```sh
pnpm run typecheck
pnpm run build:css
pnpm run build:vendor
node scripts/check-seo.mjs http://localhost:8787
```

After deploying, submit `https://zus.ruxera.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools. Inspect the homepage and a state page to verify indexing. Search-engine and AI visibility depends on crawling, indexing, and relevance; it cannot be confirmed by local checks.

## Development

Use Node.js 22 (see `.node-version`) and pnpm 11.9.0.

```sh
pnpm install
pnpm run dev        # Wrangler builds CSS + vendor assets before starting
pnpm run typecheck
pnpm run build
```

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/random?state=&lat=&lng=&place=&radius=` | One random outlet matching the optional filters |
| `GET /api/outlets?state=&lat=&lng=&place=&radius=` | All outlets matching the optional filters |

`place` is free text (e.g. `Bangsar`) and takes precedence over `lat`/`lng`.

## Outlet data

Outlets live in `src/data/outlets.json`. Refresh them with:

```sh
pnpm run fetch-outlets
```

## Deployment

Pushes to `main` are built and deployed by Cloudflare Workers Builds. Preview builds and preview URLs are disabled; the Worker is only served from `zus.ruxera.com`.

---

Unofficial fan project. Not affiliated with ZUS Coffee.
