/**
 * Lightweight website metadata scraper.
 * Fetches HEAD, then if reachable extracts meta tags, emails, social URLs.
 * Designed to run during AI analysis to enrich context.
 */

import { safeFetch } from '@/lib/safe-fetch';

const SCRAPE_TIMEOUT_MS = 8000;

export interface WebsiteMetadata {
    reachable: boolean;
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    emails: string[];
    phones: string[];
    socialUrls: string[];
    cnpjsFound: string[];
    technologies: string[];
}

function extractMeta(html: string, name: string): string | undefined {
    const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];
    // Try reversed attribute order
    const regex2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i');
    const match2 = html.match(regex2);
    return match2?.[1];
}

function extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match?.[1]?.trim();
}

const JUNK_EMAIL = /(example\.|sentry|wixpress|domain\.com|email\.com|seuemail|seu-email|yourdomain|@2x|\.(png|jpe?g|gif|webp|svg|css|js)$)/i;

export function extractEmails(html: string): string[] {
    const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    return [...new Set(matches.map((e) => e.toLowerCase()).filter((e) => !JUNK_EMAIL.test(e)))].slice(0, 5);
}

/** Best contact e-mail: one on the site's own domain wins over webmail addresses. */
export function pickBestEmail(emails: string[], siteUrl: string): string | null {
    if (emails.length === 0) return null;
    let host = '';
    try { host = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./, ''); } catch { /* keep empty */ }
    const sameDomain = host ? emails.find((e) => e.endsWith(`@${host}`)) : undefined;
    return sameDomain ?? emails[0]!;
}

/** Same-site "contato/contact" page linked from the homepage, if any. */
export function findContactPageUrl(html: string, baseUrl: string): string | null {
    const re = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi;
    let base: URL;
    try { base = new URL(baseUrl); } catch { return null; }
    for (const m of html.matchAll(re)) {
        const href = m[1] ?? '';
        const label = (m[2] ?? '').replace(/<[^>]+>/g, ' ');
        if (!/contat|contact|fale-conosco|fale conosco|atendimento/i.test(`${href} ${label}`)) continue;
        if (/^(mailto|tel|javascript|whatsapp):/i.test(href) || /wa\.me|api\.whatsapp/i.test(href)) continue;
        try {
            const url = new URL(href, base);
            if (url.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '')) return url.toString();
        } catch { /* ignore malformed */ }
    }
    return null;
}

function extractPhones(html: string): string[] {
    const matches = html.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/g) || [];
    return [...new Set(matches)].slice(0, 3);
}

function extractSocialUrls(html: string): string[] {
    const patterns = [
        /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/g,
        /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/g,
        /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+/g,
        /https?:\/\/(?:www\.)?twitter\.com\/[a-zA-Z0-9_]+/g,
        /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@)[a-zA-Z0-9_.-]+/g,
    ];
    const urls: string[] = [];
    for (const pattern of patterns) {
        const matches = html.match(pattern) || [];
        urls.push(...matches);
    }
    return [...new Set(urls)].slice(0, 10);
}

function extractCnpjs(html: string): string[] {
    const matches = html.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || [];
    return [...new Set(matches)].slice(0, 3);
}

function detectTechnologies(html: string): string[] {
    const techs: string[] = [];
    if (html.includes('wp-content') || html.includes('wordpress')) techs.push('WordPress');
    if (html.includes('shopify')) techs.push('Shopify');
    if (html.includes('wix.com')) techs.push('Wix');
    if (html.includes('squarespace')) techs.push('Squarespace');
    if (html.includes('google-analytics') || html.includes('gtag')) techs.push('Google Analytics');
    if (html.includes('facebook.net/en_US/fbevents') || html.includes('Meta Pixel')) techs.push('Meta Pixel');
    if (html.includes('hotjar')) techs.push('Hotjar');
    if (html.includes('rdstation') || html.includes('rd-station')) techs.push('RD Station');
    return techs;
}

/** One extra request: most small-business sites only list the e-mail on the contact page. */
async function emailsFromContactPage(html: string, baseUrl: string): Promise<string[]> {
    const contactUrl = findContactPageUrl(html, baseUrl);
    if (!contactUrl) return [];
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
        const res = await safeFetch(contactUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProspectorBot/1.0)', 'Accept': 'text/html' },
        });
        clearTimeout(timeout);
        if (!res.ok) return [];
        return extractEmails((await res.text()).slice(0, 200_000));
    } catch {
        return [];
    }
}

export async function scrapeWebsite(url: string): Promise<WebsiteMetadata> {
    const fallback: WebsiteMetadata = {
        reachable: false,
        emails: [],
        phones: [],
        socialUrls: [],
        cnpjsFound: [],
        technologies: [],
    };

    try {
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

        const response = await safeFetch(normalizedUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ProspectorBot/1.0)',
                'Accept': 'text/html',
            },
        });
        clearTimeout(timeout);

        if (!response.ok) return fallback;

        const html = await response.text();
        // Only process first 200KB to avoid memory issues
        const trimmedHtml = html.slice(0, 200_000);

        let emails = extractEmails(trimmedHtml);
        if (emails.length === 0) emails = await emailsFromContactPage(trimmedHtml, response.url || normalizedUrl);

        return {
            reachable: true,
            title: extractTitle(trimmedHtml),
            description: extractMeta(trimmedHtml, 'description'),
            ogTitle: extractMeta(trimmedHtml, 'og:title'),
            ogDescription: extractMeta(trimmedHtml, 'og:description'),
            ogImage: extractMeta(trimmedHtml, 'og:image'),
            emails,
            phones: extractPhones(trimmedHtml),
            socialUrls: extractSocialUrls(trimmedHtml),
            cnpjsFound: extractCnpjs(trimmedHtml),
            technologies: detectTechnologies(trimmedHtml),
        };
    } catch {
        return fallback;
    }
}

/** Format website metadata into a prompt-friendly text block. */
export function formatWebsiteMetadataForPrompt(meta: WebsiteMetadata, isEn: boolean): string {
    if (!meta.reachable) return '';
    const lines: string[] = [];
    const header = isEn ? 'WEBSITE SCRAPING DATA (extracted from their website):' : 'DADOS DO WEBSITE (extraídos do site do lead):';
    lines.push(`\n${header}`);
    if (meta.title) lines.push(`- ${isEn ? 'Page Title' : 'Título da Página'}: ${meta.title}`);
    if (meta.description) lines.push(`- ${isEn ? 'Meta Description' : 'Meta Descrição'}: ${meta.description}`);
    if (meta.emails.length) lines.push(`- ${isEn ? 'Emails Found' : 'Emails Encontrados'}: ${meta.emails.join(', ')}`);
    if (meta.phones.length) lines.push(`- ${isEn ? 'Phones Found' : 'Telefones Encontrados'}: ${meta.phones.join(', ')}`);
    if (meta.socialUrls.length) lines.push(`- ${isEn ? 'Social Media URLs' : 'URLs Redes Sociais'}: ${meta.socialUrls.join(', ')}`);
    if (meta.cnpjsFound.length) lines.push(`- ${isEn ? 'CNPJs Found' : 'CNPJs Encontrados'}: ${meta.cnpjsFound.join(', ')}`);
    if (meta.technologies.length) lines.push(`- ${isEn ? 'Technologies Detected' : 'Tecnologias Detectadas'}: ${meta.technologies.join(', ')}`);
    return lines.join('\n');
}
