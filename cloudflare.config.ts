import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'zus-randomizer',
    compatibilityDate: '2026-10-01',
    entrypoint: 'src/index.tsx',
    // Production only: no workers.dev or per-version preview URLs.
    workersDev: false,
    previewUrls: false,
    observability: { enabled: true },
    domains: ['kopi.ruxera.com'],
  },
})
