import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CompletionOptions, IAIAdapter } from '../types';

export function createGeminiAdapter(apiKey: string, model: string): IAIAdapter {
    const genAI = new GoogleGenerativeAI(apiKey);

    return {
        async generateCompletion(options: CompletionOptions) {
            const parts: string[] = [];
            if (options.systemPrompt) {
                parts.push(options.systemPrompt);
                parts.push('\n\n');
            }
            parts.push(options.prompt);

            const genModel = genAI.getGenerativeModel({
                model,
                generationConfig: {
                    maxOutputTokens: options.maxTokens ?? 8192,
                    ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
                },
            });

            const result = await genModel.generateContent(parts.join(''));
            const text = result.response.text();
            if (!text) throw new Error('Empty response from Gemini');
            const resp = result.response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
            const usage = resp.usageMetadata
                ? {
                      inputTokens: resp.usageMetadata.promptTokenCount ?? 0,
                      outputTokens: resp.usageMetadata.candidatesTokenCount ?? 0,
                  }
                : undefined;
            return { text: text.trim(), usage };
        },
    };
}
