# ZUS Roulette

Can't decide which ZUS Coffee to go to? Spin and let fate pick one for you.

Live at **https://zus.ruxera.com**

Built with [Hono](https://hono.dev) (JSX, server-rendered) on Cloudflare Workers and styled with [Tailwind CSS](https://tailwindcss.com) v4.

## Features

- Random pick from every ZUS Coffee outlet in Malaysia
- Filter by state
- Near mode: pick within 2–25 km of your current location or any place you type (geocoded via OpenStreetMap)
- Near public transport: only pick outlets within 500 m of a mapped train station or bus stop; combines with state and location filters
- Blurred slot-style reel, with tick sounds, a win chime and confetti on the pick (sound can be muted)
- One-tap Google Maps and Waze directions

## Development

```sh
npm install
npm run dev        # builds CSS + vendor assets, then starts wrangler dev
npm run typecheck
```

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/random?state=&lat=&lng=&place=&radius=&transit=true` | One random outlet matching the optional filters |
| `GET /api/outlets?state=&lat=&lng=&place=&radius=&transit=true` | All outlets matching the optional filters |

`place` is free text (e.g. `Bangsar`) and takes precedence over `lat`/`lng`.
`transit=true` enables the public transport filter. Matching outlets include `publicTransport` with the nearest mapped stop and its straight-line `distanceKm`.

## Outlet data

Outlets live in `src/data/outlets.json`. Refresh them with:

```sh
npm run fetch-outlets
```

Nearby transport lives in `src/data/transit.json`, a local snapshot derived from [OpenStreetMap](https://www.openstreetmap.org/copyright) data (ODbL). Refresh it after updating outlets:

```sh
pnpm fetch-transit
```

The refresh uses Overpass to find Malaysian rail stations and bus stops, excluding mapped private, disused, and freight-only stops. Matches are tied to outlet names and coordinates so changed outlets must be refreshed. Distances are straight-line estimates, not walking routes; map coverage and service availability may vary. No transport API is called during a spin.

## Deployment

Pushes to `main` are built and deployed by Cloudflare Workers Builds. Preview builds and preview URLs are disabled; the Worker is only served from `zus.ruxera.com`.

---

Unofficial fan project. Not affiliated with ZUS Coffee.
