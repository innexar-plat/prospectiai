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

export interface SerperKnowledgeGraph {
  title?: string;
  website?: string;
  phone?: string;
  type?: string;
  description?: string;
}

export interface SerperPlace {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  link?: string;
}

export interface SerperRichResponse {
  organic: SerperResult[];
  knowledgeGraph?: SerperKnowledgeGraph;
  places?: SerperPlace[];
}

export async function searchSerper(
  apiKey: string,
  query: string,
  num: number = 5
): Promise<SerperResult[]> {
  const rich = await searchSerperRich(apiKey, query, num);
  return rich.organic;
}

export async function searchSerperRich(
  apiKey: string,
  query: string,
  num: number = 5,
  gl?: string,
  hl?: string,
): Promise<SerperRichResponse> {
  const body: Record<string, unknown> = { q: query, num };
  if (gl) body.gl = gl;
  if (hl) body.hl = hl;

  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Serper API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  const rawOrganic = (data.organic as Array<Record<string, unknown>>) ?? [];
  const organic: SerperResult[] = rawOrganic.slice(0, num).map((o) => ({
    title: String(o.title ?? ''),
    link: String(o.link ?? ''),
    snippet: o.snippet ? String(o.snippet) : undefined,
  }));

  const kg = data.knowledgeGraph as Record<string, unknown> | undefined;
  const knowledgeGraph: SerperKnowledgeGraph | undefined = kg
    ? {
        title: kg.title ? String(kg.title) : undefined,
        website: kg.website ? String(kg.website) : undefined,
        phone: kg.phone ? String(kg.phone) : undefined,
        type: kg.type ? String(kg.type) : undefined,
        description: kg.description ? String(kg.description) : undefined,
      }
    : undefined;

  const rawPlaces = (data.places as Array<Record<string, unknown>>) ?? [];
  const places: SerperPlace[] = rawPlaces.map((p) => ({
    title: p.title ? String(p.title) : undefined,
    address: p.address ? String(p.address) : undefined,
    phone: p.phone ?? p.phoneNumber ? String(p.phone ?? p.phoneNumber) : undefined,
    website: p.website ? String(p.website) : undefined,
    link: p.link ? String(p.link) : undefined,
  }));

  return {
    organic,
    knowledgeGraph: knowledgeGraph?.website || knowledgeGraph?.phone ? knowledgeGraph : undefined,
    places: places.length > 0 ? places : undefined,
  };
}
