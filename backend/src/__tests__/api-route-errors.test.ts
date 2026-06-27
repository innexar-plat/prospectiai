import { classifyRouteError, getRouteFallbackMessage } from '@/lib/api-route-errors';
import { Prisma } from '@prisma/client';

describe('classifyRouteError', () => {
  it('maps AI rate limit errors to 503', () => {
    const result = classifyRouteError(new Error('Failed after 3 attempts. Last error: Too Many Requests'));
    expect(result.status).toBe(503);
    expect(result.message).toContain('Limite de uso');
  });

  it('maps timeout errors to 503', () => {
    const result = classifyRouteError(new Error('The operation was aborted due to timeout'));
    expect(result.status).toBe(503);
    expect(result.message).toContain('demorou');
  });

  it('maps Cloudflare 520 errors to 503', () => {
    const result = classifyRouteError(new Error('Cloudflare AI error 520: upstream error'));
    expect(result.status).toBe(503);
    expect(result.message).toContain('IA');
  });

  it('maps Cloudflare 520 errors to English 503 for US market', () => {
    const result = classifyRouteError(new Error('Cloudflare AI error 520: upstream error'), 'fallback', 'US');
    expect(result.status).toBe(503);
    expect(result.message).toContain('AI service');
  });

  it('maps Prisma connection errors to 503', () => {
    const err = new Prisma.PrismaClientKnownRequestError('connection', {
      code: 'P1001',
      clientVersion: 'test',
    });
    const result = classifyRouteError(err);
    expect(result.status).toBe(503);
  });

  it('defaults unknown errors to 500', () => {
    const result = classifyRouteError(new Error('unexpected'));
    expect(result.status).toBe(500);
    expect(result.message).toBe('Internal Server Error');
  });

  it('uses custom fallback message', () => {
    const result = classifyRouteError(new Error('unexpected'), 'Custom fallback');
    expect(result.message).toBe('Custom fallback');
  });

  it('returns English viability fallback for US market', () => {
    expect(getRouteFallbackMessage('viability', 'US')).toContain('Unable to complete');
    expect(getRouteFallbackMessage('viability', 'BR')).toContain('Não foi possível');
  });

  it('returns English profile incomplete message for US market', () => {
    expect(getRouteFallbackMessage('viabilityProfileIncomplete', 'US')).toContain('Complete your profile');
    expect(getRouteFallbackMessage('viabilityProfileIncomplete', 'BR')).toContain('Complete seu perfil');
  });
});
