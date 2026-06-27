import { jsonrepair } from 'jsonrepair';

/**
 * Attempt to repair a truncated JSON string produced by an LLM
 * that hit its output-token limit mid-response.
 *
 * Strategy:
 *  1. Close any open string literal.
 *  2. Trim back to the last structurally-complete value boundary
 *     (removes the partial key/value that was cut off).
 *  3. Close every remaining open bracket / brace in LIFO order.
 *
 * Returns `null` when the input does not look like truncated JSON
 * (i.e. structures are already balanced).
 */
function repairTruncatedJson(input: string): string | null {
    const start = input.search(/[\[{]/);
    if (start === -1) return null;

    // ── Phase 1: Walk the string and track open structures ──
    let body = input.slice(start);
    let inString = false;
    let escaped = false;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (inString) {
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') inString = false;
        } else if (ch === '"') {
            inString = true;
        }
    }
    // Close an unclosed string literal so regex/jsonrepair can work below.
    if (inString) body += '"';

    // ── Phase 2: Strip the last incomplete key-value pair ──
    body = body
        .replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')          // "key": "truncated_val
        .replace(/,\s*"[^"]*"\s*:\s*[^,}\]"]*$/, '')        // "key": truncated
        .replace(/,\s*"[^"]*"\s*:?\s*$/, '')                 // "key or "key":
        .replace(/,\s*$/, '');                                // trailing comma

    // ── Phase 3: Re-scan and close remaining open structures ──
    const closers: string[] = [];
    inString = false;
    escaped = false;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (inString) {
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') closers.push('}');
        else if (ch === '[') closers.push(']');
        else if ((ch === '}' || ch === ']') && closers.length > 0) closers.pop();
    }

    // Nothing to close → input was not truncated in this way.
    if (closers.length === 0) return null;

    while (closers.length > 0) body += closers.pop();
    return body;
}

/**
 * Extract a balanced JSON object/array using a small state machine.
 * This is resilient to braces/brackets inside quoted strings.
 */
function extractBalancedJsonBlock(input: string): string | null {
    const start = input.search(/[\[{]/);
    if (start === -1) return null;

    const opening = input[start];
    const expectedClosing = opening === '{' ? '}' : ']';
    const stack: string[] = [expectedClosing];

    let inString = false;
    let escaped = false;

    for (let i = start + 1; i < input.length; i++) {
        const ch = input[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack.length > 0) {
            const expected = stack.pop();
            if (expected !== ch) return null;
            if (stack.length === 0) {
                return input.slice(start, i + 1);
            }
        }
    }

    return input.slice(start);
}

function stripCodeFences(input: string): string {
    return input.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

/** Extract and parse JSON from LLM output using tolerant repair before failing. */
export function extractJsonFromLlm<T = unknown>(text: string): T {
    const cleaned = stripCodeFences((text || '').replace(/^\uFEFF/, '').trim());
    const candidate = extractBalancedJsonBlock(cleaned) ?? cleaned;

    try {
        return JSON.parse(candidate) as T;
    } catch {
        // Continue to tolerant repair.
    }

    try {
        return JSON.parse(jsonrepair(candidate)) as T;
    } catch {
        // Continue to truncation repair.
    }

    // Attempt truncation repair (common when LLM hits output-token limit).
    const repaired = repairTruncatedJson(cleaned);
    if (repaired) {
        try {
            return JSON.parse(repaired) as T;
        } catch {
            try {
                return JSON.parse(jsonrepair(repaired)) as T;
            } catch {
                // Continue to full-text repair.
            }
        }
    }

    try {
        return JSON.parse(jsonrepair(cleaned)) as T;
    } catch (err) {
        const openBraces = (candidate.match(/{/g) || []).length;
        const closeBraces = (candidate.match(/}/g) || []).length;
        const openBrackets = (candidate.match(/\[/g) || []).length;
        const closeBrackets = (candidate.match(/]/g) || []).length;

        throw new Error(
            `Failed to parse LLM JSON (length=${text.length}, ` +
            `braces=${openBraces}/${closeBraces}, brackets=${openBrackets}/${closeBrackets}): ` +
            `${(err as Error).message}; sample=${text.slice(0, 220)}...`
        );
    }
}
