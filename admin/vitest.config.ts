import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig({
  ...viteConfig,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/__tests__/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/pages/**',
      ],
      // 85% on lib + components (pages have separate smoke tests; full coverage in follow-up).
      threshold: {
        lines: 85,
        functions: 74,
        branches: 68,
        statements: 85,
      },
    },
  },
});
