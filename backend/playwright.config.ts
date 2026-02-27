import { defineConfig } from '@playwright/test';
// E2E_BASE_URL: stack local = http://localhost:5173 (frontend, proxy /api); API-only = http://localhost:3010 (backend).
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL },
  timeout: 15000,
});
