import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

type SearchHistoryTask = {
    workspaceId: string;
    userId: string;
    textQuery: string;
    pageSize: number;
    filters: Prisma.InputJsonValue;
    resultsCount: number;
    resultsData?: Prisma.InputJsonValue;
    city?: string | null;
    state?: string | null;
    country?: string | null;
};

const DEFAULT_CONCURRENCY = 1;
const MAX_CONCURRENCY = 10;
const DEFAULT_MAX_QUEUE_SIZE = 1000;

const queue: SearchHistoryTask[] = [];
let activeWorkers = 0;
let droppedTasks = 0;

function toPositiveInt(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(max, parsed);
}

function getConcurrency(): number {
    return toPositiveInt(process.env.SEARCH_HISTORY_QUEUE_CONCURRENCY, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
}

function getMaxQueueSize(): number {
    return toPositiveInt(process.env.SEARCH_HISTORY_QUEUE_MAX_SIZE, DEFAULT_MAX_QUEUE_SIZE, 10000);
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
                await prisma.searchHistory.create({
                    data: {
                        workspaceId: task.workspaceId,
                        userId: task.userId,
                        textQuery: task.textQuery,
                        pageSize: task.pageSize,
                        filters: task.filters,
                        resultsCount: task.resultsCount,
                        resultsData: task.resultsData,
                        city: task.city ?? null,
                        state: task.state ?? null,
                        country: task.country ?? null,
                    },
                });
            } catch (error) {
                logger.error('SearchHistory queue task failed', {
                    error: error instanceof Error ? error.message : 'Unknown',
                    textQuery: task.textQuery,
                    resultsCount: task.resultsCount,
                });
            }
        }
    } finally {
        activeWorkers = Math.max(0, activeWorkers - 1);
        if (queue.length > 0) scheduleWorkers();
    }
}

export function enqueueSearchHistoryWrite(task: SearchHistoryTask): void {
    const maxQueueSize = getMaxQueueSize();
    if (queue.length >= maxQueueSize) {
        droppedTasks += 1;
        logger.warn('SearchHistory queue full, dropping task', {
            queueLength: queue.length,
            maxQueueSize,
            textQuery: task.textQuery,
        });
        return;
    }

    queue.push(task);
    scheduleWorkers();
}

export function getSearchHistoryQueueStats(): {
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
