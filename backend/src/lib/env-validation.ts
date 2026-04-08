/**
 * Environment variable validation — PrecisionAI
 * Validates all required and optional env vars at boot time.
 * Uses zod for schema validation with clear error messages.
 */

import { z } from 'zod';

const envSchema = z.object({
  // ── Critical (app won't function without these) ──
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 chars'),

  // ── Auth providers (optional — degrades gracefully) ──
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // ── App URLs ──
  SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),

  // ── Database (Docker) ──
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),

  // ── Redis ──
  REDIS_URL: z.string().optional(),

  // ── AI ──
  GEMINI_API_KEY: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),

  // ── Billing — Stripe ──
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── Billing — MercadoPago ──
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z.string().optional(),

  // ── Email ──
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // ── Push ──
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  // ── CRM integrations ──
  RD_STATION_CLIENT_ID: z.string().optional(),
  RD_STATION_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  AGENDOR_API_TOKEN: z.string().optional(),

  // ── Security ──
  AI_CONFIG_ENCRYPTION_KEY: z.string().optional(),
  TWOFA_ISSUER: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  BILLING_CRON_SECRET: z.string().optional(),

  // ── Admin ──
  ADMIN_EMAILS: z.string().optional(),

  // ── Observability ──
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['info', 'warn', 'error']).default('info'),

  // ── Telegram Alerts ──
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Important optional vars that should be warned about
const RECOMMENDED_VARS = [
  'STRIPE_WEBHOOK_SECRET',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'GEMINI_API_KEY',
  'GOOGLE_PLACES_API_KEY',
  'RESEND_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
] as const;

export function validateEnv(): { ok: boolean; warnings: string[] } {
  const result = envSchema.safeParse(process.env);
  const warnings: string[] = [];

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMsg = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    process.stderr.write(
      `\n╔══════════════════════════════════════════════════╗\n` +
      `║  ⛔ ENVIRONMENT VALIDATION FAILED                ║\n` +
      `╠══════════════════════════════════════════════════╣\n` +
      `${errorMsg}\n` +
      `╚══════════════════════════════════════════════════╝\n\n`
    );
    return { ok: false, warnings };
  }

  // Check recommended vars
  for (const key of RECOMMENDED_VARS) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (warnings.length > 0) {
    process.stdout.write(
      `\n⚠️  Missing recommended env vars: ${warnings.join(', ')}\n` +
      `   Some features may be degraded.\n\n`
    );
  }

  return { ok: true, warnings };
}
