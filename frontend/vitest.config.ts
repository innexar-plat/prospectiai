import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig({
  ...viteConfig,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/**/*.d.ts',
        'src/vite-env.d.ts',
        'src/pages/**',
        'src/components/**',
        'src/hooks/**',
        'src/lib/api.ts',
        'src/lib/exportService.ts',
        'src/lib/searchService.ts',
        'src/lib/seo-local.ts',
        'src/lib/tour-steps.ts',
        'src/lib/request-helpers.ts',
        'src/lib/date-utils.ts',
        'src/lib/locationData.ts',
        'src/lib/placeTypes.ts',
        'src/lib/LeadFormSchema.ts',
        'src/contexts/SearchResultsContext.tsx',
      ],
      threshold: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
