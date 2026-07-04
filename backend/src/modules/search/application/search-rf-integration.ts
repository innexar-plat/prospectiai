import { prisma } from '@/lib/prisma';
import { getCached, setCached } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { PlaceResult } from '../domain/types';

const SEARCH_RF_CROSS_ENABLED = String(process.env.SEARCH_RF_CROSS_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_RF_MAX_RESULTS = Number.parseInt(process.env.SEARCH_RF_MAX_RESULTS ?? '20', 10);
const SEARCH_RF_AUTO_CNAE_LIMIT = Number.parseInt(process.env.SEARCH_RF_AUTO_CNAE_LIMIT ?? '5', 10);
const SEARCH_RF_AUTO_CNAE_LOOKUPS = Number.parseInt(process.env.SEARCH_RF_AUTO_CNAE_LOOKUPS ?? '12', 10);
const SEARCH_RF_CROSS_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_RF_CROSS_TIMEOUT_MS ?? '15000', 10);
const SEARCH_RF_CACHE_ENABLED = String(process.env.SEARCH_RF_CACHE_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_RF_CACHE_TTL_SECONDS = Number.parseInt(process.env.SEARCH_RF_CACHE_TTL_SECONDS ?? '900', 10);
const SEARCH_RF_MAX_IN_FLIGHT = Number.parseInt(process.env.SEARCH_RF_MAX_IN_FLIGHT ?? '2', 10);
const SEARCH_RF_BULKHEAD_ACQUIRE_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_RF_BULKHEAD_ACQUIRE_TIMEOUT_MS ?? '350', 10);
const SEARCH_RF_AI_CNAE_ENABLED = String(process.env.SEARCH_RF_AI_CNAE_ENABLED ?? 'true').toLowerCase() === 'true';
const SEARCH_RF_AI_CNAE_CACHE_TTL = Number.parseInt(process.env.SEARCH_RF_AI_CNAE_CACHE_TTL ?? '604800', 10);
const SEARCH_RF_AI_CNAE_TIMEOUT_MS = Number.parseInt(process.env.SEARCH_RF_AI_CNAE_TIMEOUT_MS ?? '8000', 10);

const SEARCH_RF_STOP_WORDS = new Set([
    'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na', 'nos', 'nas',
    'a', 'o', 'as', 'os', 'um', 'uma', 'negocios', 'negocio', 'empresa', 'empresas',
    'servicos', 'servico', 'brasil', 'estado', 'mato', 'grosso', 'sul', 'norte',
]);

const SEARCH_RF_CNAE_HINTS_BY_TYPE: Record<string, string[]> = {
    farm: ['agricultura', 'pecuaria', 'cultivo', 'fazenda', '0111', '0151'],
    ranch: ['pecuaria', 'bovino', 'gado', 'fazenda', '0151', '0152', '0141'],
    pharmacy: ['farmacia', 'drogaria', 'medicamentos', '4771'],
    dentist: ['odontologia', 'dentista', 'clinica odontologica', '8630506'],
    doctor: ['clinica medica', 'consultorio medico', 'atividade medica', '8630'],
    hospital: ['hospital', 'pronto socorro', '8610'],
    medical_lab: ['laboratorio', 'analises clinicas', '8640'],
    physiotherapist: ['fisioterapia', 'fisioterapeuta', '8650006'],
    restaurant: ['restaurante', 'alimentacao', 'lanchonete', '5611'],
    cafe: ['cafeteria', 'padaria', '5611203', '1091'],
    bakery: ['padaria', 'confeitaria', '1091'],
    bar: ['bar', 'pub', '5611204'],
    fast_food_restaurant: ['fast food', 'hamburgueria', 'lanchonete', '5611'],
    pizza_restaurant: ['pizzaria', '5611201'],
    ice_cream_shop: ['sorveteria', 'acai', '4721104'],
    supermarket: ['supermercado', 'mercearia', '4711'],
    beauty_salon: ['salao de beleza', 'cabeleireiro', 'estetica', '9602'],
    barber_shop: ['barbearia', '9602501'],
    skin_care_clinic: ['estetica', 'clinica estetica', '9602503'],
    spa: ['spa', 'day spa', '9609207'],
    lawyer: ['advogado', 'advocacia', '6911'],
    accounting: ['contabilidade', 'contador', '6920'],
    real_estate_agency: ['imobiliaria', '6821'],
    marketing_consultant: ['marketing', 'publicidade', '7311', '7312'],
    insurance_agency: ['seguradora', 'seguros', '6622', '6621'],
    consultant: ['consultoria', 'consultor', '7020'],
    coworking_space: ['coworking', 'escritorio compartilhado', '8211300'],
    store: ['loja', 'comercio', '4712', '4713'],
    pet_store: ['pet shop', 'veterinario', '4789004', '7500'],
    clothing_store: ['moda', 'roupas', 'boutique', '4781'],
    jewelry_store: ['joalheria', 'relojoaria', '4783'],
    book_store: ['livraria', 'papelaria', '4761'],
    bicycle_store: ['bicicleta', '4763602'],
    electronics_store: ['eletronicos', 'informatica', '4751', '4753'],
    furniture_store: ['moveis', 'marcenaria', '3101', '3102'],
    car_repair: ['oficina mecanica', 'auto center', '4520'],
    car_wash: ['lava rapido', 'lavagem', '4520005'],
    car_dealer: ['concessionaria', 'revenda veiculos', '4511'],
    auto_parts_store: ['auto pecas', 'pecas automotivas', '4530'],
    gas_station: ['posto gasolina', 'combustivel', '4731'],
    tire_shop: ['pneu', 'borracharia', '4530705'],
    school: ['escola', 'colegio', '8511', '8512', '8513'],
    university: ['faculdade', 'universidade', '8531', '8532'],
    preschool: ['creche', 'maternal', '8511200'],
    hotel: ['hotel', 'pousada', '5510'],
    inn: ['pousada', 'chale', '5510802'],
    travel_agency: ['agencia viagens', 'turismo', '7911', '7912'],
    hostel: ['hostel', 'albergue', '5510803'],
    resort_hotel: ['resort', '5510801'],
    general_contractor: ['construtora', 'construcao civil', '4120', '4110'],
    hardware_store: ['material construcao', 'ferragem', '4744'],
    electrician: ['eletricista', 'instalacao eletrica', '4321'],
    plumber: ['encanador', 'hidraulica', '4322'],
    moving_company: ['mudanca', 'frete', '4930204'],
    courier_service: ['motoboy', 'entregas', '5320202'],
    florist: ['floricultura', 'flores', '4789001'],
    laundry: ['lavanderia', 'limpeza', '9601'],
    banquet_hall: ['buffet', 'casa festas', '5620'],
    event_venue: ['espaco eventos', 'salao festas', '8230'],
    wedding_venue: ['casamento', 'cerimonial', '8230'],
    bank: ['banco', 'agencia bancaria', '6421', '6422'],
    veterinary_care: ['veterinaria', 'veterinario', '7500'],
    manufacturer: ['fabrica', 'industria', 'fabricacao', '1099'],
    gym: ['academia', 'condicionamento fisico', '9313', '9319'],
    fitness_center: ['academia', 'fitness', 'condicionamento fisico', '9313'],
};

const CNAE_KEYWORD_SYNONYMS: Record<string, string[]> = {
    fazenda: ['criacao de bovinos', 'cultivo', 'pecuaria', 'agricultura', '0111', '0115', '0151'],
    agropecuaria: ['criacao de bovinos', 'cultivo', 'pecuaria', 'agricultura', 'suinos', '0151', '0154'],
    pecuaria: ['criacao de bovinos', 'criacao de bufalinos', 'suinos', '0151', '0152', '0154'],
    gado: ['criacao de bovinos', '0151'],
    sitio: ['cultivo', 'horticultura', 'criacao', '0161'],
    granja: ['criacao de frangos', 'criacao de aves', 'ovos', '0155'],
    laticinio: ['laticinio', 'laticinios', 'leite', '1051'],
    frigorifico: ['abate de bovinos', 'abate de suinos', 'abate de aves', '1011', '1012', '1013'],
    soja: ['cultivo de soja', '0115'],
    cafe: ['cultivo de cafe', '0134', 'torrefacao', '1081'],
    cana: ['cultivo de cana', '0113'],
    algodao: ['cultivo de algodao', '0112'],
    despachante: ['despachante', 'documentacao', 'servicos combinados de escritorio', '8211', '6911', '5250801'],
    cartorio: ['cartorio', 'tabelionato', 'servicos notariais', '6912'],
    contabilidade: ['contabilidade', 'auditoria', '6920'],
    contador: ['contabilidade', 'auditoria', '6920'],
    advocacia: ['advocacia', 'advogado', '6911'],
    advogado: ['advocacia', '6911'],
    restaurante: ['restaurante', 'alimentacao', 'refeicoes', '5611'],
    lanchonete: ['lanchonete', 'restaurante', '5611'],
    pizzaria: ['pizzaria', '5611201'],
    hamburgueria: ['lanchonete', 'fast food', '5611'],
    churrascaria: ['restaurante', '5611'],
    padaria: ['padaria', 'confeitaria', 'panificacao', '1091', '4721102'],
    acougue: ['acougue', 'carnes', '4722901'],
    sorveteria: ['sorvete', '4721104'],
    doceria: ['confeitaria', 'doces', '1091102'],
    clinica: ['clinica medica', 'atividade medica', 'saude', '8630'],
    hospital: ['hospital', 'pronto socorro', '8610'],
    laboratorio: ['laboratorio', 'analises clinicas', '8640'],
    dentista: ['odontologia', 'dentista', '8630506'],
    farmacia: ['farmacia', 'drogaria', '4771'],
    otica: ['otica', 'optometria', '4774'],
    psicologia: ['psicologia', 'psicanalise', '8650004'],
    fisioterapia: ['fisioterapia', '8650006'],
    veterinaria: ['veterinaria', 'veterinario', '7500'],
    salao: ['cabeleireiro', 'salao de beleza', 'estetica', '9602'],
    barbearia: ['barbearia', '9602501'],
    estetica: ['estetica', 'clinica estetica', '9602503'],
    loja: ['comercio varejista', 'loja', '4712', '4713'],
    mercado: ['supermercado', 'mercearia', 'minimercado', '4711'],
    papelaria: ['papelaria', '4761003'],
    floricultura: ['floricultura', '4789001'],
    petshop: ['pet shop', '4789004'],
    'pet shop': ['pet shop', '4789004'],
    boutique: ['roupas', 'vestuario', 'moda', '4781'],
    livraria: ['livros', 'livraria', '4761001'],
    joalheria: ['joalheria', 'relojoaria', '4783'],
    moveis: ['moveis', 'movelaria', '4754', '3101'],
    eletronicos: ['eletronicos', 'informatica', '4751', '4753'],
    celular: ['telefonia', 'comunicacao', '4752100'],
    materiais: ['material construcao', 'ferragem', '4744'],
    ferragem: ['ferragem', 'ferramentas', '4744'],
    oficina: ['oficina mecanica', 'reparacao de veiculos', '4520'],
    mecanica: ['oficina mecanica', 'reparacao', '4520'],
    funilaria: ['funilaria', 'pintura', '4520002'],
    borracharia: ['borracharia', 'pneu', '4530705'],
    concessionaria: ['concessionaria', 'revenda veiculos', '4511'],
    autopecas: ['auto pecas', 'pecas automotivas', '4530'],
    'auto pecas': ['auto pecas', '4530'],
    posto: ['posto gasolina', 'combustivel', '4731'],
    lava: ['lavagem', 'lava rapido', '4520005'],
    estacionamento: ['estacionamento', '5223100'],
    autoescola: ['auto escola', 'formacao de condutores', '8599604'],
    escola: ['escola', 'ensino', 'educacao', '8511', '8512', '8513'],
    colegio: ['ensino fundamental', 'ensino medio', '8512', '8513'],
    faculdade: ['faculdade', 'universidade', 'ensino superior', '8531', '8532'],
    curso: ['curso', 'ensino', 'instrucao', '8599'],
    creche: ['creche', 'educacao infantil', '8511200'],
    idioma: ['idioma', 'lingua', '8593700'],
    construtora: ['construtora', 'construcao civil', '4120', '4110'],
    engenharia: ['engenharia', 'servicos de engenharia', '7112'],
    arquitetura: ['arquitetura', '7111'],
    imobiliaria: ['imobiliaria', 'corretagem de imoveis', '6821'],
    eletricista: ['eletricista', 'instalacao eletrica', '4321'],
    encanador: ['encanador', 'hidraulica', '4322'],
    pintor: ['pintura', '4330401'],
    serralheria: ['serralheria', '2542'],
    vidracaria: ['vidracaria', 'vidros', '2311700'],
    informatica: ['informatica', 'tecnologia', 'software', '6201', '6202', '6203'],
    software: ['software', 'desenvolvimento de sistemas', '6201'],
    tecnologia: ['tecnologia', 'informatica', '6201', '6209'],
    marketing: ['marketing', 'publicidade', 'propaganda', '7311', '7312'],
    agencia: ['publicidade', 'propaganda', 'marketing', '7311'],
    transportadora: ['transporte', 'carga', 'frete', '4930'],
    frete: ['frete', 'transporte', 'mudanca', '4930'],
    mudanca: ['mudanca', 'transporte', '4930204'],
    motoboy: ['motoboy', 'entregas', '5320202'],
    taxi: ['taxi', 'transporte de passageiros', '4923002'],
    hotel: ['hotel', 'hospedagem', '5510'],
    pousada: ['pousada', 'hospedagem', '5510802'],
    turismo: ['turismo', 'agencia viagens', '7911', '7912'],
    fabrica: ['fabricacao', 'industria', 'manufatura'],
    industria: ['fabricacao', 'industria'],
    metalurgica: ['metalurgica', 'siderurgia', '2431', '2443'],
    textil: ['textil', 'confeccao', 'tecelagem', '1311', '1412'],
    grafica: ['grafica', 'impressao', '1811'],
    banco: ['banco', 'instituicao financeira', '6421', '6422'],
    seguradora: ['seguradora', 'seguros', '6511', '6512'],
    corretora: ['corretora', 'corretagem', '6612'],
    financeira: ['financeira', 'credito', '6431'],
    buffet: ['buffet', 'alimentacao', '5620'],
    festas: ['festas', 'eventos', '8230'],
    cinema: ['cinema', 'exibicao cinematografica', '5914'],
    teatro: ['teatro', 'artes cenicas', '9001901'],
    academia: ['academia', 'condicionamento fisico', '9313'],
    lavanderia: ['lavanderia', 'limpeza', '9601'],
    seguranca: ['seguranca', 'vigilancia', '8011'],
    limpeza: ['limpeza', 'conservacao', '8121'],
    funeraria: ['funeraria', 'servicos funerarios', '9603'],
    cemiterio: ['sepultamento', 'cemiterio', '9603303'],
    coworking: ['coworking', 'escritorio compartilhado', '8211'],
    consultoria: ['consultoria', 'gestao empresarial', '7020'],
    contato: ['consultoria', '7020'],
    fotografia: ['fotografia', 'fotografo', '7420'],
    grafico: ['design grafico', '7410'],
};

const RF_NAME_SUFFIXES = /\b(ltda|me|eireli|epp|sa|s\.a|s\/a|ss|ltd|inc|co|cia|filial|matriz)\b/gi;

let rfCrossInFlightCount = 0;
const inFlightRfCrossSearch = new Map<string, Promise<PlaceResult[]>>();

function isBrazilCountry(country?: string | null): boolean {
    const normalized = (country ?? '').trim().toUpperCase();
    return normalized === '' || normalized === 'BR' || normalized === 'BRAZIL' || normalized === 'BRASIL';
}

function normalizeRfTerm(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function tokenizeRfTerm(value: string): string[] {
    return normalizeRfTerm(value)
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length >= 4 && !SEARCH_RF_STOP_WORDS.has(part));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    const safeTimeoutMs = Math.max(1000, timeoutMs);
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            const timer = setTimeout(() => {
                clearTimeout(timer);
                reject(new Error(timeoutMessage));
            }, safeTimeoutMs);
        }),
    ]) as Promise<T>;
}

async function inferCnaesWithAI(textQuery: string): Promise<string[]> {
    if (!SEARCH_RF_AI_CNAE_ENABLED) return [];

    const cacheKey = `search:ai-cnae:${normalizeRfTerm(textQuery)}`;
    const cached = await getCached<string[]>(cacheKey);
    if (cached && Array.isArray(cached)) return cached;

    try {
        const { generateCompletionForRole } = await import('@/lib/ai');
        const result = await withTimeout(
            generateCompletionForRole('lead_analysis', {
                systemPrompt: [
                    'Você é um classificador brasileiro de CNAE (Classificação Nacional de Atividades Econômicas).',
                    'O usuário vai descrever um tipo de negócio ou atividade.',
                    'Retorne SOMENTE um JSON com a chave "codes" contendo um array de até 5 prefixos CNAE (4-7 dígitos) mais relevantes.',
                    'Prefira prefixos curtos (4 dígitos) quando cobrirem a atividade.',
                    'Exemplo: {"codes":["0151","0152","0111"]}',
                    'Se não conseguir identificar nenhum CNAE, retorne {"codes":[]}.',
                    'NUNCA retorne texto fora do JSON.',
                ].join('\n'),
                prompt: `Tipo de negócio: "${textQuery}"`,
                jsonMode: true,
                maxOutputTokens: 256,
            }),
            SEARCH_RF_AI_CNAE_TIMEOUT_MS,
            'AI_CNAE_INFERENCE_TIMEOUT',
        );

        const { extractJsonFromLlm } = await import('@/lib/ai');
        const parsed = extractJsonFromLlm<{ codes?: string[] }>(result.text);
        const codes = (parsed?.codes ?? [])
            .map((c: string) => String(c).replace(/\D/g, '').trim())
            .filter((c: string) => c.length >= 4 && c.length <= 7)
            .slice(0, 5);

        await setCached(cacheKey, codes, SEARCH_RF_AI_CNAE_CACHE_TTL);
        logger.info('AI CNAE inference', { textQuery, codes, provider: result.provider, model: result.model });
        return codes;
    } catch (err) {
        logger.warn('AI CNAE inference failed', {
            textQuery,
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}

async function inferCnaesForSearch(textQuery: string, includedType?: string | null): Promise<string[]> {
    const terms: string[] = [textQuery];
    if (includedType) {
        terms.push(...(SEARCH_RF_CNAE_HINTS_BY_TYPE[includedType] ?? []));
    }

    const queryNorm = normalizeRfTerm(textQuery);
    const queryTokens = tokenizeRfTerm(textQuery);
    const synonymExpansion: string[] = [];
    for (const key of [queryNorm, ...queryTokens]) {
        const syn = CNAE_KEYWORD_SYNONYMS[key];
        if (syn) synonymExpansion.push(...syn);
    }
    if (synonymExpansion.length > 0) {
        terms.push(...synonymExpansion);
    }

    const allRaw = terms.flatMap((term) => [term, ...tokenizeRfTerm(term)]);
    const seen = new Set<string>();
    const expandedTerms: string[] = [];
    for (const raw of allRaw) {
        const norm = normalizeRfTerm(raw);
        if (norm.length < 2 || seen.has(norm)) continue;
        seen.add(norm);
        expandedTerms.push(norm);
    }

    const found = new Set<string>();
    let lookups = 0;
    for (const term of expandedTerms) {
        if (lookups >= Math.max(1, SEARCH_RF_AUTO_CNAE_LOOKUPS)) break;
        lookups += 1;

        let matches: { code: string }[];
        if (/^\d+$/.test(term)) {
            matches = await prisma.cnaeCode.findMany({
                where: { code: { startsWith: term } },
                take: 8,
                select: { code: true },
            });
        } else {
            matches = await prisma.$queryRawUnsafe<{ code: string }[]>(
                `SELECT code FROM "CnaeCode" WHERE unaccent(lower(description)) LIKE $1 LIMIT 8`,
                `%${term}%`,
            );
        }
        for (const match of matches) {
            if (match.code?.trim()) found.add(match.code.trim());
            if (found.size >= Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT)) break;
        }
        if (found.size >= Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT)) break;
    }

    if (found.size > 0) {
        return Array.from(found).slice(0, Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT));
    }

    const aiCodes = await inferCnaesWithAI(textQuery);
    return aiCodes.slice(0, Math.max(1, SEARCH_RF_AUTO_CNAE_LIMIT));
}

async function searchRfPlacesForCross(
    cnaes: string[],
    state?: string | null,
    city?: string | null,
): Promise<PlaceResult[]> {
    if (cnaes.length === 0) return [];

    const maxResults = Math.max(10, Math.min(200, SEARCH_RF_MAX_RESULTS || 20));

    const stateTrim = state?.trim();
    const hasState = stateTrim && stateTrim !== 'Todos';
    const cityTrim = city?.trim();
    const hasCity = !!cityTrim;

    const cols = `cnpj, "razaoSocial", "nomeFantasia", "cnaePrincipal", uf, municipio, bairro, logradouro, numero, ddd, telefone, porte`;
    const params: (string | number)[] = [];
    let paramIdx = 1;

    const perCnaeLimit = Math.max(5, Math.ceil(maxResults / cnaes.length));

    const branches: string[] = [];
    for (const code of cnaes) {
        const branchConds: string[] = [];

        if (hasState) {
            branchConds.push(`uf = $${paramIdx}`);
            params.push(stateTrim!.toUpperCase());
            paramIdx += 1;
        }

        if (code.length >= 7) {
            branchConds.push(`"cnaePrincipal" = $${paramIdx}`);
            params.push(code);
            paramIdx += 1;
        } else {
            const upper = code.slice(0, -1) + String.fromCharCode(code.charCodeAt(code.length - 1) + 1);
            branchConds.push(`"cnaePrincipal" >= $${paramIdx} AND "cnaePrincipal" < $${paramIdx + 1}`);
            params.push(code, upper);
            paramIdx += 2;
        }

        if (hasCity) {
            branchConds.push(`lower(municipio) LIKE $${paramIdx}`);
            params.push(`%${cityTrim!.toLowerCase()}%`);
            paramIdx += 1;
        }

        branches.push(
            `(SELECT ${cols} FROM "RfCompany" WHERE ${branchConds.join(' AND ')} LIMIT ${perCnaeLimit})`,
        );
    }

    params.push(maxResults);
    const sql = `SELECT * FROM (${branches.join(' UNION ALL ')}) sub LIMIT $${paramIdx}`;

    const companies = await prisma.$queryRawUnsafe<Array<{
        cnpj: string; razaoSocial: string; nomeFantasia: string | null; cnaePrincipal: string;
        uf: string; municipio: string | null; bairro: string | null; logradouro: string | null;
        numero: string | null; ddd: string | null; telefone: string | null; porte: string | null;
    }>>(sql, ...params);

    if (companies.length === 0) return [];

    const cnaeCodes = [...new Set(companies.map((item) => item.cnaePrincipal))];
    const cnaeRows = await prisma.cnaeCode.findMany({
        where: { code: { in: cnaeCodes } },
        select: { code: true, description: true },
    });
    const cnaeByCode = new Map(cnaeRows.map((row) => [row.code, row.description]));

    return companies.map((item) => {
        const phone = item.ddd && item.telefone ? `(${item.ddd}) ${item.telefone}` : item.telefone || undefined;
        const address = [item.logradouro, item.numero, item.bairro, item.municipio, item.uf].filter(Boolean).join(', ');
        const porteScore = item.porte === 'DEMAIS' ? 60 : item.porte === 'EPP' ? 50 : 40;

        return {
            id: `rf_${item.cnpj}`,
            displayName: { text: item.nomeFantasia || item.razaoSocial, languageCode: 'pt-BR' },
            formattedAddress: address || undefined,
            nationalPhoneNumber: phone,
            cnpj: item.cnpj,
            companyLegalName: item.razaoSocial,
            companyTradeName: item.nomeFantasia || undefined,
            companyMainCnae: cnaeByCode.get(item.cnaePrincipal) || item.cnaePrincipal,
            cnpjStatus: 'ATIVA',
            businessStatus: 'OPERATIONAL',
            opportunityScore: porteScore,
        } as PlaceResult;
    });
}

function buildRfCrossCacheKey(cnaes: string[], state?: string | null, city?: string | null): string {
    const normalizedCnaes = [...cnaes].map((code) => code.trim()).filter(Boolean).sort().join(',');
    return [
        'search:rf-cross',
        normalizedCnaes,
        (state ?? '').trim().toLowerCase(),
        (city ?? '').trim().toLowerCase(),
    ].join(':');
}

async function acquireRfCrossSlot(): Promise<() => void> {
    const maxInFlight = Math.max(1, SEARCH_RF_MAX_IN_FLIGHT);
    const deadline = Date.now() + Math.max(50, SEARCH_RF_BULKHEAD_ACQUIRE_TIMEOUT_MS);

    while (rfCrossInFlightCount >= maxInFlight) {
        if (Date.now() >= deadline) {
            throw new Error('RF_BULKHEAD_TIMEOUT');
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    rfCrossInFlightCount += 1;
    return () => {
        rfCrossInFlightCount = Math.max(0, rfCrossInFlightCount - 1);
    };
}

async function runRfCrossSearchCached(cnaes: string[], state?: string | null, city?: string | null): Promise<PlaceResult[]> {
    const cacheKey = buildRfCrossCacheKey(cnaes, state, city);
    if (SEARCH_RF_CACHE_ENABLED) {
        const cached = await getCached<PlaceResult[]>(cacheKey);
        if (cached && cached.length > 0) {
            return JSON.parse(JSON.stringify(cached)) as PlaceResult[];
        }
    }

    const inFlight = inFlightRfCrossSearch.get(cacheKey);
    if (inFlight) {
        return JSON.parse(JSON.stringify(await inFlight)) as PlaceResult[];
    }

    const requestPromise = searchRfPlacesForCross(cnaes, state, city)
        .finally(() => {
            inFlightRfCrossSearch.delete(cacheKey);
        });
    inFlightRfCrossSearch.set(cacheKey, requestPromise);

    const result = JSON.parse(JSON.stringify(await requestPromise)) as PlaceResult[];
    if (SEARCH_RF_CACHE_ENABLED) {
        await setCached(cacheKey, result, Math.max(60, SEARCH_RF_CACHE_TTL_SECONDS));
    }
    return result;
}

function normalizeCompanyName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(RF_NAME_SUFFIXES, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenOverlap(a: string, b: string): number {
    const tokA = new Set(a.split(' ').filter((t) => t.length >= 3));
    const tokB = new Set(b.split(' ').filter((t) => t.length >= 3));
    if (tokA.size === 0 || tokB.size === 0) return 0;
    let overlap = 0;
    for (const t of tokA) {
        if (tokB.has(t)) overlap++;
    }
    const minLen = Math.min(tokA.size, tokB.size);
    return overlap / minLen;
}

function findRfMatchForGooglePlace(
    gpNameNorm: string,
    rfIndex: Map<string, PlaceResult>,
    rfNormNames: Map<string, string>,
): PlaceResult | null {
    const exactKey = rfIndex.get(gpNameNorm);
    if (exactKey) return exactKey;

    for (const [rfNorm, rfOrigKey] of rfNormNames) {
        if (tokenOverlap(gpNameNorm, rfNorm) >= 0.6) {
            return rfIndex.get(rfOrigKey) ?? null;
        }
        if (gpNameNorm.length >= 5 && rfNorm.length >= 5) {
            if (gpNameNorm.includes(rfNorm) || rfNorm.includes(gpNameNorm)) {
                return rfIndex.get(rfOrigKey) ?? null;
            }
        }
    }
    return null;
}

function deduplicateContacts(
    values: (string | null | undefined)[],
    normalizer: (v: string) => string,
): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const v of values) {
        const raw = v?.trim();
        if (!raw) continue;
        const norm = normalizer(raw);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        result.push(raw);
    }
    return result;
}

function normalizePhoneForDedup(phone: string): string {
    return phone.replace(/\D/g, '');
}

function normalizeWebsiteForDedup(url: string): string {
    try {
        const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${host}${path}`;
    } catch {
        return url.trim().toLowerCase();
    }
}

function mergeRfAndGooglePlaces(rfPlaces: PlaceResult[], googlePlaces: PlaceResult[]): PlaceResult[] {
    const result: PlaceResult[] = [];
    const seenKeys = new Set<string>();
    const matchedRfKeys = new Set<string>();

    const rfByOrigKey = new Map<string, PlaceResult>();
    const rfNormToOrigKey = new Map<string, string>();

    for (const rf of rfPlaces) {
        const origKey = (rf.displayName?.text ?? '').toLowerCase().trim();
        if (!origKey) continue;
        rfByOrigKey.set(origKey, rf);
        const norm = normalizeCompanyName(rf.displayName?.text ?? '');
        if (norm) rfNormToOrigKey.set(norm, origKey);
        if (rf.companyTradeName) {
            const tradeNorm = normalizeCompanyName(rf.companyTradeName);
            if (tradeNorm) rfNormToOrigKey.set(tradeNorm, origKey);
        }
        if (rf.companyLegalName) {
            const legalNorm = normalizeCompanyName(rf.companyLegalName);
            if (legalNorm) rfNormToOrigKey.set(legalNorm, origKey);
        }
    }

    for (const gp of googlePlaces) {
        const gpKey = (gp.displayName?.text ?? '').toLowerCase().trim();
        if (!gpKey || seenKeys.has(gpKey)) continue;
        seenKeys.add(gpKey);

        const gpNorm = normalizeCompanyName(gp.displayName?.text ?? '');
        const rfMatch = findRfMatchForGooglePlace(gpNorm, rfByOrigKey, rfNormToOrigKey);
        if (rfMatch) {
            const rfKey = (rfMatch.displayName?.text ?? '').toLowerCase().trim();
            matchedRfKeys.add(rfKey);

            const allPhones = deduplicateContacts([
                gp.nationalPhoneNumber,
                gp.internationalPhoneNumber,
                gp.phone,
                rfMatch.nationalPhoneNumber,
                rfMatch.phone,
            ], normalizePhoneForDedup);

            const allEmails = deduplicateContacts([
                gp.email,
                rfMatch.email,
            ], (v) => v.toLowerCase().trim());

            const allWebsites = deduplicateContacts([
                gp.websiteUri,
                gp.website,
                rfMatch.websiteUri,
                rfMatch.website,
            ], normalizeWebsiteForDedup);

            result.push({
                ...gp,
                nationalPhoneNumber: gp.nationalPhoneNumber || gp.internationalPhoneNumber || rfMatch.nationalPhoneNumber,
                email: gp.email || rfMatch.email,
                cnpj: rfMatch.cnpj ?? gp.cnpj,
                companyLegalName: rfMatch.companyLegalName ?? gp.companyLegalName,
                companyTradeName: rfMatch.companyTradeName ?? gp.companyTradeName,
                companyMainCnae: rfMatch.companyMainCnae ?? gp.companyMainCnae,
                cnpjStatus: rfMatch.cnpjStatus ?? gp.cnpjStatus,
                phones: allPhones,
                emails: allEmails,
                websites: allWebsites,
            });
        } else {
            result.push(gp);
        }
    }

    for (const rf of rfPlaces) {
        const rfKey = (rf.displayName?.text ?? '').toLowerCase().trim();
        if (!rfKey || seenKeys.has(rfKey) || matchedRfKeys.has(rfKey)) continue;
        seenKeys.add(rfKey);
        result.push(rf);
    }

    logger.info('Search RF merge', {
        googleCount: googlePlaces.length,
        rfCount: rfPlaces.length,
        merged: matchedRfKeys.size,
        rfOnlyAppended: result.length - googlePlaces.length,
        totalResult: result.length,
    });

    return result;
}

export async function crossWithReceitaIfEligible(
    places: PlaceResult[],
    textQuery: string,
    includedType?: string | null,
    city?: string | null,
    state?: string | null,
    country?: string | null,
): Promise<PlaceResult[]> {
    if (!SEARCH_RF_CROSS_ENABLED || !isBrazilCountry(country)) return places;

    try {
        const releaseSlot = await acquireRfCrossSlot();
        try {
            const cnaes = await withTimeout(
                inferCnaesForSearch(textQuery, includedType),
                SEARCH_RF_CROSS_TIMEOUT_MS,
                'RF_CNAE_INFERENCE_TIMEOUT',
            );
            if (cnaes.length === 0) {
                logger.info('Search RF cross: no inferred CNAE', { textQuery, includedType: includedType ?? null });
                return places;
            }

            const rfPlaces = await withTimeout(
                runRfCrossSearchCached(cnaes, state, city),
                SEARCH_RF_CROSS_TIMEOUT_MS,
                'RF_SEARCH_TIMEOUT',
            );
            logger.info('Search RF cross', {
                textQuery,
                includedType: includedType ?? null,
                inferredCnaes: cnaes,
                rfCount: rfPlaces.length,
                baseCount: places.length,
            });
            if (rfPlaces.length === 0) return places;
            return mergeRfAndGooglePlaces(rfPlaces, places);
        } finally {
            releaseSlot();
        }
    } catch (error) {
        logger.info('Search RF cross failed', {
            textQuery,
            includedType: includedType ?? null,
            error: error instanceof Error ? error.message : 'Unknown',
        });
        return places;
    }
}
