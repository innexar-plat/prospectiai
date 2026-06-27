type ModelCounter = {
    inFlight: number;
    rejected: number;
};

const counters = new Map<string, ModelCounter>();

function getOrCreateCounter(modelKey: string): ModelCounter {
    let counter = counters.get(modelKey);
    if (!counter) {
        counter = { inFlight: 0, rejected: 0 };
        counters.set(modelKey, counter);
    }
    return counter;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getModelMaxInFlight(): number {
    return parsePositiveInt(process.env.AI_MODEL_MAX_IN_FLIGHT, 4);
}

export function tryAcquireModelSlot(modelKey: string): boolean {
    const counter = getOrCreateCounter(modelKey);
    if (counter.inFlight >= getModelMaxInFlight()) {
        counter.rejected += 1;
        return false;
    }
    counter.inFlight += 1;
    return true;
}

export function releaseModelSlot(modelKey: string): void {
    const counter = getOrCreateCounter(modelKey);
    counter.inFlight = Math.max(0, counter.inFlight - 1);
}

export function getModelBulkheadSnapshot(): Record<string, { inFlight: number; rejected: number }> {
    const snapshot: Record<string, { inFlight: number; rejected: number }> = {};
    for (const [key, value] of counters.entries()) {
        snapshot[key] = { inFlight: value.inFlight, rejected: value.rejected };
    }
    return snapshot;
}

export function __resetModelBulkheadForTests(): void {
    counters.clear();
}
