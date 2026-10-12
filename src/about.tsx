import { html } from 'hono/html'
import { getFaqs } from './content'
import { hasCoordinates, outlets, states } from './outlets'
import { Breadcrumbs, Footer, Head, SITE_URL, STORE_SOURCE, breadcrumbSchema, statePath } from './seo'

export function About() {
  const faqs = getFaqs(outlets.length, states.length, hasCoordinates)
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }]
  return (
    <>
      {html`<!doctype html>`}
      <html lang="en-MY">
        <Head
          title="About ZUS Roulette | How It Works & FAQs"
          description="Learn how to pick a random ZUS Coffee outlet in Malaysia, browse outlets by state, and read common questions about ZUS Roulette and its saved directory."
          path="/about"
          pageType="AboutPage"
          schema={[
            breadcrumbSchema(crumbs),
            { '@type': 'FAQPage', '@id': `${SITE_URL}/about#faq`, isPartOf: { '@id': `${SITE_URL}/about#webpage` }, mainEntity: faqs.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
          ]}
        />
        <body class="min-h-dvh bg-zus-950 font-sans text-white antialiased">
          <div class="mx-auto max-w-xl px-5 py-8 sm:py-14">
            <Breadcrumbs items={crumbs} />
            <header>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zus-200">ZUS Roulette</p>
              <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">About ZUS Roulette</h1>
              <a href="/" class="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zus-900 hover:bg-zus-50">Pick a random ZUS Coffee</a>
            </header>
            <main class="mt-8 flex flex-col gap-5">
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
