/**
 * Logger estruturado (JSON) para observabilidade.
 * Níveis: info, warn, error. Suporta requestId/correlationId opcional.
 */

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
