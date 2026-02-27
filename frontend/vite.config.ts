import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** SPA fallback: serve index.html for client routes (evita 404 em /dashboard, /auth/signin, etc.) */
function spaFallback() {
  return {
    name: 'spa-fallback',
    apply: 'serve' as const,
    enforce: 'post' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, _res: ServerResponse, next: () => void) => {
        const url = req.url ?? ''
        if (url.startsWith('/api')) return next()
        if (url.includes('.')) return next()
        if (url.startsWith('/@') || url.startsWith('/node_modules')) return next()
        req.url = '/index.html'
        next()
      })
    },
  }
}

// Plugins array: workspace hoists some deps; cast to satisfy defineConfig (single vite type).
export default defineConfig({
  plugins: [tailwindcss(), react(), spaFallback()] as import('vite').PluginOption[],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    allowedHosts: ['prospectorai.innexar.com.br', 'localhost'],
    proxy: {
      // In dev: proxy /api/* to the Next.js backend (container name for stable DNS)
      '/api': {
        target: 'http://prospector-backend:4000',
        changeOrigin: false,
        secure: false,
        headers: {
          'X-Forwarded-Host': 'prospectorai.innexar.com.br',
          'X-Forwarded-Proto': 'https'
        }
      }
    }
  }
})
