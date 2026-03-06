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
        'src/components/dashboard/billing/**',
        'src/components/dashboard/InstallPrompt.tsx',
        'src/components/dashboard/OnboardingTour.tsx',
        'src/components/dashboard/DashboardTourTrigger.tsx',
      ],
      // 85% on lib + components + contexts (pages and heavy billing/tours excluded).
      threshold: {
        lines: 85,
        functions: 62,
        branches: 75,
        statements: 85,
      },
    },
  },
});
