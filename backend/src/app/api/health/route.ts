import { NextRequest } from "next/server";
import { getOrCreateRequestId, jsonWithRequestId } from "@/lib/request-id";
import { prisma } from "@/lib/prisma";
import { alertCritical, alertSuccess } from "@/lib/telegram-alert";

// Track downtime to send recovery alerts
let lastDbStatus = true;
let lastRedisStatus = true;

async function checkPostgres(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const Redis = (await import("ioredis")).default;
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * Health endpoint for load balancers and Docker healthchecks.
 * Returns 200 when core services are up.
 * Header x-request-id para rastreabilidade.
 */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);

  const [db, redis] = await Promise.all([checkPostgres(), checkRedis()]);

  const allOk = db.ok && redis.ok;
  const status = allOk ? "ok" : "degraded";

  // Alert on state changes (down/recovery)
  if (!db.ok && lastDbStatus) {
    alertCritical("PostgreSQL DOWN", "Health check falhou para o banco de dados", {
      latencyMs: String(db.latencyMs),
    }).catch(() => {});
  } else if (db.ok && !lastDbStatus) {
    alertSuccess("PostgreSQL Recuperado", "Banco de dados voltou ao normal", {
      latencyMs: String(db.latencyMs),
    }).catch(() => {});
  }

  if (!redis.ok && lastRedisStatus) {
    alertCritical("Redis DOWN", "Health check falhou para o Redis", {
      latencyMs: String(redis.latencyMs),
    }).catch(() => {});
  } else if (redis.ok && !lastRedisStatus) {
    alertSuccess("Redis Recuperado", "Redis voltou ao normal", {
      latencyMs: String(redis.latencyMs),
    }).catch(() => {});
  }

  lastDbStatus = db.ok;
  lastRedisStatus = redis.ok;

  // For Docker healthcheck: always return 200 if the app process is running.
  // External monitors can check the "status" field for "degraded".
  return jsonWithRequestId(
    {
      status,
      services: {
        postgres: { ok: db.ok, latencyMs: db.latencyMs },
        redis: { ok: redis.ok, latencyMs: redis.latencyMs },
      },
      timestamp: new Date().toISOString(),
    },
    { requestId, status: 200 }
  );
}
