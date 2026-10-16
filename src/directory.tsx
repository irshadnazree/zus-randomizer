import type { PageDocument } from './render'
import { outlets, states } from './outlets'
import { directions } from './directions'
import { Breadcrumbs, Footer, Head, SITE_URL, STORE_SOURCE, breadcrumbSchema, statePath } from './seo'

export function Directory({ state }: { state?: string }): PageDocument {
  const pool = state ? outlets.filter((outlet) => outlet.state === state) : []
  const path = state ? statePath(state) : '/outlets'
  const title = state
    ? `ZUS Coffee ${state}: ${pool.length} Listed Outlets | ZUS Roulette`
    : 'ZUS Coffee Outlets in Malaysia by State | ZUS Roulette'
  const description = state
    ? `Browse ${pool.length} listed ZUS Coffee outlets in ${state}. Find branch addresses, open Google Maps or Waze directions, or pick a random outlet to visit.`
    : `Browse ${outlets.length} listed ZUS Coffee outlets across ${states.length} Malaysian states and federal territories. Find branch addresses and Google Maps or Waze directions.`
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Outlet directory', path: '/outlets' }, ...(state ? [{ name: state, path }] : [])]
  const listId = `${SITE_URL}${path}#outlets`
  const list = state
    ? pool.map((outlet, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'CafeOrCoffeeShop',
          name: outlet.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: outlet.address,
            addressRegion: outlet.state,
            addressCountry: 'MY',
            ...(outlet.city ? { addressLocality: outlet.city } : {}),
          },
          hasMap: directions(outlet).maps,
          ...(outlet.lat != null && outlet.lng != null
            ? { geo: { '@type': 'GeoCoordinates', latitude: outlet.lat, longitude: outlet.lng } }
            : {}),
        },
      }))
    : states.map((region, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `ZUS Coffee outlets in ${region.name}`,
        url: `${SITE_URL}${statePath(region.name)}`,
      }))

  return {
    head: (
      <Head
        title={title}
        description={description}
        path={path}
        pageType="CollectionPage"
        mainEntityId={listId}
        schema={[
          breadcrumbSchema(crumbs),
          {
            '@type': 'ItemList',
            '@id': listId,
            name: state ? `ZUS Coffee outlets in ${state}` : 'ZUS Coffee directory by state',
            numberOfItems: list.length,
            itemListElement: list,
          },
        ]}
      />
    ),
    body: (
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-14">
        <Breadcrumbs items={crumbs} />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zus-200">ZUS Roulette · outlet directory</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">ZUS Coffee outlets {state ? `in ${state}` : 'in Malaysia'}</h1>
          <p className="mt-4 leading-relaxed text-zus-100">
            {state
              ? `Our directory lists ${pool.length} ZUS Coffee outlets in ${state}. Browse branch addresses and open map directions below, or let the randomizer choose a branch for you.`
              : `Our directory lists ${outlets.length} ZUS Coffee outlets across ${states.length} states and federal territories in Malaysia. Choose a region to see branch addresses and directions.`}
          </p>
          <a
            href={state ? `/?state=${encodeURIComponent(state)}` : '/'}
            className="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zus-900 hover:bg-zus-50"
          >
            {state ? `Pick a random outlet in ${state}` : 'Pick a random ZUS Coffee'}
          </a>
        </header>
        <main className="mt-8">
          {state ? (
            <ul className="grid gap-4">
              {pool.map((outlet) => {
                const links = directions(outlet)
                return (
                  <li key={`${outlet.name}:${outlet.address}`} className="rounded-2xl bg-zus-900 p-5 ring-1 ring-white/10">
                    <h2 className="text-lg font-semibold">{outlet.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zus-100">{outlet.address}</p>
                    <p className="mt-2 text-xs text-zus-200">
                      {[outlet.city, outlet.state].filter((name, index, all) => name && all.indexOf(name) === index).join(', ')}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      <a
                        href={links.maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Google Maps directions to ${outlet.name}`}
                        className="underline hover:text-zus-200"
                      >
                        Google Maps
                      </a>
                      <a
                        href={links.waze}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Waze directions to ${outlet.name}`}
                        className="underline hover:text-zus-200"
                      >
                        Waze
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {states.map((region) => (
                <li key={region.name}>
                  <a
                    href={statePath(region.name)}
                    className="block h-full rounded-2xl bg-zus-900 p-5 ring-1 ring-white/10 hover:bg-zus-800"
                  >
                    <h2 className="font-semibold">ZUS Coffee in {region.name}</h2>
                    <p className="mt-2 text-sm text-zus-200">{region.count} listed outlets · addresses &amp; directions</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <section className="mt-8 border-t border-white/10 pt-6" aria-labelledby="directory-source">
            <h2 id="directory-source" className="text-lg font-semibold">
              Where do these outlet listings come from?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zus-100">
              Names and addresses are sourced from the{' '}
              <a href={STORE_SOURCE} className="underline hover:text-white">
                official ZUS Coffee store directory
              </a>
              . This is a saved dataset, not a live store feed. We do not verify opening hours or current operating status. Check official
              ZUS channels and your map listing before travelling.
            </p>
            {state && (
              <p className="mt-4 text-sm">
                <a href="/outlets" className="underline hover:text-zus-200">
                  Browse all Malaysian states and federal territories
                </a>
              </p>
            )}
          </section>
        </main>
        <Footer />
      </div>
    ),
  }
}

export function NotFound(): PageDocument {
  return {
    head: (
      <Head
        title="Page not found | ZUS Roulette"
        description="This page does not exist. Pick a random ZUS Coffee outlet or browse the Malaysia outlet directory."
        path="/"
        noindex
      />
    ),
    body: (
      <div className="mx-auto max-w-xl px-5 py-14">
        <main>
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="mt-4 text-zus-100">
            That page does not exist.{' '}
            <a href="/" className="underline">
              Spin the ZUS randomizer
            </a>{' '}
            or{' '}
            <a href="/outlets" className="underline">
              browse outlet addresses
            </a>
            .
          </p>
        </main>
        <Footer />
      </div>
    ),
  }
}
