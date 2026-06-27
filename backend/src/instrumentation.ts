/**
 * Next.js Instrumentation Hook — runs once at server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env-validation');
    const { alertSuccess, alertWarning } = await import('@/lib/telegram-alert');

    const { ok, warnings } = validateEnv();

    if (!ok) {
      // Critical env vars missing — exit with error
      process.stderr.write('Server aborting due to invalid environment configuration.\n');
      process.exit(1);
    }

    // Notify Telegram that the server started (delayed + non-blocking)
    const version = process.env.npm_package_version || 'unknown';
    const startupWarnings = [...warnings];
    const notifyStartup = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await alertSuccess(
        'Server Started',
        `PrecisionAI backend iniciado com sucesso`,
        {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          version,
          ...(startupWarnings.length > 0 ? { missingOptional: startupWarnings.join(', ') } : {}),
        }
      ).catch(() => {});

      if (startupWarnings.length > 0) {
        await alertWarning(
          'Env vars opcionais ausentes',
          `Variáveis recomendadas não configuradas: ${startupWarnings.join(', ')}`,
        ).catch(() => {});
      }
    };
    notifyStartup().catch(() => {});
  }
}
