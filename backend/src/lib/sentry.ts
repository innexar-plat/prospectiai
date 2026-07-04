/**
 * Sentry (SaaS) initialisation stub.
 *
 * To activate:
 *   1. Set SENTRY_DSN in your environment (backend/.env)
 *   2. Uncomment the init() call below
 *   3. Run: npm install @sentry/nextjs
 *
 * We keep this as an optional import so the build does not fail when
 * the package is missing.  Import it from layout.tsx or instrumentation.ts
 * once the dependency is installed.
 */
// import * as Sentry from '@sentry/nextjs';
//
// Sentry.init({
//   dsn: process.env.SENTRY_DSN,
//   environment: process.env.NODE_ENV ?? 'production',
//   tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
//   integrations: [],
// });

export {};
