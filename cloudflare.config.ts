import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'zus-randomizer',
    compatibilityDate: '2026-10-01',
    entrypoint: 'src/index.tsx',
    env: { ASSETS: bindings.assets() },
    assets: {
      // All HTML routes go through Hono for SSR, metadata, redirects, and real 404s.
      runWorkerFirst: ['/*', '!/assets/*', '!/src/*', '!/@*', '!/node_modules/*', '!/favicon.svg', '!/og-image.png'],
      htmlHandling: 'none',
    },
    // Production only: no workers.dev or per-version preview URLs.
    workersDev: false,
    previewUrls: false,
    observability: { enabled: true },
    domains: ['kopi.ruxera.com'],
  },
})
