import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Obtém o requestId do header x-request-id ou gera um novo (para rastreabilidade).
 * Se req não for passado (ex.: health), gera um id novo.
 */
export function getOrCreateRequestId(req?: { headers?: { get: (name: string) => string | null } } | null): string {
  if (!req?.headers?.get) return crypto.randomUUID();
  const id = req.headers.get('x-request-id')?.trim();
  return id && id.length > 0 ? id : crypto.randomUUID();
}

/**
 * Retorna NextResponse.json com header x-request-id para correlação cliente-servidor.
 */
export function jsonWithRequestId<T>(
  data: T,
  init: { status?: number; requestId: string }
): NextResponse {
  const res = NextResponse.json(data, { status: init.status ?? 200 });
  res.headers.set('x-request-id', init.requestId);
  return res;
}
