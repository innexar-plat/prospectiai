type Waiter = {
    resolve: () => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
};

const DEFAULT_MAX_IN_FLIGHT = 12;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 12000;

let inFlight = 0;
let timedOut = 0;
const waiters: Waiter[] = [];

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMaxInFlight(): number {
    return parsePositiveInt(process.env.ANALYZE_BULKHEAD_MAX_IN_FLIGHT, DEFAULT_MAX_IN_FLIGHT);
}

function getAcquireTimeoutMs(): number {
    return parsePositiveInt(process.env.ANALYZE_BULKHEAD_ACQUIRE_TIMEOUT_MS, DEFAULT_ACQUIRE_TIMEOUT_MS);
}

function release(): void {
    inFlight = Math.max(0, inFlight - 1);
    const next = waiters.shift();
    if (!next) return;
    clearTimeout(next.timer);
    inFlight += 1;
    next.resolve();
}

async function acquire(): Promise<void> {
    if (inFlight < getMaxInFlight()) {
        inFlight += 1;
        return;
    }

    const timeoutMs = getAcquireTimeoutMs();

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            timedOut += 1;
            const idx = waiters.findIndex((w) => w.resolve === resolve);
            if (idx >= 0) waiters.splice(idx, 1);
            reject(new Error('ANALYZE_BULKHEAD_TIMEOUT'));
        }, timeoutMs);

        waiters.push({ resolve, reject, timer });
    });
}

export async function withAnalyzeBulkhead<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
        return await fn();
    } finally {
        release();
    }
}

export function getAnalyzeBulkheadStats() {
    return {
        inFlight,
        queued: waiters.length,
        maxInFlight: getMaxInFlight(),
        acquireTimeoutMs: getAcquireTimeoutMs(),
        timedOut,
    };
}

export function __resetAnalyzeBulkheadForTests(): void {
    inFlight = 0;
    timedOut = 0;
    while (waiters.length > 0) {
        const waiter = waiters.shift();
        if (!waiter) break;
        clearTimeout(waiter.timer);
        waiter.reject(new Error('ANALYZE_BULKHEAD_RESET'));
    }
}