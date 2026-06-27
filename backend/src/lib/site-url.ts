import { getRequestMarket, resolveMarketFromHost, type Market } from '@/lib/market';

const BR_SITE =
    process.env.SITE_URL_BR ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://precisionia.com.br';

const US_SITE = process.env.SITE_URL_US ?? 'https://precisionai.innexar.app';

export function getSiteUrlForMarket(market: Market): string {
    return market === 'US' ? US_SITE : BR_SITE.replace(/\/$/, '');
}

/** Public app URL for the request host (emails, checkout, OAuth callbacks). */
export function getSiteUrlFromRequest(req: Request): string {
    const market = getRequestMarket(req);
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const hasExplicitMarket =
        resolveMarketFromHost(host) != null
        || req.headers.get('x-prospector-market') != null
        || (req.headers.get('cookie') ?? '').includes('prospector-market=');

    if (hasExplicitMarket) {
        return getSiteUrlForMarket(market);
    }

    if (host) {
        const proto = req.headers.get('x-forwarded-proto') ?? 'https';
        const hostname = host.split(',')[0]?.trim();
        if (hostname) return `${proto}://${hostname}`;
    }

    return getSiteUrlForMarket(market);
}

export function getMarketFromRequest(req: Request): Market {
    return getRequestMarket(req);
}
