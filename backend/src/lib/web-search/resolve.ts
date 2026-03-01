/**
 * Resolves web search config by role and runs search queries.
 * Returns aggregated context text for injection into AI prompt.
 *
 * Results are grouped by source (Reclame Aqui, JusBrasil, CNPJ, etc.)
 * so the AI can clearly identify and cite each data source.
 */

import type { AiRole } from '@/lib/ai/types';
import { searchSerper } from './serper';

const ROLE_TO_PRISMA = {
    lead_analysis: 'LEAD_ANALYSIS' as const,
    viability: 'VIABILITY' as const,
    company_analysis: 'COMPANY_ANALYSIS' as const,
};

/**
 * Fetch web search config for role (enabled, with key). Returns null if not configured.
 */
async function getWebSearchConfig(role: AiRole): Promise<{
    provider: string;
    apiKey: string;
    maxResults: number;
} | null> {
    try {
        const { prisma } = await import('@/lib/prisma');
        const { decryptApiKey } = await import('@/lib/ai/encrypt');
        const prismaRole = ROLE_TO_PRISMA[role];
        const row = await prisma.webSearchConfig.findUnique({
            where: { role: prismaRole },
        });
        if (!row || !row.enabled || !row.apiKeyEncrypted) return null;
        const apiKey = decryptApiKey(row.apiKeyEncrypted);
        return {
            provider: row.provider,
            apiKey,
            maxResults: row.maxResults ?? 5,
        };
    } catch {
        return null;
    }
}

export interface GetWebContextOptions {
    workspaceId?: string;
    userId?: string;
}

interface SearchSection {
    label: string;
    emoji: string;
    items: Array<{ title: string; link: string; snippet: string }>;
}

/**
 * Infer a human-readable section label + emoji from the query string.
 * This allows the AI to see exactly which data source each result came from.
 */
function inferSectionLabel(query: string): { label: string; emoji: string } {
    const q = query.toLowerCase();
    if (q.includes('reclame aqui')) return { label: 'Reclame Aqui — Reputação do Consumidor', emoji: '🔴' };
    if (q.includes('jusbrasil')) return { label: 'JusBrasil — Processos Judiciais', emoji: '⚖️' };
    if (q.includes('cnpj')) return { label: 'CNPJ — Dados Empresariais', emoji: '🏢' };
    if (q.includes('instagram')) return { label: 'Redes sociais — Instagram', emoji: '📱' };
    if (q.includes('facebook')) return { label: 'Redes sociais — Facebook', emoji: '📱' };
    if (q.includes('linkedin')) return { label: 'Redes sociais — LinkedIn', emoji: '📱' };
    if (q.includes('avaliações google') || q.includes('google reviews'))
        return { label: 'Avaliações Google', emoji: '⭐' };
    return { label: `Busca Web — "${query}"`, emoji: '🔍' };
}

/**
 * Format grouped sections into structured Markdown for injection into AI prompt.
 */
function formatSections(sections: SearchSection[]): string {
    const parts: string[] = [];
    for (const section of sections) {
        if (section.items.length === 0) continue;
        parts.push(`### ${section.emoji} ${section.label}`);
        for (const item of section.items) {
            parts.push(`- **${item.title}** — [${item.link}](${item.link})`);
            if (item.snippet) {
                parts.push(`  ${item.snippet}`);
            }
        }
        parts.push(''); // blank line between sections
    }
    return parts.join('\n');
}

async function fetchSerperSectionItems(
    config: { provider: string; apiKey: string; maxResults: number },
    query: string,
): Promise<{ items: Array<{ title: string; link: string; snippet: string }>; used: boolean }> {
    if (config.provider !== 'SERPER') return { items: [], used: false };
    try {
        const items = await searchSerper(config.apiKey, query.trim(), Math.min(config.maxResults, 5));
        return {
            items: items.map((item) => ({ title: item.title, link: item.link, snippet: item.snippet ?? '' })),
            used: true,
        };
    } catch {
        return { items: [], used: false };
    }
}

async function runOneQuerySection(
    config: { provider: string; apiKey: string; maxResults: number },
    query: string,
): Promise<{ section: SearchSection; usedSerper: boolean }> {
    const { label, emoji } = inferSectionLabel(query);
    const { items, used } = await fetchSerperSectionItems(config, query);
    return { section: { label, emoji, items }, usedSerper: used };
}

/**
 * Run search for each query and return a single context block with labeled sections.
 * Each query generates its own section (Reclame Aqui, JusBrasil, CNPJ, etc.).
 * Returns empty string if no config or no results.
 */
export async function getWebContextForRole(
    role: AiRole,
    queries: string[],
    options?: GetWebContextOptions
): Promise<string> {
    const config = await getWebSearchConfig(role);
    if (!config || queries.length === 0) return '';

    const maxQueries = role === 'company_analysis' ? 6 : 5;
    const toRun = queries.slice(0, maxQueries).filter((q) => q.trim());
    const results = await Promise.all(toRun.map((q) => runOneQuerySection(config, q)));
    const sections = results.map((r) => r.section);
    const serperQueryCount = results.filter((r) => r.usedSerper).length;

    if (options?.workspaceId && serperQueryCount > 0) {
        const { recordUsageEvent } = await import('@/lib/usage');
        recordUsageEvent({
            workspaceId: options.workspaceId,
            userId: options.userId ?? undefined,
            type: 'SERPER_REQUEST',
            quantity: serperQueryCount,
        });
    }

    const formattedSections = formatSections(sections);
    if (!formattedSections.trim()) return '';

    return `## 📊 Contexto da Web (dados reais coletados — use-os na análise e cite as fontes)\n\n${formattedSections}`;
}
