import { extractJsonFromLlm } from '@/lib/ai/parse-json';

describe('extractJsonFromLlm', () => {
  it('parses strict valid JSON', () => {
    const raw = '{"score":88,"summary":"ok"}';
    const parsed = extractJsonFromLlm<{ score: number; summary: string }>(raw);
    expect(parsed.score).toBe(88);
    expect(parsed.summary).toBe('ok');
  });

  it('parses JSON wrapped in markdown fences and prose', () => {
    const raw = 'Resposta:\n```json\n{\n  "score": 77,\n  "summary": "Teste"\n}\n```\nFim';
    const parsed = extractJsonFromLlm<{ score: number; summary: string }>(raw);
    expect(parsed.score).toBe(77);
    expect(parsed.summary).toBe('Teste');
  });

  it('repairs malformed JSON with trailing commas and single quotes', () => {
    const raw = "{ 'score': 66, 'summary': 'ok', }";
    const parsed = extractJsonFromLlm<{ score: number; summary: string }>(raw);
    expect(parsed.score).toBe(66);
    expect(parsed.summary).toBe('ok');
  });

  it('repairs multiline/unescaped content produced by LLM', () => {
    const raw = `\nAqui está:\n{\n  "score": 84,\n  "summary": "Empresa com boa presença\nregional e potencial de upsell",\n  "strengths": ["marca", "ticket"],\n}\n`;
    const parsed = extractJsonFromLlm<{ score: number; summary: string; strengths: string[] }>(raw);
    expect(parsed.score).toBe(84);
    expect(parsed.summary).toContain('potencial');
    expect(parsed.strengths.length).toBe(2);
  });

  it('repairs truncated JSON with missing closing braces (LLM output-token limit)', () => {
    // Simulates the exact production error: braces=2/1, text cut mid-value
    const raw = `{
  "score": 78,
  "scoreLabel": "Quente",
  "summary": "Uma empresa promissora",
  "strengths": ["marca forte", "presença digital"],
  "weaknesses": ["pouca revisão"],
  "details": {
    "approach": "Contato direto via WhatsApp",
    "contactStrategy": "Enviar mensagem pe`;
    const parsed = extractJsonFromLlm<{
      score: number;
      scoreLabel: string;
      summary: string;
      strengths: string[];
      details: Record<string, unknown>;
    }>(raw);
    expect(parsed.score).toBe(78);
    expect(parsed.scoreLabel).toBe('Quente');
    expect(parsed.strengths).toHaveLength(2);
  });

  it('repairs truncated JSON cut after a complete key-value pair', () => {
    const raw = `{"score": 85, "label": "Hot", "items": ["a", "b"], "nested": {"key": "val"`;
    const parsed = extractJsonFromLlm<{ score: number; label: string; items: string[] }>(raw);
    expect(parsed.score).toBe(85);
    expect(parsed.items).toEqual(['a', 'b']);
  });
});
