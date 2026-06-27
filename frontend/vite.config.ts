import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const buildTimestamp = new Date().toISOString();

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

/** Generates version.json in the build output so the app can detect new deploys. */
function versionJsonPlugin() {
  return {
    name: 'version-json',
    apply: 'build' as const,
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        path.join(outDir, 'version.json'),
        JSON.stringify({ version: pkg.version, buildTime: buildTimestamp }),
      );
    },
  }
}

// Plugins array: workspace hoists some deps; cast to satisfy defineConfig (single vite type).
export default defineConfig({
  plugins: [tailwindcss(), react(), spaFallback(), versionJsonPlugin()] as import('vite').PluginOption[],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTimestamp),
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (id.includes('/lib/i18n/bundles/pt')) return 'i18n-pt';
          if (id.includes('/lib/i18n/bundles/en')) return 'i18n-en';
          if (id.includes('/lib/i18n/bundles/es')) return 'i18n-es';
          if (id.includes('/lib/i18n/pages-messages')) return 'i18n-data';
          if (id.includes('/lib/i18n/support-messages')) return 'i18n-data';
          if (id.includes('/lib/i18n/landing-messages')) return 'i18n-data';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    allowedHosts: ['precisionia.com.br', 'precisionai.innexar.app', 'localhost'],
    proxy: {
      // In dev: proxy /api/* to the Next.js backend (container name for stable DNS)
      '/api': {
        target: 'http://prospector-backend:4000',
        changeOrigin: false,
        secure: false,
        headers: {
          'X-Forwarded-Host': 'precisionia.com.br',
          'X-Forwarded-Proto': 'https'
        }
      }
    }
  }
})
