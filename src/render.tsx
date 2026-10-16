import type { ReactNode } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server.edge'
import type { RandomizerProps } from './randomizer'

export type PageDocument = {
  head: ReactNode
  body: ReactNode
  randomizer?: RandomizerProps
}

// Vite transforms this template in development and fingerprints its assets for production.
// Fetch it through the assets binding so both modes use the same HTML and module URLs.
export async function renderPage(page: PageDocument, request: Request, assets: Fetcher) {
  const templateResponse = await assets.fetch(new Request(new URL('/index.html', request.url)))
  if (!templateResponse.ok) throw new Error('Vite HTML template is unavailable')
  const template = await templateResponse.text()
  const head = renderToStaticMarkup(page.head)
  let body = renderToString(page.randomizer ? <div id="randomizer">{page.body}</div> : page.body)
  if (page.randomizer) {
    // Escape HTML delimiters so saved outlet names can never terminate this JSON script.
    const props = JSON.stringify(page.randomizer).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    body += `<script id="randomizer-props" type="application/json">${props}</script>`
  }
  return template.replace('<!--app-head-->', () => head).replace('<!--app-body-->', () => body)
}
