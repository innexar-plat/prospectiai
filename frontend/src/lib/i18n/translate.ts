const FEATURE_KEYS_COUNT = 4;

export function interpolate(template: string, options?: Record<string, unknown>): string {
    if (!options) return template;
    return Object.entries(options).reduce(
        (msg, [key, value]) => msg.replaceAll(`{${key}}`, String(value)),
        template,
    );
}

export function createTranslator(messages: Record<string, string>) {
    const t = (key: string, options?: Record<string, unknown>): string => {
        const template = messages[key] ?? key;
        return interpolate(template, options);
    };

    const raw = (prefix: string): string[] => {
        const out: string[] = [];
        for (let i = 1; i <= FEATURE_KEYS_COUNT; i++) {
            const k = `${prefix}.${i}`;
            const v = messages[k];
            if (!v || v === k) break;
            out.push(v);
        }
        return out;
    };

    return { t, raw };
}
