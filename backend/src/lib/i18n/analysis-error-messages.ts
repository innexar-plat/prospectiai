import type { LeadAnalysis } from '@/lib/ai/prompts/analyze-types';

export type AnalyzeLocale = 'pt' | 'en' | 'es';

type AnalysisErrorKey =
    | 'configMissing'
    | 'apiKeyRestricted'
    | 'quotaExceeded'
    | 'apiKeyInvalid'
    | 'serviceUnavailable'
    | 'modelUnavailable'
    | 'analysisStale'
    | 'analysisFailed';

const ERROR_MESSAGES: Record<AnalyzeLocale, Record<AnalysisErrorKey, string>> = {
    pt: {
        configMissing: 'IA não configurada. Configure um provedor em Admin ou GEMINI_API_KEY no servidor.',
        apiKeyRestricted: 'API Key com restrição (IP ou domínio). Verifique no painel do provedor.',
        quotaExceeded: 'Limite de uso da API atingido. Tente novamente em alguns minutos.',
        apiKeyInvalid: 'Chave da API inválida. Verifique a configuração no admin.',
        serviceUnavailable: 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.',
        modelUnavailable: 'Modelo em uso não está mais disponível. Atualize o modelo na configuração de IA.',
        analysisStale: 'A análise demorou mais que o esperado ou foi interrompida. Tente novamente.',
        analysisFailed: 'Não foi possível gerar análise detalhada no momento.',
    },
    en: {
        configMissing: 'AI is not configured. Set up a provider in Admin or GEMINI_API_KEY on the server.',
        apiKeyRestricted: 'API key has restrictions (IP or domain). Check your provider dashboard.',
        quotaExceeded: 'API usage limit reached. Try again in a few minutes.',
        apiKeyInvalid: 'Invalid API key. Check the configuration in admin.',
        serviceUnavailable: 'AI service temporarily unavailable. Try again shortly.',
        modelUnavailable: 'The model in use is no longer available. Update the model in AI settings.',
        analysisStale: 'Analysis took longer than expected or was interrupted. Please try again.',
        analysisFailed: 'Could not generate a detailed analysis at this time.',
    },
    es: {
        configMissing: 'IA no configurada. Configure un proveedor en Admin o GEMINI_API_KEY en el servidor.',
        apiKeyRestricted: 'La clave API tiene restricciones (IP o dominio). Revise el panel del proveedor.',
        quotaExceeded: 'Límite de uso de la API alcanzado. Intente de nuevo en unos minutos.',
        apiKeyInvalid: 'Clave API inválida. Verifique la configuración en admin.',
        serviceUnavailable: 'Servicio de IA temporalmente no disponible. Intente de nuevo en breve.',
        modelUnavailable: 'El modelo en uso ya no está disponible. Actualice el modelo en la configuración de IA.',
        analysisStale: 'El análisis tardó más de lo esperado o fue interrumpido. Intente de nuevo.',
        analysisFailed: 'No fue posible generar un análisis detallado en este momento.',
    },
};

const SCORE_LABELS: Record<AnalyzeLocale, string> = {
    pt: 'Indisponível',
    en: 'Unavailable',
    es: 'No disponible',
};

const APPROACH_HINTS: Record<AnalyzeLocale, string> = {
    pt: 'Verifique a configuração de IA no painel admin.',
    en: 'Check AI configuration in the admin panel.',
    es: 'Verifique la configuración de IA en el panel admin.',
};

const ERROR_TITLES: Record<AnalyzeLocale, string> = {
    pt: 'Erro',
    en: 'Error',
    es: 'Error',
};

export function normalizeAnalyzeLocale(locale: string): AnalyzeLocale {
    if (locale?.trim()) {
        const base = locale.split('-')[0]!.toLowerCase();
        if (base === 'en' || base === 'es' || base === 'pt') return base;
    }
    if (process.env.MARKET === 'US') return 'en';
    return 'pt';
}

function classifyAnalysisErrorKey(msg: string): AnalysisErrorKey {
    if (msg.includes('no ai config') || msg.includes('not set')) return 'configMissing';
    if (msg.includes('timed out') || msg.includes('interrupted') || msg.includes('analysis_stale')) return 'analysisStale';
    if (msg.includes('403') || msg.includes('restriction') || msg.includes('permission')) return 'apiKeyRestricted';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) return 'quotaExceeded';
    if (msg.includes('401') || msg.includes('invalid') || msg.includes('api key')) return 'apiKeyInvalid';
    if (msg.includes('500') || msg.includes('unavailable')) return 'serviceUnavailable';
    if (msg.includes('404') || msg.includes('no longer available') || msg.includes('newer model')) return 'modelUnavailable';
    return 'analysisFailed';
}

export function getAnalysisErrorMessage(msg: string, locale: string): string {
    const lang = normalizeAnalyzeLocale(locale);
    const key = classifyAnalysisErrorKey(msg);
    return ERROR_MESSAGES[lang][key];
}

export function buildFallbackAnalysis(errorMessage: string, locale: string): LeadAnalysis {
    const lang = normalizeAnalyzeLocale(locale);
    return {
        score: 0,
        scoreLabel: SCORE_LABELS[lang],
        summary: errorMessage,
        strengths: [],
        weaknesses: [],
        painPoints: [],
        gaps: [],
        approach: APPROACH_HINTS[lang],
        contactStrategy: '',
        firstContactMessage: '',
        suggestedWhatsAppMessage: '',
        fullReport: `# ${ERROR_TITLES[lang]}\n\n${errorMessage}`,
    };
}
