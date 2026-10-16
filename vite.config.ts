import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'normalize-leading-slashes',
      enforce: 'pre',
      configureServer(server) {
        // Vite treats a leading // as a different host before the request reaches Hono.
        server.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith('//')) return next()
          const url = new URL(`http://localhost${request.url}`)
          response.writeHead(301, { Location: `/${url.pathname.replace(/^\/+|\/+$/g, '')}${url.search}` })
          response.end()
        })
      },
    },
    react(),
    tailwindcss(),
    cloudflare(),
  ],
  server: { port: 8787, strictPort: true },
  build: { minify: true },
})
