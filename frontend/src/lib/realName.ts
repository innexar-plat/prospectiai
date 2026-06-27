const REAL_NAME_CONNECTORS = new Set(['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'del', 'della', 'van', 'von', 'e']);
const REAL_NAME_PART_REGEX = /^\p{L}[\p{L}'’-]*$/u;

function countLetters(value: string): number {
    return Array.from(value).filter((char) => /\p{L}/u.test(char)).length;
}

export function normalizePersonName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

export function isLikelyRealPersonName(value: string): boolean {
    const normalized = normalizePersonName(value);
    if (!normalized || normalized.length < 5 || /[\d_]/.test(normalized)) return false;

    const parts = normalized.split(' ');
    if (parts.length < 2) return false;

    const significantParts = parts.filter((part) => !REAL_NAME_CONNECTORS.has(part.toLocaleLowerCase('pt-BR')));
    if (significantParts.length < 2) return false;

    return significantParts.every((part) => REAL_NAME_PART_REGEX.test(part) && countLetters(part) >= 2);
}

export function getRealNameValidationMessage(value: string): string | null {
    if (isLikelyRealPersonName(value)) return null;
    return 'Use seu nome e sobrenome reais. Evite numeros, apelidos e simbolos.';
}