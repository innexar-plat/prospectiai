import OpenAI from 'openai';
import type { CompletionOptions, IAIAdapter } from '../types';

export function createOpenAIAdapter(apiKey: string, model: string): IAIAdapter {
    const client = new OpenAI({ apiKey });

    return {
        async generateCompletion(options: CompletionOptions) {
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
            if (options.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: options.prompt });

            const completion = await client.chat.completions.create({
                model,
                messages,
                max_tokens: options.maxTokens ?? 8192,
                ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            });

            const content = completion.choices[0]?.message?.content;
            if (content == null) throw new Error('Empty response from OpenAI');
            const usage = completion.usage
                ? { inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }
                : undefined;
            return { text: content.trim(), usage };
        },
    };
}
