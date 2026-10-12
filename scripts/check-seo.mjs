// Check the running site, or an esbuild-generated Worker module without starting a server.
// node scripts/check-seo.mjs http://localhost:8787
// node scripts/check-seo.mjs --worker /tmp/zus-seo-worker.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const site = 'https://kopi.ruxera.com'
const outlets = JSON.parse(await readFile(new URL('../src/data/outlets.json', import.meta.url), 'utf8'))
const states = [...new Set(outlets.map((outlet) => outlet.state))].sort()
const statePath = (name) => `/outlets/${name.toLowerCase().replace(/\s+/g, '-')}`
const paths = ['/', '/about', '/outlets', ...states.map(statePath)]
const useWorker = process.argv[2] === '--worker'
const worker = useWorker ? (await import(pathToFileURL(process.argv[3]).href)).default : null
const base = useWorker ? site : process.argv[2] || 'http://localhost:8787'
const request = (path) => worker ? worker.request(`${base}${path}`) : fetch(`${base}${path}`, { redirect: 'manual' })
const titles = new Set()

for (const path of paths) {
  const response = await request(path)
  assert.equal(response.status, 200, path)
  assert.match(response.headers.get('content-type'), /text\/html/)
  const html = await response.text()
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
  assert.ok(title, `Missing title: ${path}`)
  assert.ok(!titles.has(title), `Duplicate title: ${title}`)
  titles.add(title)
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `One H1: ${path}`)
  assert.ok(html.includes(`rel="canonical" href="${site}${path}"`), `Canonical: ${path}`)
  assert.match(html, /<html lang="en-MY">/)
  assert.match(html, /name="description" content="[^"]+"/)
  assert.match(html, /name="robots" content="index, follow/)
  assert.match(html, /property="og:image" content="https:\/\/kopi\.ruxera\.com\/og-image\.png"/)
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.ok(!html.includes('https://rsms.me'), 'No render-blocking remote font CSS')

  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)?.[1] || 'null')
  assert.equal(data['@context'], 'https://schema.org')
  const graph = data['@graph']
  assert.equal(graph.find((node) => node['@id'] === `${site}${path}#webpage`).url, `${site}${path}`)

  if (path === '/') {
    assert.ok(!graph.some((node) => node['@type'] === 'FAQPage'), 'FAQ schema lives on About')
    for (const id of ['how-it-works', 'browse-states', 'faq']) {
      assert.ok(!html.includes(`id="${id}"`), `Informational section moved off homepage: ${id}`)
    }
    assert.ok(html.includes('id="controls"') && html.includes('id="spin"'), 'Randomizer remains available')
    assert.ok(html.includes('href="/about"'), 'About is linked from the randomizer')
  } else if (path === '/about') {
    assert.equal(graph.find((node) => node['@id'] === `${site}/about#webpage`)['@type'], 'AboutPage')
    const faq = graph.find((node) => node['@type'] === 'FAQPage')
    assert.equal(faq['@id'], `${site}/about#faq`)
    assert.equal(faq.isPartOf['@id'], `${site}/about#webpage`)
    assert.ok(faq.mainEntity.length >= 5)
    for (const question of faq.mainEntity) {
      assert.ok(html.includes(question.name), `Visible question: ${question.name}`)
      // FAQ copy is plain text; apostrophes may be encoded by the JSX renderer.
      const decoded = html.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      assert.ok(decoded.includes(question.acceptedAnswer.text), `Visible answer: ${question.name}`)
    }
    for (const id of ['how-it-works', 'browse-states', 'faq']) {
      assert.ok(html.includes(`id="${id}"`), `Informational section available on About: ${id}`)
    }
    assert.ok(html.includes('href="/"'), 'About links back to the randomizer')
    assert.ok(!html.includes('src="/app.js"'), 'About requires no randomizer JS')
    for (const state of states) assert.ok(html.includes(`href="${statePath(state)}"`))
  } else {
    assert.ok(!html.includes('src="/app.js"'), 'Directory requires no randomizer JS')
    const list = graph.find((node) => node['@type'] === 'ItemList')
    assert.equal(list.numberOfItems, list.itemListElement.length)
    if (path === '/outlets') {
      assert.equal(list.numberOfItems, states.length)
    } else {
      const state = states.find((name) => statePath(name) === path)
      const expected = outlets.filter((outlet) => outlet.state === state)
      assert.equal(list.numberOfItems, expected.length)
      const visible = html.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      expected.forEach((outlet, index) => {
        assert.equal(list.itemListElement[index].item.name, outlet.name)
        assert.equal(list.itemListElement[index].item.address.streetAddress, outlet.address)
        assert.ok(visible.includes(outlet.name) && visible.includes(outlet.address), `Server-rendered listing: ${outlet.name}`)
      })
    }
  }
}

const sitemapResponse = await request('/sitemap.xml')
assert.equal(sitemapResponse.status, 200)
assert.match(sitemapResponse.headers.get('content-type'), /application\/xml/)
const sitemap = await sitemapResponse.text()
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
assert.deepEqual(locations, paths.map((path) => `${site}${path}`))
assert.ok(!sitemap.includes('<lastmod>'), 'No invented freshness dates')
const robotsResponse = await request('/robots.txt')
assert.equal(robotsResponse.status, 200)
assert.match(await robotsResponse.text(), /User-agent: \*\nAllow: \/\n\nSitemap: https:\/\/kopi\.ruxera\.com\/sitemap.xml/)

for (const path of ['/does-not-exist', '/outlets/not-a-state', '/outlets/labuan']) {
  const response = await request(path)
  assert.equal(response.status, 404, `Real 404: ${path}`)
  assert.match(await response.text(), /name="robots" content="noindex, follow"/)
}
const redirect = await request('/outlets/kuala-lumpur/?example=1')
assert.equal(redirect.status, 301)
assert.equal(redirect.headers.get('location'), '/outlets/kuala-lumpur?example=1')
const aboutRedirect = await request('/about/?example=1')
assert.equal(aboutRedirect.status, 301)
assert.equal(aboutRedirect.headers.get('location'), '/about?example=1')
const doubleSlash = await request('//external.example/')
assert.equal(doubleSlash.status, 301)
assert.equal(doubleSlash.headers.get('location'), '/external.example', 'Slash normalization stays on the same site')
const stateSelection = await (await request('/?state=Kuala%20Lumpur')).text()
assert.match(stateSelection, /<option value="Kuala Lumpur" selected(?:="")?>/)
assert.ok(stateSelection.includes(`rel="canonical" href="${site}/"`))
const unsafeQuery = await (await request('/?state=%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E')).text()
assert.ok(!unsafeQuery.includes('alert(1)'), 'Unrecognized state query is not reflected')

for (const path of ['/api/outlets?state=Kuala%20Lumpur', '/api/random?state=Kuala%20Lumpur', '/api/random?state=not-a-state']) {
  const response = await request(path)
  assert.equal(response.headers.get('x-robots-tag'), 'noindex', `API noindex: ${path}`)
  if (path.includes('/random')) assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  if (response.ok && body.outlet) assert.equal(body.outlet.state, 'Kuala Lumpur')
}
const image = await readFile(new URL('../public/og-image.png', import.meta.url))
assert.equal(image.subarray(1, 4).toString(), 'PNG')
assert.equal(image.readUInt32BE(16), 1200)
assert.equal(image.readUInt32BE(20), 630)
if (!useWorker) {
  const imageResponse = await request('/og-image.png')
  assert.equal(imageResponse.status, 200, 'Social preview is served by the asset binding')
  assert.match(imageResponse.headers.get('content-type'), /image\/png/)
  const servedImage = Buffer.from(await imageResponse.arrayBuffer())
  assert.equal(servedImage.readUInt32BE(16), 1200)
  assert.equal(servedImage.readUInt32BE(20), 630)
}
console.log(`SEO checks passed: ${paths.length} indexable pages, ${outlets.length} server-rendered outlet listings, sitemap, metadata, FAQs, redirects, 404s, API crawl controls, and social image.`)
