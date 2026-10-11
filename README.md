# ZUS Roulette

Can't decide which ZUS Coffee to go to? Spin and let fate pick one for you.

Live at **https://zus.ruxera.com**

Built with [Hono](https://hono.dev) (JSX, server-rendered) on Cloudflare Workers and styled with [Tailwind CSS](https://tailwindcss.com) v4.

## Features

- Random pick from every ZUS Coffee outlet in Malaysia
- Filter by state
- "Only near me" mode using your browser location (2–25 km radius)
- One-tap Google Maps and Waze directions

## Development

```sh
npm install
npm run dev        # builds CSS, then starts wrangler dev
npm run typecheck
```

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/random?state=&lat=&lng=&radius=` | One random outlet matching the optional filters |
| `GET /api/outlets?state=&lat=&lng=&radius=` | All outlets matching the optional filters |

## Outlet data

Outlets live in `src/data/outlets.json`. Refresh them with:

```sh
npm run fetch-outlets
```

## Deployment

Pushes to `main` are built and deployed by Cloudflare Workers Builds. Preview builds and preview URLs are disabled; the Worker is only served from `zus.ruxera.com`.

---

Unofficial fan project. Not affiliated with ZUS Coffee.
