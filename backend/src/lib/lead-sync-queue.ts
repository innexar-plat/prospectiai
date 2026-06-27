import type { PlaceResult } from '@/lib/google-places';
import { syncLeads } from '@/lib/db-sync';
import { logger } from '@/lib/logger';

type SyncTask = { places: PlaceResult[] };

const DEFAULT_CONCURRENCY = 1;
const MAX_CONCURRENCY = 20;
const DEFAULT_MAX_QUEUE_SIZE = 200;

const queue: SyncTask[] = [];
let activeWorkers = 0;
let droppedTasks = 0;

function toPositiveInt(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(max, parsed);
}

function getConcurrency(): number {
    return toPositiveInt(process.env.LEAD_SYNC_QUEUE_CONCURRENCY, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
}

function getMaxQueueSize(): number {
    return toPositiveInt(process.env.LEAD_SYNC_QUEUE_MAX_SIZE, DEFAULT_MAX_QUEUE_SIZE, 5000);
}

function scheduleWorkers(): void {
    const desired = getConcurrency();
    while (activeWorkers < desired && queue.length > 0) {
        activeWorkers += 1;
        void runWorker();
    }
}

async function runWorker(): Promise<void> {
    try {
        while (queue.length > 0) {
            const task = queue.shift();
            if (!task) break;
            try {
                await syncLeads(task.places);
            } catch (error) {
                logger.error('Lead sync queue task failed', {
                    error: error instanceof Error ? error.message : 'Unknown',
                    taskSize: task.places.length,
                });
            }
        }
    } finally {
        activeWorkers = Math.max(0, activeWorkers - 1);
        if (queue.length > 0) scheduleWorkers();
    }
}

export function enqueueLeadSync(places: PlaceResult[]): void {
    if (!places.length) return;

    const maxQueueSize = getMaxQueueSize();
    if (queue.length >= maxQueueSize) {
        droppedTasks += 1;
        logger.warn('Lead sync queue full, dropping task', {
            queueLength: queue.length,
            maxQueueSize,
            taskSize: places.length,
        });
        return;
    }

    queue.push({ places });
    scheduleWorkers();
}

export function getLeadSyncQueueStats(): {
    queueLength: number;
    activeWorkers: number;
    concurrency: number;
    maxQueueSize: number;
    droppedTasks: number;
} {
    return {
        queueLength: queue.length,
        activeWorkers,
        concurrency: getConcurrency(),
        maxQueueSize: getMaxQueueSize(),
        droppedTasks,
    };
}

