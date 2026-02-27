/**
 * Serper.dev search adapter.
 * POST https://google.serper.dev/search with X-API-KEY header.
 */

const SERPER_URL = 'https://google.serper.dev/search';

export interface SerperResult {
  title: string;
  link: string;
  snippet?: string;
}

export async function searchSerper(
  apiKey: string,
  query: string,
  num: number = 5
): Promise<SerperResult[]> {
  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Serper API error ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  const organic = data.organic ?? [];
  return organic.slice(0, num).map((o) => ({
    title: o.title ?? '',
    link: o.link ?? '',
    snippet: o.snippet,
  }));
}
