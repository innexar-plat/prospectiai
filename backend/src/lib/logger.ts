/**
 * Logger estruturado (JSON) para observabilidade.
 * Níveis: info, warn, error. Suporta requestId/correlationId opcional.
 * Erros são enviados automaticamente para Telegram (se configurado).
 */

import { alertCritical, alertWarning } from './telegram-alert';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
};

const minLevel: LogLevel = process.env.LOG_LEVEL === 'error' ? 'error' : 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];
}

// Track recent errors to avoid spamming Telegram with the same message
const recentAlerts = new Map<string, number>();
const ALERT_DEDUP_MS = 300_000; // 5 minutes

function shouldAlertTelegram(message: string): boolean {
  const now = Date.now();
  const lastSent = recentAlerts.get(message);
  if (lastSent && now - lastSent < ALERT_DEDUP_MS) return false;
  recentAlerts.set(message, now);
  // Prune old entries periodically
  if (recentAlerts.size > 200) {
    for (const [key, ts] of recentAlerts) {
      if (now - ts > ALERT_DEDUP_MS) recentAlerts.delete(key);
    }
  }
  return true;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>, requestId?: string): void {
  if (!shouldLog(level)) return;
  const payload: LogContext = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }

  // Send errors and critical warnings to Telegram (fire-and-forget)
  if (level === 'error' && shouldAlertTelegram(message)) {
    const alertMeta: Record<string, string> = {};
    if (requestId) alertMeta['requestId'] = requestId;
    if (meta?.error) alertMeta['error'] = String(meta.error);
    if (meta?.userId) alertMeta['userId'] = String(meta.userId);
    if (meta?.route) alertMeta['route'] = String(meta.route);
    alertCritical(message, formatMetaForTelegram(meta), alertMeta).catch(() => {});
  }
}

function formatMetaForTelegram(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '(sem detalhes adicionais)';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (key === 'error' || key === 'userId' || key === 'route' || key === 'requestId') continue;
    if (value != null) parts.push(`${key}: ${String(value).slice(0, 200)}`);
  }
  return parts.length > 0 ? parts.join('\n') : '(sem detalhes adicionais)';
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    write('info', message, meta, requestId);
  },
  warn(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    write('warn', message, meta, requestId);
  },
  error(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    write('error', message, meta, requestId);
  },
};

/** Obtém requestId do header x-request-id ou gera um (para uso em rotas). */
export function getRequestId(req: { headers: { get: (name: string) => string | null } }): string | undefined {
  const id = req.headers.get('x-request-id');
  if (id && typeof id === 'string') return id;
  return undefined;
}
