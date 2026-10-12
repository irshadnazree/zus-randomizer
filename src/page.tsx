import { html } from 'hono/html'

type Props = {
  states: { name: string; count: number }[]
  total: number
  hasCoordinates: boolean
}

export function Page({ states, total, hasCoordinates }: Props) {
  return (
    <>
      {html`<!doctype html>`}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>ZUS Roulette · Pick a random ZUS Coffee in Malaysia</title>
          <meta name="description" content={`Can't decide which ZUS Coffee to go to? Spin and let fate pick one of ${total} outlets across Malaysia.`} />
          <meta name="theme-color" content="#071a40" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="preconnect" href="https://rsms.me/" />
          <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
          <link rel="stylesheet" href="/style.css" />
          <script src="/vendor/confetti.js" defer></script>
          <script src="/app.js" defer></script>
        </head>
        <body class="min-h-dvh bg-zus-950 font-sans text-white antialiased">
          <div class="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 sm:py-14">
            <header class="mb-8">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zus-200">ZUS Roulette</p>
                <button
                  id="sound"
                  type="button"
                  aria-pressed="true"
                  class="rounded-full px-3 py-1 text-xs font-medium text-zus-200 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
                >
                  Sound on
                </button>
              </div>
              <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Which ZUS today?</h1>
              <p class="mt-2 text-zus-200">
                Spin to pick a random ZUS Coffee from <span class="font-semibold text-white">{total}</span> outlets across Malaysia.
              </p>
            </header>

            <main class="flex flex-1 flex-col gap-5">
              <section
                id="result"
                aria-live="polite"
                class="relative flex min-h-64 flex-col justify-center overflow-hidden rounded-3xl bg-white p-6 text-zus-950 shadow-2xl shadow-black/40"
              >
                <div id="placeholder" class="text-center">
                  <div class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-zus-50 text-2xl">☕</div>
                  <p class="font-medium text-zus-800">Press spin and let fate decide.</p>
                  <p class="mt-1 text-sm text-zus-500">Filter by state, your location, or any place.</p>
                </div>

                <p id="reel" aria-hidden="true" class="hidden text-center text-2xl font-bold text-zus-700 select-none sm:text-3xl"></p>

                <div id="picked" class="hidden">
                  <p class="text-xs font-semibold uppercase tracking-widest text-zus-500">Your ZUS is</p>
                  <h2 id="picked-name" class="mt-1 text-2xl font-bold leading-tight sm:text-3xl"></h2>
                  <p id="picked-address" class="mt-3 text-sm leading-relaxed text-zus-800"></p>
                  <div class="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span id="picked-state" class="rounded-full bg-zus-50 px-3 py-1 text-zus-700"></span>
                    <span id="picked-distance" class="hidden rounded-full bg-zus-50 px-3 py-1 text-zus-700"></span>
                  </div>
                  <p id="picked-transit" class="hidden mt-3 text-sm text-zus-700"></p>
                  <div class="mt-5 grid grid-cols-2 gap-2">
                    <a
                      id="link-gmaps"
                      target="_blank"
                      rel="noopener"
                      class="rounded-xl bg-zus-800 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-zus-700"
                    >
                      Google Maps
                    </a>
                    <a
                      id="link-waze"
                      target="_blank"
                      rel="noopener"
                      class="rounded-xl border border-zus-200 px-4 py-3 text-center text-sm font-semibold text-zus-800 transition hover:bg-zus-50"
                    >
                      Waze
                    </a>
                  </div>
                </div>

                <p id="error" class="hidden text-center font-medium text-red-600"></p>
              </section>

              <form id="controls" class="grid gap-3 rounded-3xl bg-zus-900 p-5 ring-1 ring-white/10">
                <label class="grid gap-1.5 text-sm">
                  <span class="font-medium text-zus-100">State</span>
                  <select
                    id="state"
                    name="state"
                    class="w-full rounded-xl border-0 bg-zus-800 px-3 py-2.5 text-white ring-1 ring-white/10 focus:ring-2 focus:ring-zus-200 focus:outline-none"
                  >
                    <option value="">Anywhere in Malaysia</option>
                    {states.map((s) => (
                      <option value={s.name}>
                        {s.name} ({s.count})
                      </option>
                    ))}
                  </select>
                </label>

                {hasCoordinates && (
                  <fieldset class="grid gap-1.5 text-sm">
                    <legend class="mb-1.5 font-medium text-zus-100">Near</legend>
                    <div class="grid grid-cols-3 gap-1 rounded-xl bg-zus-800 p-1 ring-1 ring-white/10">
                      {[
                        ['off', 'Anywhere'],
                        ['me', 'My location'],
                        ['place', 'A place'],
                      ].map(([value, label]) => (
                        <label class="cursor-pointer">
                          <input type="radio" name="near" value={value} checked={value === 'off'} class="peer sr-only" />
                          <span class="block rounded-lg px-2 py-2 text-center font-medium text-zus-200 transition peer-checked:bg-white peer-checked:text-zus-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zus-200">
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <input
                      id="place"
                      name="place"
                      type="text"
                      placeholder="e.g. Bangsar, Sunway Pyramid, Ipoh"
                      autocomplete="off"
                      enterkeyhint="go"
                      class="hidden w-full rounded-xl border-0 bg-zus-800 px-3 py-2.5 text-white ring-1 ring-white/10 placeholder:text-zus-200/50 focus:ring-2 focus:ring-zus-200 focus:outline-none"
                    />
                    <p id="near-status" class="hidden text-xs text-zus-200"></p>
                    <select
                      id="radius"
                      name="radius"
                      disabled
                      aria-label="Distance"
                      class="w-full rounded-xl border-0 bg-zus-800 px-3 py-2.5 text-white ring-1 ring-white/10 focus:ring-2 focus:ring-zus-200 focus:outline-none disabled:opacity-40"
                    >
                      <option value="2">Within 2 km</option>
                      <option value="5" selected>
                        Within 5 km
                      </option>
                      <option value="10">Within 10 km</option>
                      <option value="25">Within 25 km</option>
                    </select>
                  </fieldset>
                )}

                <div class="grid gap-1.5 text-sm">
                  <label class="flex cursor-pointer items-center gap-3 rounded-xl bg-zus-800 px-3 py-3 ring-1 ring-white/10">
                    <input id="transit" name="transit" type="checkbox" aria-describedby="transit-help" class="size-4 shrink-0 accent-zus-200" />
                    <span class="font-medium text-zus-100">Near public transport</span>
                  </label>
                  <p id="transit-help" class="text-xs leading-relaxed text-zus-200">
                    Within 500 m of a train station or bus stop. Straight-line distance; walking routes may be longer.{' '}
                    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" class="underline hover:text-white">© OpenStreetMap contributors</a>.
                  </p>
                </div>

                <button
                  id="spin"
                  type="submit"
                  class="mt-2 rounded-2xl bg-white px-6 py-4 text-lg font-bold text-zus-900 shadow-lg transition hover:bg-zus-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                >
                  Spin
                </button>
              </form>
            </main>

            <footer class="mt-10 text-center text-xs text-zus-200/70">
              Unofficial fan project · not affiliated with ZUS Coffee ·{' '}
              <a class="underline hover:text-white" href="https://github.com/irshadnazree/zus-randomizer">
                source
              </a>
            </footer>
          </div>
        </body>
      </html>
    </>
  )
}
