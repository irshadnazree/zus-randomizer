import { defineWranglerConfig } from 'wrangler/experimental-config'

export default defineWranglerConfig({
  build: { command: 'pnpm run build:assets' },
  minify: true,
  types: { generate: true },
  assetsDirectory: './public',
})
