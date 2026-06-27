import type { SupportedLocale } from '@/lib/locale';
import { normalizeAnalyzeLocale } from '@/lib/locale';
import { interpolate } from '@/lib/i18n/translate';

export type AnalyzeProgressStepKey =
    | 'profile'
    | 'web_search'
    | 'conversion'
    | 'prompt'
    | 'ai_call'
    | 'parsing'
    | 'saving'
    | 'done';

/** Keys for AI errors, analyze progress and API/log messages — pt / en / es */
export const LOG_MESSAGES: Record<SupportedLocale, Record<string, string>> = {
    pt: {
        'log.ai.configMissing': 'IA não configurada. Configure um provedor em Admin ou GEMINI_API_KEY no servidor.',
        'log.ai.apiKeyRestricted': 'API Key com restrição (IP ou domínio). Verifique no painel do provedor.',
        'log.ai.quotaExceeded': 'Limite de uso da API atingido. Tente novamente em alguns minutos.',
        'log.ai.apiKeyInvalid': 'Chave da API inválida. Verifique a configuração no admin.',
        'log.ai.serviceUnavailable': 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.',
        'log.ai.modelUnavailable': 'Modelo em uso não está mais disponível. Atualize o modelo na configuração de IA.',
        'log.ai.analysisFailed': 'Não foi possível gerar análise detalhada no momento.',
        'log.ai.checkAdminConfig': 'Verifique a configuração de IA no painel admin.',
        'log.ai.unavailable': 'Indisponível',
        'log.ai.errorTitle': 'Erro',
        'log.analyze.step.profile': 'Carregando perfil do negócio...',
        'log.analyze.step.web_search': 'Buscando inteligência web (Reclame Aqui, CNPJ, JusBrasil)...',
        'log.analyze.step.conversion': 'Analisando seu histórico de conversão...',
        'log.analyze.step.prompt': 'Construindo prompt estratégico...',
        'log.analyze.step.ai_call': 'IA analisando o lead...',
        'log.analyze.step.parsing': 'Processando resposta da IA...',
        'log.analyze.step.saving': 'Salvando análise...',
        'log.analyze.step.done': 'Análise concluída!',
        'log.analyze.error.timeout': 'Tempo limite excedido. Tente novamente.',
        'log.analyze.error.stale': 'A análise demorou mais que o esperado ou foi interrompida. Tente novamente.',
        'log.analyze.error.failed': 'Erro ao analisar',
        'log.analyze.error.jobNotFound': 'Job não encontrado ou expirado.',
        'log.analyze.error.statusCheck': 'Erro ao verificar status',
        'log.analyze.error.serviceUnavailable': 'Serviço temporariamente indisponível. Tente novamente.',
        'log.analyze.error.startFailed': 'Erro ao iniciar análise',
        'log.api.internalError': 'Erro interno do servidor',
    },
    en: {
        'log.ai.configMissing': 'AI is not configured. Set up a provider in Admin or GEMINI_API_KEY on the server.',
        'log.ai.apiKeyRestricted': 'API key has restrictions (IP or domain). Check your provider dashboard.',
        'log.ai.quotaExceeded': 'API usage limit reached. Try again in a few minutes.',
        'log.ai.apiKeyInvalid': 'Invalid API key. Check the configuration in admin.',
        'log.ai.serviceUnavailable': 'AI service temporarily unavailable. Try again shortly.',
        'log.ai.modelUnavailable': 'The model in use is no longer available. Update the model in AI settings.',
        'log.ai.analysisFailed': 'Could not generate a detailed analysis at this time.',
        'log.ai.checkAdminConfig': 'Check AI configuration in the admin panel.',
        'log.ai.unavailable': 'Unavailable',
        'log.ai.errorTitle': 'Error',
        'log.analyze.step.profile': 'Loading business profile...',
        'log.analyze.step.web_search': 'Searching web intelligence (Reclame Aqui, CNPJ, JusBrasil)...',
        'log.analyze.step.conversion': 'Analyzing your conversion history...',
        'log.analyze.step.prompt': 'Building strategic prompt...',
        'log.analyze.step.ai_call': 'AI analyzing the lead...',
        'log.analyze.step.parsing': 'Processing AI response...',
        'log.analyze.step.saving': 'Saving analysis...',
        'log.analyze.step.done': 'Analysis complete!',
        'log.analyze.error.timeout': 'Timeout exceeded. Please try again.',
        'log.analyze.error.stale': 'Analysis took longer than expected or was interrupted. Please try again.',
        'log.analyze.error.failed': 'Error analyzing lead',
        'log.analyze.error.jobNotFound': 'Job not found or expired.',
        'log.analyze.error.statusCheck': 'Error checking status',
        'log.analyze.error.serviceUnavailable': 'Service temporarily unavailable. Please try again.',
        'log.analyze.error.startFailed': 'Error starting analysis',
        'log.api.internalError': 'Internal server error',
    },
    es: {
        'log.ai.configMissing': 'IA no configurada. Configure un proveedor en Admin o GEMINI_API_KEY en el servidor.',
        'log.ai.apiKeyRestricted': 'La clave API tiene restricciones (IP o dominio). Revise el panel del proveedor.',
        'log.ai.quotaExceeded': 'Límite de uso de la API alcanzado. Intente de nuevo en unos minutos.',
        'log.ai.apiKeyInvalid': 'Clave API inválida. Verifique la configuración en admin.',
        'log.ai.serviceUnavailable': 'Servicio de IA temporalmente no disponible. Intente de nuevo en breve.',
        'log.ai.modelUnavailable': 'El modelo en uso ya no está disponible. Actualice el modelo en la configuración de IA.',
        'log.ai.analysisFailed': 'No fue posible generar un análisis detallado en este momento.',
        'log.ai.checkAdminConfig': 'Verifique la configuración de IA en el panel admin.',
        'log.ai.unavailable': 'No disponible',
        'log.ai.errorTitle': 'Error',
        'log.analyze.step.profile': 'Cargando perfil del negocio...',
        'log.analyze.step.web_search': 'Buscando inteligencia web (Reclame Aqui, CNPJ, JusBrasil)...',
        'log.analyze.step.conversion': 'Analizando su historial de conversión...',
        'log.analyze.step.prompt': 'Construyendo prompt estratégico...',
        'log.analyze.step.ai_call': 'IA analizando el lead...',
        'log.analyze.step.parsing': 'Procesando respuesta de la IA...',
        'log.analyze.step.saving': 'Guardando análisis...',
        'log.analyze.step.done': '¡Análisis completado!',
        'log.analyze.error.timeout': 'Tiempo límite excedido. Intente de nuevo.',
        'log.analyze.error.stale': 'El análisis tardó más de lo esperado o fue interrumpido. Intente de nuevo.',
        'log.analyze.error.failed': 'Error al analizar',
        'log.analyze.error.jobNotFound': 'Trabajo no encontrado o expirado.',
        'log.analyze.error.statusCheck': 'Error al verificar estado',
        'log.analyze.error.serviceUnavailable': 'Servicio temporalmente no disponible. Intente de nuevo.',
        'log.analyze.error.startFailed': 'Error al iniciar análisis',
        'log.api.internalError': 'Error interno del servidor',
    },
};

export type LogMessageKey = keyof (typeof LOG_MESSAGES)['pt'];

export function getLogMessage(
    key: LogMessageKey,
    locale: SupportedLocale | string,
    params?: Record<string, unknown>,
): string {
    const lang = normalizeAnalyzeLocale(locale);
    const template = LOG_MESSAGES[lang][key] ?? LOG_MESSAGES.pt[key] ?? key;
    return interpolate(template, params);
}

export function getAnalyzeStepLabel(step: AnalyzeProgressStepKey, locale: SupportedLocale | string): string {
    return getLogMessage(`log.analyze.step.${step}` as LogMessageKey, locale);
}
