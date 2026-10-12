import { raw } from 'hono/html'

export const SITE_URL = 'https://zus.ruxera.com'
export const SITE_NAME = 'ZUS Roulette'
export const STORE_SOURCE = 'https://zuscoffee.com/our-stores/'

export function statePath(name: string) {
  return `/outlets/${name.toLowerCase().replace(/\s+/g, '-')}`
}

export function StructuredData({ data }: { data: unknown }) {
  // JSON is embedded in HTML, so escape characters that could close the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  return <script type="application/ld+json">{raw(json)}</script>
}

type HeadProps = {
  title: string
  description: string
  path: string
  noindex?: boolean
  interactive?: boolean
  pageType?: 'WebPage' | 'CollectionPage'
  mainEntityId?: string
  schema?: Record<string, unknown>[]
}

export function Head({ title, description, path, noindex = false, interactive = false, pageType = 'WebPage', mainEntityId, schema = [] }: HeadProps) {
  const url = `${SITE_URL}${path}`
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'} />
      {!noindex && <link rel="canonical" href={url} />}
      <meta name="theme-color" content="#071a40" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_MY" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="ZUS Roulette — pick a random ZUS Coffee in Malaysia. Filter by state or find an outlet nearby." />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
      <meta name="twitter:image:alt" content="ZUS Roulette — pick a random ZUS Coffee in Malaysia." />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="stylesheet" href="/style.css" />
      {!noindex && <StructuredData data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_NAME, inLanguage: 'en-MY', description: 'An unofficial ZUS Coffee outlet randomizer and directory for Malaysia.' },
          { '@type': pageType, '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'en-MY', isPartOf: { '@id': `${SITE_URL}/#website` }, ...(mainEntityId ? { mainEntity: { '@id': mainEntityId } } : {}) },
          ...schema,
        ],
      }} />}
      {interactive && <script src="/vendor/confetti.js" defer></script>}
      {interactive && <script src="/app.js" defer></script>}
    </head>
  )
}

export function Footer() {
  return (
    <footer class="mt-10 text-center text-xs leading-relaxed text-zus-200">
      <nav aria-label="Footer" class="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
        <a class="underline hover:text-white" href="/">Randomizer</a>
        <a class="underline hover:text-white" href="/outlets">Outlet directory</a>
        <a class="underline hover:text-white" href={STORE_SOURCE}>Official ZUS stores</a>
        <a class="underline hover:text-white" href="https://github.com/irshadnazree/zus-randomizer">Source code</a>
      </nav>
      <p>Unofficial fan project. Not affiliated with ZUS Coffee.</p>
    </footer>
  )
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" class="mb-6 text-sm text-zus-200">
      <ol class="flex flex-wrap gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li class="flex gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === items.length - 1 ? <span aria-current="page">{item.name}</span> : <a class="underline hover:text-white" href={item.path}>{item.name}</a>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` })),
  }
}
