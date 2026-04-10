/**
 * Lightweight website metadata scraper.
 * Fetches HEAD, then if reachable extracts meta tags, emails, social URLs.
 * Designed to run during AI analysis to enrich context.
 */

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

function extractEmails(html: string): string[] {
    const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    return [...new Set(matches.filter(e => !e.includes('example.') && !e.includes('sentry.')))].slice(0, 5);
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

        const response = await fetch(normalizedUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ProspectorBot/1.0)',
                'Accept': 'text/html',
            },
            redirect: 'follow',
        });
        clearTimeout(timeout);

        if (!response.ok) return fallback;

        const html = await response.text();
        // Only process first 200KB to avoid memory issues
        const trimmedHtml = html.slice(0, 200_000);

        return {
            reachable: true,
            title: extractTitle(trimmedHtml),
            description: extractMeta(trimmedHtml, 'description'),
            ogTitle: extractMeta(trimmedHtml, 'og:title'),
            ogDescription: extractMeta(trimmedHtml, 'og:description'),
            ogImage: extractMeta(trimmedHtml, 'og:image'),
            emails: extractEmails(trimmedHtml),
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
