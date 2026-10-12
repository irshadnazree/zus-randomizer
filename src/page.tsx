import { html } from 'hono/html'
import { getFaqs } from './content'
import { Footer, Head, SITE_URL, STORE_SOURCE, statePath } from './seo'

type Props = {
  states: { name: string; count: number }[]
  total: number
  hasCoordinates: boolean
  selectedState?: string
}

export function Page({ states, total, hasCoordinates, selectedState }: Props) {
  const faqs = getFaqs(total, states.length, hasCoordinates)
  return (
    <>
      {html`<!doctype html>`}
      <html lang="en-MY">
        <Head
          title="ZUS Coffee Randomizer Malaysia | ZUS Roulette"
          description={`Pick a random ZUS Coffee in Malaysia from ${total} listed outlets. Filter by state or find a branch nearby, then open Google Maps or Waze directions.`}
          path="/"
          interactive
          schema={[
            { '@type': 'WebApplication', '@id': `${SITE_URL}/#randomizer`, name: 'ZUS Roulette', alternateName: 'ZUS Coffee Randomizer', url: `${SITE_URL}/`, applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'MYR' }, description: faqs[0].answer },
            { '@type': 'FAQPage', '@id': `${SITE_URL}/#faq`, isPartOf: { '@id': `${SITE_URL}/#webpage` }, mainEntity: faqs.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
          ]}
        />
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
              <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pick a random ZUS Coffee</h1>
              <p class="mt-2 text-zus-200">
                Which ZUS today? Spin to choose from <span class="font-semibold text-white">{total}</span> listed outlets across Malaysia.
              </p>
            </header>

            <main id="main" class="flex flex-1 flex-col gap-5">
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
                      <option value={s.name} selected={selectedState === s.name}>
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
                      aria-label="Town, mall, or landmark in Malaysia"
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
              <noscript>
                <p class="rounded-xl bg-zus-900 p-4 text-sm text-zus-100">Enable JavaScript to spin the randomizer, or <a href="/outlets" class="underline">browse ZUS Coffee outlet addresses and directions</a> below.</p>
              </noscript>

              <section aria-labelledby="how-it-works" class="mt-5 border-t border-white/10 pt-7">
                <h2 id="how-it-works" class="text-xl font-semibold">How to choose your next ZUS</h2>
                <p class="mt-3 text-sm leading-relaxed text-zus-100">ZUS Roulette is a free, unofficial branch picker for Malaysia. Keep it spontaneous or narrow down the outlets before you spin.</p>
                <ol class="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zus-100">
                  <li>Choose a state or leave it on Anywhere in Malaysia.</li>
                  {hasCoordinates && <li>For a nearby pick, use My location or enter A place, then choose a distance.</li>}
                  <li>Press Spin to choose an outlet from your matching results.</li>
                  <li>Open Google Maps or Waze to plan your trip. Check current opening hours before heading out.</li>
                </ol>
              </section>

              <section aria-labelledby="browse-states" class="mt-2">
                <h2 id="browse-states" class="text-xl font-semibold">Browse ZUS Coffee outlets by state</h2>
                <p class="mt-2 text-sm leading-relaxed text-zus-100">Prefer to choose yourself? Find addresses and map directions in our <a href="/outlets" class="underline hover:text-white">Malaysia outlet directory</a>.</p>
                <ul class="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {states.map((state) => (
                    <li><a href={statePath(state.name)} class="flex h-full items-center justify-between gap-2 rounded-xl bg-zus-900 px-3 py-3 text-zus-100 ring-1 ring-white/10 hover:bg-zus-800"><span>{state.name}</span><span class="text-xs text-zus-200">{state.count}</span></a></li>
                  ))}
                </ul>
              </section>

              <section id="faq" aria-labelledby="faq-heading" class="mt-5 border-t border-white/10 pt-7">
                <h2 id="faq-heading" class="text-xl font-semibold">ZUS Coffee randomizer: common questions</h2>
                <div class="mt-4 divide-y divide-white/10">
                  {faqs.map(({ question, answer }) => (
                    <details class="group py-4">
                      <summary class="cursor-pointer font-medium text-zus-50">{question}</summary>
                      <p class="mt-3 text-sm leading-relaxed text-zus-100">{answer}</p>
                    </details>
                  ))}
                </div>
                <p class="mt-4 text-xs leading-relaxed text-zus-200">Outlet listings are a saved snapshot sourced from the <a href={STORE_SOURCE} class="underline hover:text-white">official ZUS Coffee store directory</a>. Addresses and availability can change; verify your chosen branch before visiting.</p>
              </section>
            </main>
            <Footer />
          </div>
        </body>
      </html>
    </>
  )
}
