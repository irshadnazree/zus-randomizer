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
