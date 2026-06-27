import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type ContactType = 'PHONE' | 'EMAIL' | 'WEBSITE';
type ContactSource = 'GOOGLE' | 'RECEITA' | 'WEBSITE_SCRAPER' | 'WEB_SEARCH' | 'MANUAL';

interface LeadContactRow {
  id: string;
  leadId: string;
  type: ContactType;
  source: ContactSource;
  roleHint: string;
  valueRaw: string;
  valueNormalized: string;
  confidenceScore: number | null;
  isPrimary: boolean;
  evidence: Prisma.JsonValue | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  updatedAt: Date;
}

// Avoid hard dependency on generated Prisma model typing so editor stale cache
// does not break development before TS server refresh/regenerate.
const leadContactRepo = (prisma as unknown as {
  leadContact: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<LeadContactRow[]>;
    findFirst: (args: unknown) => Promise<LeadContactRow | null>;
    updateMany: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
}).leadContact;

export interface ContactIntelligenceContact {
  id: string;
  type: ContactType;
  source: ContactSource;
  valueRaw: string;
  valueNormalized: string;
  confidenceScore: number;
  effectiveScore: number;
  isPrimary: boolean;
  roleHint: string;
  riskFlags: string[];
  evidence: Prisma.JsonValue | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface ContactIntelligenceResult {
  leadId: string;
  placeId: string;
  contactsHealthScore: number;
  riskFlags: string[];
  recommendedContacts: {
    phone: ContactIntelligenceContact | null;
    email: ContactIntelligenceContact | null;
    website: ContactIntelligenceContact | null;
  };
  alternatives: ContactIntelligenceContact[];
}

interface ScoreContext {
  recommendedWebsiteHost: string | null;
  localDuplicatesByTypeValue: Map<string, number>;
}

function baseScoreBySource(source: ContactSource): number {
  switch (source) {
    case 'MANUAL': return 90;
    case 'WEBSITE_SCRAPER': return 80;
    case 'GOOGLE': return 70;
    case 'WEB_SEARCH': return 60;
    case 'RECEITA': return 55;
    default: return 50;
  }
}

function containsAccountantPattern(value: string): boolean {
  const normalized = value.toLowerCase();
  return /(contab|contabil|fiscal|assessoria|escritorio)/.test(normalized);
}

function extractEmailDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

function extractWebsiteHost(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const withProtocol = normalized.startsWith('http://') || normalized.startsWith('https://')
      ? normalized
      : `https://${normalized}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    const hostCandidate = normalized.split('/')[0]?.trim();
    if (!hostCandidate) return null;
    return hostCandidate.startsWith('www.') ? hostCandidate.slice(4) : hostCandidate;
  }
}

function isGenericEmailDomain(domain: string): boolean {
  return new Set([
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'bol.com.br',
    'uol.com.br',
    'live.com',
  ]).has(domain);
}

function isDirectoryOrAggregatorHost(host: string): boolean {
  return /(instagram\.com|facebook\.com|linktr\.ee|maps\.google\.com|goo\.gl|tripadvisor\.|apontador\.|yelp\.|olist\.|mercadolivre\.)/.test(host);
}

async function computeEffectiveScore(
  contact: LeadContactRow,
  ctx: ScoreContext,
): Promise<{ score: number; riskFlags: string[] }> {
  let score = contact.confidenceScore ?? baseScoreBySource(contact.source);
  const riskFlags: string[] = [];

  if (contact.type === 'EMAIL' && containsAccountantPattern(contact.valueNormalized)) {
    score -= 20;
    riskFlags.push('accountant_pattern');
  }

  if (contact.type === 'EMAIL') {
    const domain = extractEmailDomain(contact.valueNormalized);
    if (domain && isGenericEmailDomain(domain)) {
      score -= 15;
      riskFlags.push('generic_email_domain');
    }

    if (domain && ctx.recommendedWebsiteHost && (domain === ctx.recommendedWebsiteHost || domain.endsWith(`.${ctx.recommendedWebsiteHost}`))) {
      score += 15;
    }
  }

  if (contact.type === 'WEBSITE') {
    const host = extractWebsiteHost(contact.valueNormalized) ?? extractWebsiteHost(contact.valueRaw);
    if (host && isDirectoryOrAggregatorHost(host)) {
      score -= 10;
      riskFlags.push('directory_or_aggregator_website');
    }
  }

  const duplicateKey = `${contact.type}:${contact.valueNormalized}`;
  const duplicateCount = ctx.localDuplicatesByTypeValue.get(duplicateKey) ?? 1;
  if (duplicateCount >= 2) {
    score += 10;
  }

  if (contact.type === 'PHONE' || contact.type === 'EMAIL') {
    const sharedCount = await leadContactRepo.count({
      where: {
        type: contact.type,
        valueNormalized: contact.valueNormalized,
        leadId: { not: contact.leadId },
      },
    });

    if (sharedCount >= 5) {
      score -= 35;
      riskFlags.push('shared_with_many_cnpjs');
    } else if (sharedCount >= 2) {
      score -= 15;
      riskFlags.push('shared_with_other_cnpjs');
    }
  }

  if (contact.isPrimary) score += 5;

  return { score: Math.max(0, Math.min(100, score)), riskFlags };
}

function pickBest(contacts: ContactIntelligenceContact[]): ContactIntelligenceContact | null {
  if (contacts.length === 0) return null;

  const primaryCandidates = contacts.filter((c) => c.isPrimary);
  const candidates = primaryCandidates.length > 0 ? primaryCandidates : contacts;

  return [...candidates].sort((a, b) => b.effectiveScore - a.effectiveScore)[0];
}

export async function buildContactIntelligenceByLeadId(leadId: string): Promise<ContactIntelligenceResult | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, placeId: true, cnpj: true },
  });

  if (!lead) return null;

  const contacts = await leadContactRepo.findMany({
    where: { leadId },
    orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
  });

  const websiteCandidate = contacts
    .filter((contact) => contact.type === 'WEBSITE')
    .sort((a, b) => (b.confidenceScore ?? baseScoreBySource(b.source)) - (a.confidenceScore ?? baseScoreBySource(a.source)))[0];

  const localDuplicatesByTypeValue = new Map<string, number>();
  for (const contact of contacts) {
    const key = `${contact.type}:${contact.valueNormalized}`;
    localDuplicatesByTypeValue.set(key, (localDuplicatesByTypeValue.get(key) ?? 0) + 1);
  }

  const scoreContext: ScoreContext = {
    recommendedWebsiteHost: websiteCandidate
      ? (extractWebsiteHost(websiteCandidate.valueNormalized) ?? extractWebsiteHost(websiteCandidate.valueRaw))
      : null,
    localDuplicatesByTypeValue,
  };

  const enrichedContacts: ContactIntelligenceContact[] = [];
  for (const contact of contacts) {
    const { score, riskFlags } = await computeEffectiveScore(contact, scoreContext);
    enrichedContacts.push({
      id: contact.id,
      type: contact.type,
      source: contact.source,
      valueRaw: contact.valueRaw,
      valueNormalized: contact.valueNormalized,
      confidenceScore: contact.confidenceScore ?? baseScoreBySource(contact.source),
      effectiveScore: score,
      isPrimary: contact.isPrimary,
      roleHint: contact.roleHint,
      riskFlags,
      evidence: contact.evidence as Prisma.JsonValue | null,
      firstSeenAt: contact.firstSeenAt,
      lastSeenAt: contact.lastSeenAt,
    });
  }

  const phoneContacts = enrichedContacts.filter((c) => c.type === 'PHONE');
  const emailContacts = enrichedContacts.filter((c) => c.type === 'EMAIL');
  const websiteContacts = enrichedContacts.filter((c) => c.type === 'WEBSITE');

  const recommendedPhone = pickBest(phoneContacts);
  const recommendedEmail = pickBest(emailContacts);
  const recommendedWebsite = pickBest(websiteContacts);

  const topScores = [recommendedPhone, recommendedEmail, recommendedWebsite]
    .filter((c): c is ContactIntelligenceContact => Boolean(c))
    .map((c) => c.effectiveScore);

  const contactsHealthScore = topScores.length > 0
    ? Math.round(topScores.reduce((acc, cur) => acc + cur, 0) / topScores.length)
    : 0;

  const riskFlags = Array.from(new Set(enrichedContacts.flatMap((contact) => contact.riskFlags)));

  return {
    leadId: lead.id,
    placeId: lead.placeId,
    contactsHealthScore,
    riskFlags,
    recommendedContacts: {
      phone: recommendedPhone,
      email: recommendedEmail,
      website: recommendedWebsite,
    },
    alternatives: enrichedContacts
      .sort((a, b) => b.effectiveScore - a.effectiveScore)
      .slice(0, 20),
  };
}

export async function recomputeLeadContactSnapshot(leadId: string): Promise<void> {
  const intelligence = await buildContactIntelligenceByLeadId(leadId);
  if (!intelligence) return;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      recommendedPhone: intelligence.recommendedContacts.phone?.valueRaw ?? null,
      recommendedEmail: intelligence.recommendedContacts.email?.valueRaw ?? null,
      recommendedWebsite: intelligence.recommendedContacts.website?.valueRaw ?? null,
      contactsHealthScore: intelligence.contactsHealthScore,
    },
  });
}

export async function setPrimaryContact(
  leadId: string,
  contactId: string,
  options?: { actorUserId?: string | null; actorEmail?: string | null; reason?: string | null },
): Promise<ContactIntelligenceResult | null> {
  const contact = await leadContactRepo.findFirst({ where: { id: contactId, leadId } });
  if (!contact) return null;

  const previousPrimary = await leadContactRepo.findFirst({
    where: { leadId, type: contact.type, isPrimary: true },
    select: { id: true },
  } as unknown as Parameters<typeof leadContactRepo.findFirst>[0]);

  await leadContactRepo.updateMany({
    where: { leadId, type: contact.type },
    data: { isPrimary: false },
  });

  await leadContactRepo.update({
    where: { id: contact.id },
    data: { isPrimary: true, lastSeenAt: new Date() },
  });

  if (options?.actorUserId) {
    await prisma.auditLog.create({
      data: {
        userId: options.actorUserId,
        adminEmail: options.actorEmail ?? undefined,
        action: 'lead.contact-intelligence.primary.override',
        resource: 'lead',
        resourceId: leadId,
        details: {
          reason: options.reason ?? null,
          contactId,
          previousPrimaryContactId: previousPrimary?.id ?? null,
          type: contact.type,
        },
      },
    }).catch(() => undefined);
  }

  await recomputeLeadContactSnapshot(leadId);
  return buildContactIntelligenceByLeadId(leadId);
}
