/**
 * Bounded queries over "UsCompany" (Overture Maps places) — same rules as rf-query: indexed
 * predicates only, statement timeout, no ORDER BY over the match set, capped count.
 */
import type { UsCompany } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const QUERY_TIMEOUT_MS = 5000;
const COUNT_TIMEOUT_MS = 1500;
export const US_COUNT_CAP = 1000;
const MAX_OFFSET = 2000;

/** Segments offered in the product → Overture categories. */
export const US_SEGMENTS: Array<{ slug: string; name: string; categories: string[] }> = [
    { slug: 'accountants', name: 'Accountants & tax services', categories: ['accountant', 'tax_service'] },
    { slug: 'auto-dealers', name: 'Auto dealers', categories: ['auto_dealer', 'used_auto_dealer'] },
    { slug: 'auto-repair', name: 'Auto repair shops', categories: ['automotive_repair', 'auto_body_shop', 'tire_dealer_and_repair'] },
    { slug: 'bakeries', name: 'Bakeries', categories: ['bakery'] },
    { slug: 'barbers', name: 'Barber shops', categories: ['barber'] },
    { slug: 'beauty-salons', name: 'Beauty & hair salons', categories: ['beauty_salon', 'hair_salon', 'nail_salon'] },
    { slug: 'business-consultants', name: 'Business consultants', categories: ['business_consulting'] },
    { slug: 'chiropractors', name: 'Chiropractors', categories: ['chiropractor'] },
    { slug: 'churches', name: 'Churches & religious organizations', categories: ['christian_place_of_worship', 'baptist_place_of_worship', 'religious_organization'] },
    { slug: 'cleaning', name: 'Cleaning services', categories: ['home_cleaning', 'dry_cleaning', 'laundromat'] },
    { slug: 'clothing-stores', name: 'Clothing stores', categories: ['clothing_store', 'womens_clothing_store', 'fashion_boutique'] },
    { slug: 'coffee-shops', name: 'Coffee shops', categories: ['coffee_shop', 'cafe'] },
    { slug: 'contractors', name: 'General contractors', categories: ['contractor', 'building_or_construction_service'] },
    { slug: 'dentists', name: 'Dentists', categories: ['dental_clinic', 'general_dentistry'] },
    { slug: 'doctors', name: "Doctors' offices", categories: ['doctors_office', 'family_practice', 'internal_medicine'] },
    { slug: 'electricians', name: 'Electricians', categories: ['electrician'] },
    { slug: 'event-planners', name: 'Event planners', categories: ['party_and_event_planning', 'caterer'] },
    { slug: 'gyms', name: 'Gyms & fitness studios', categories: ['gym', 'yoga_studio', 'dance_studio'] },
    { slug: 'hotels', name: 'Hotels', categories: ['hotel', 'lodging'] },
    { slug: 'hvac', name: 'HVAC companies', categories: ['hvac_service'] },
    { slug: 'insurance', name: 'Insurance agencies', categories: ['insurance_agency', 'auto_insurance'] },
    { slug: 'it-services', name: 'IT services', categories: ['it_service_and_computer_repair', 'information_technology_company'] },
    { slug: 'landscaping', name: 'Landscaping', categories: ['landscaping'] },
    { slug: 'law-firms', name: 'Law firms', categories: ['attorney_or_law_firm', 'legal_service', 'personal_injury_law'] },
    { slug: 'manufacturers', name: 'Manufacturers', categories: ['manufacturer', 'industrial_equipment_manufacturer', 'metal_fabricator'] },
    { slug: 'marketing-agencies', name: 'Marketing & advertising agencies', categories: ['marketing_agency', 'advertising_agency', 'web_designer'] },
    { slug: 'med-spas', name: 'Med spas & skin care', categories: ['medical_spa', 'skin_care_and_makeup', 'spa', 'day_spa'] },
    { slug: 'pest-control', name: 'Pest control', categories: ['pest_control_service'] },
    { slug: 'pet-services', name: 'Pet stores & groomers', categories: ['pet_store', 'pet_groomer'] },
    { slug: 'physical-therapy', name: 'Physical therapy', categories: ['physical_therapy'] },
    { slug: 'plumbers', name: 'Plumbers', categories: ['plumbing'] },
    { slug: 'printing', name: 'Printing & signs', categories: ['printing_service', 'sign_making'] },
    { slug: 'property-management', name: 'Property management', categories: ['property_management'] },
    { slug: 'real-estate', name: 'Real estate agents', categories: ['real_estate_agent', 'real_estate_service'] },
    { slug: 'restaurants', name: 'Restaurants', categories: ['restaurant', 'american_restaurant', 'mexican_restaurant', 'italian_restaurant', 'pizza_restaurant'] },
    { slug: 'roofers', name: 'Roofing companies', categories: ['roofing'] },
    { slug: 'schools', name: 'Preschools & day care', categories: ['preschool', 'day_care_preschool'] },
    { slug: 'software', name: 'Software companies', categories: ['software_development'] },
    { slug: 'staffing', name: 'Staffing agencies', categories: ['employment_agency'] },
    { slug: 'trucking', name: 'Freight & trucking', categories: ['freight_and_cargo_service', 'courier_and_delivery_service'] },
    { slug: 'veterinarians', name: 'Veterinarians', categories: ['veterinarian'] },
];

export interface UsFilters {
    categories: string[];
    states: string[];
    city?: string | null;
    hasPhone?: boolean;
    hasEmail?: boolean;
    hasWebsite?: boolean;
}

/** Category and state are mandatory: without them a search would scan 13M rows. */
export function buildUsWhere(f: UsFilters): { sql: string; params: string[] } {
    const params: string[] = [];
    const p = (v: string) => { params.push(v); return `$${params.length}`; };
    const categories = f.categories.filter((c) => /^[a-z0-9_]{2,60}$/.test(c));
    const states = f.states.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));
    if (categories.length === 0 || states.length === 0) return { sql: 'false', params };
    const conds = [`category IN (${categories.map(p).join(', ')})`, `state IN (${states.map((s) => `${p(s)}::char(2)`).join(', ')})`];
    if (f.city?.trim()) conds.push(`"cityNorm" = ${p(f.city.trim().toLowerCase())}`);
    if (f.hasPhone) conds.push('phone IS NOT NULL');
    if (f.hasEmail) conds.push('email IS NOT NULL');
    if (f.hasWebsite) conds.push('website IS NOT NULL');
    return { sql: conds.join(' AND '), params };
}

async function bounded<T>(timeoutMs: number, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeoutMs}`);
        await tx.$executeRawUnsafe('SET LOCAL max_parallel_workers_per_gather = 0');
        await tx.$executeRawUnsafe('SET LOCAL jit = off');
        return fn(tx as unknown as typeof prisma);
    }, { timeout: timeoutMs + 3000, maxWait: 5000 });
}

export async function findUsCompanies(filters: UsFilters, limit: number): Promise<UsCompany[]> {
    const { sql, params } = buildUsWhere(filters);
    const n = Math.max(1, Math.min(1000, Math.floor(limit)));
    return bounded(QUERY_TIMEOUT_MS, (tx) => tx.$queryRawUnsafe<UsCompany[]>(`SELECT * FROM "UsCompany" WHERE ${sql} LIMIT ${n}`, ...params));
}

export async function searchUsCompanies(filters: UsFilters, page: number, pageSize: number): Promise<{ companies: UsCompany[]; total: number; capped: boolean }> {
    const { sql, params } = buildUsWhere(filters);
    const offset = Math.min(MAX_OFFSET, Math.max(0, (page - 1) * pageSize));
    const companies = await bounded(QUERY_TIMEOUT_MS, (tx) => tx.$queryRawUnsafe<UsCompany[]>(
        `SELECT * FROM "UsCompany" WHERE ${sql} LIMIT ${pageSize} OFFSET ${offset}`, ...params));
    try {
        const [{ n }] = await bounded(COUNT_TIMEOUT_MS, (tx) => tx.$queryRawUnsafe<[{ n: bigint }]>(
            `SELECT count(*) AS n FROM (SELECT 1 FROM "UsCompany" WHERE ${sql} LIMIT ${US_COUNT_CAP + 1}) t`, ...params));
        const total = Number(n);
        return { companies, total: Math.min(total, US_COUNT_CAP), capped: total > US_COUNT_CAP };
    } catch {
        return { companies, total: offset + companies.length, capped: companies.length === pageSize };
    }
}
