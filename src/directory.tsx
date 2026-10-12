import { html } from 'hono/html'
import { outlets, states, type Outlet } from './outlets'
import { Breadcrumbs, Footer, Head, SITE_URL, STORE_SOURCE, breadcrumbSchema, statePath } from './seo'

export function directions(outlet: Outlet) {
  const hasCoords = outlet.lat != null && outlet.lng != null
  const query = hasCoords ? `${outlet.lat},${outlet.lng}` : `${outlet.name}, ${outlet.address}`
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    waze: hasCoords
      ? `https://waze.com/ul?ll=${outlet.lat},${outlet.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(`${outlet.name} ${outlet.address}`)}&navigate=yes`,
  }
}

export function Directory({ state }: { state?: string }) {
  const pool = state ? outlets.filter((outlet) => outlet.state === state) : []
  const path = state ? statePath(state) : '/outlets'
  const title = state ? `ZUS Coffee ${state}: ${pool.length} Listed Outlets | ZUS Roulette` : 'ZUS Coffee Outlets in Malaysia by State | ZUS Roulette'
  const description = state
    ? `Browse ${pool.length} listed ZUS Coffee outlets in ${state}. Find branch addresses, open Google Maps or Waze directions, or pick a random outlet to visit.`
    : `Browse ${outlets.length} listed ZUS Coffee outlets across ${states.length} Malaysian states and federal territories. Find branch addresses and Google Maps or Waze directions.`
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Outlet directory', path: '/outlets' }, ...(state ? [{ name: state, path }] : [])]
  const listId = `${SITE_URL}${path}#outlets`
  const list = state
    ? pool.map((outlet, index) => ({
        '@type': 'ListItem', position: index + 1,
        item: {
          '@type': 'CafeOrCoffeeShop', name: outlet.name,
          address: { '@type': 'PostalAddress', streetAddress: outlet.address, addressRegion: outlet.state, addressCountry: 'MY', ...(outlet.city ? { addressLocality: outlet.city } : {}) },
          hasMap: directions(outlet).maps,
          ...(outlet.lat != null && outlet.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: outlet.lat, longitude: outlet.lng } } : {}),
        },
      }))
    : states.map((region, index) => ({ '@type': 'ListItem', position: index + 1, name: `ZUS Coffee outlets in ${region.name}`, url: `${SITE_URL}${statePath(region.name)}` }))

  return (
    <>
      {html`<!doctype html>`}
      <html lang="en-MY">
        <Head title={title} description={description} path={path} pageType="CollectionPage" mainEntityId={listId} schema={[
          breadcrumbSchema(crumbs),
          { '@type': 'ItemList', '@id': listId, name: state ? `ZUS Coffee outlets in ${state}` : 'ZUS Coffee directory by state', numberOfItems: list.length, itemListElement: list },
        ]} />
        <body class="min-h-dvh bg-zus-950 font-sans text-white antialiased">
          <div class="mx-auto max-w-3xl px-5 py-8 sm:py-14">
            <Breadcrumbs items={crumbs} />
            <header>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zus-200">ZUS Roulette · outlet directory</p>
              <h1 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">ZUS Coffee outlets {state ? `in ${state}` : 'in Malaysia'}</h1>
              <p class="mt-4 leading-relaxed text-zus-100">
                {state ? `Our directory lists ${pool.length} ZUS Coffee outlets in ${state}. Browse branch addresses and open map directions below, or let the randomizer choose a branch for you.` : `Our directory lists ${outlets.length} ZUS Coffee outlets across ${states.length} states and federal territories in Malaysia. Choose a region to see branch addresses and directions.`}
              </p>
              <a href={state ? `/?state=${encodeURIComponent(state)}` : '/'} class="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zus-900 hover:bg-zus-50">{state ? `Pick a random outlet in ${state}` : 'Pick a random ZUS Coffee'}</a>
            </header>
            <main class="mt-8">
              {state ? (
                <ul class="grid gap-4">
                  {pool.map((outlet) => {
                    const links = directions(outlet)
                    return (
                      <li class="rounded-2xl bg-zus-900 p-5 ring-1 ring-white/10">
                        <h2 class="text-lg font-semibold">{outlet.name}</h2>
                        <p class="mt-2 text-sm leading-relaxed text-zus-100">{outlet.address}</p>
                        <p class="mt-2 text-xs text-zus-200">{[outlet.city, outlet.state].filter((name, index, all) => name && all.indexOf(name) === index).join(', ')}</p>
                        <div class="mt-4 flex flex-wrap gap-4 text-sm">
                          <a href={links.maps} target="_blank" rel="noopener noreferrer" aria-label={`Google Maps directions to ${outlet.name}`} class="underline hover:text-zus-200">Google Maps</a>
                          <a href={links.waze} target="_blank" rel="noopener noreferrer" aria-label={`Waze directions to ${outlet.name}`} class="underline hover:text-zus-200">Waze</a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <ul class="grid gap-3 sm:grid-cols-2">
                  {states.map((region) => (
                    <li><a href={statePath(region.name)} class="block h-full rounded-2xl bg-zus-900 p-5 ring-1 ring-white/10 hover:bg-zus-800"><h2 class="font-semibold">ZUS Coffee in {region.name}</h2><p class="mt-2 text-sm text-zus-200">{region.count} listed outlets · addresses &amp; directions</p></a></li>
                  ))}
                </ul>
              )}
              <section class="mt-8 border-t border-white/10 pt-6" aria-labelledby="directory-source">
                <h2 id="directory-source" class="text-lg font-semibold">Where do these outlet listings come from?</h2>
                <p class="mt-3 text-sm leading-relaxed text-zus-100">Names and addresses are sourced from the <a href={STORE_SOURCE} class="underline hover:text-white">official ZUS Coffee store directory</a>. This is a saved dataset, not a live store feed. We do not verify opening hours or current operating status. Check official ZUS channels and your map listing before travelling.</p>
                {state && <p class="mt-4 text-sm"><a href="/outlets" class="underline hover:text-zus-200">Browse all Malaysian states and federal territories</a></p>}
              </section>
            </main>
            <Footer />
          </div>
        </body>
      </html>
    </>
  )
}

export function NotFound() {
  return (
    <>
      {html`<!doctype html>`}
      <html lang="en-MY">
        <Head title="Page not found | ZUS Roulette" description="This page does not exist. Pick a random ZUS Coffee outlet or browse the Malaysia outlet directory." path="/" noindex />
        <body class="min-h-dvh bg-zus-950 font-sans text-white antialiased">
          <div class="mx-auto max-w-xl px-5 py-14">
            <main><h1 class="text-3xl font-bold">Page not found</h1><p class="mt-4 text-zus-100">That page does not exist. <a href="/" class="underline">Spin the ZUS randomizer</a> or <a href="/outlets" class="underline">browse outlet addresses</a>.</p></main>
            <Footer />
          </div>
        </body>
      </html>
    </>
  )
}
