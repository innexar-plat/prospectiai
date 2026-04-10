import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const buildTimestamp = new Date().toISOString();

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

// https://vite.dev/config/
export default defineConfig({
  base: '/admin/',
  plugins: [tailwindcss(), react(), versionJsonPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTimestamp),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5174,
    allowedHosts: ['precisionia.com.br', 'localhost'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:4000',
        changeOrigin: false,
        secure: false
      }
    }
  }
})
